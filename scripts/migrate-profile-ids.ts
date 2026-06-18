import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { getUserConfigDir, loadConfig } from "@tinyclaw/core";

const PROFILE_PREFIX = "profile_";
const MIGRATION_LOG_FILE = ".profile-id-migration.json";
const LOCK_FILE = "profile-id-migration.lock";

type MigrationLog = {
  startedAt: string;
  completedAt?: string;
  completed: boolean;
  backupConfigDir?: string;
  backupDbPath?: string;
  mappings: Array<{ oldId: string; newId: string }>;
  dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }>;
};

export type MigrationOptions = {
  configDir?: string;
  databaseUrl?: string;
  dryRun?: boolean;
  force?: boolean;
  acceptDataLoss?: boolean;
  skipEnvCheck?: boolean;
};

export type MigrationResult = {
  dryRun: boolean;
  configDir: string;
  databasePath: string;
  mappings: Array<{ oldId: string; newId: string }>;
  dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }>;
  backupConfigDir?: string;
  backupDbPath?: string;
};

export async function runProfileIdMigration(options: MigrationOptions = {}): Promise<MigrationResult> {
  const configDir = options.configDir?.trim() || getUserConfigDir();
  const databaseUrl = options.databaseUrl?.trim() || loadConfig().databaseUrl;
  const databasePath = resolveDatabasePath(databaseUrl, configDir);
  const dryRun = Boolean(options.dryRun);
  const logPath = join(configDir, MIGRATION_LOG_FILE);
  const runtimeDir = join(configDir, "runtime");
  const lockPath = join(runtimeDir, LOCK_FILE);

  if (databasePath === ":memory:") {
    throw new Error("Migration requires a file-backed database, not :memory:.");
  }

  await mkdir(runtimeDir, { recursive: true });

  if (existsSync(logPath) && !options.force) {
    const existing = await readMigrationLog(logPath);
    if (existing?.completed) {
      throw new Error(`Migration already completed. Re-run with --force to proceed. (${logPath})`);
    }
  }

  await acquireLock(lockPath);
  try {
    if (!options.skipEnvCheck) {
      assertNoPrefixedEnvVar("TINYCLAW_TELEGRAM_PROFILE_ID");
      assertNoPrefixedEnvVar("TINYCLAW_WHATSAPP_PROFILE_ID");
    }

    const dbMappings = await readDbProfileMappings(databasePath);
    const fsMappings = await readFilesystemMappings(configDir);
    const mappings = mergeMappings(dbMappings, fsMappings);
    const dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }> = [];

    const collisions = await detectCollisions(databasePath, configDir, mappings);
    if (collisions.length > 0 && !options.acceptDataLoss && !dryRun) {
      throw new Error(
        `Data-loss collisions detected. Re-run with --accept-data-loss after reviewing: ${collisions.join(", ")}`,
      );
    }

    const result: MigrationResult = {
      dryRun,
      configDir,
      databasePath,
      mappings,
      dropped,
    };

    if (dryRun) {
      return result;
    }

    const stamp = new Date().toISOString().replaceAll(":", "-");
    const backupConfigDir = `${configDir}.backup-${stamp}`;
    const backupDbPath = `${databasePath}.backup-${stamp}`;

    await cp(configDir, backupConfigDir, { recursive: true });
    result.backupConfigDir = backupConfigDir;

    if (existsSync(databasePath)) {
      await mkdir(dirname(backupDbPath), { recursive: true });
      await copyFile(databasePath, backupDbPath);
      result.backupDbPath = backupDbPath;
      validateIntegrity(backupDbPath);
    }

    const log: MigrationLog = {
      startedAt: new Date().toISOString(),
      completed: false,
      backupConfigDir,
      backupDbPath: result.backupDbPath,
      mappings,
      dropped,
    };
    await writeMigrationLog(logPath, log);

    await migrateDatabase(databasePath, mappings, dropped);
    await migrateProfileFolders(configDir, mappings, dropped);
    await migrateConfigFiles(configDir);
    await verifyMigration(databasePath, configDir);

    log.completed = true;
    log.completedAt = new Date().toISOString();
    await writeMigrationLog(logPath, log);

    return result;
  } finally {
    await releaseLock(lockPath);
  }
}

function resolveDatabasePath(databaseUrl: string, configDir: string): string {
  const trimmed = databaseUrl.trim();
  if (trimmed === ":memory:" || trimmed === "memory:") {
    return ":memory:";
  }

  const withoutScheme = trimmed.startsWith("file:") ? trimmed.slice("file:".length) : trimmed;
  if (isAbsolute(withoutScheme)) {
    return withoutScheme;
  }

  return resolve(configDir, withoutScheme);
}

function normalizeProfileId(id: string): string {
  if (!id.startsWith(PROFILE_PREFIX)) {
    return id;
  }

  return id.slice(PROFILE_PREFIX.length);
}

function validateNewId(id: string): void {
  if (!id || id.startsWith(PROFILE_PREFIX)) {
    throw new Error(`Invalid migrated profile id: ${id || "<empty>"}`);
  }
}

async function readDbProfileMappings(databasePath: string): Promise<Array<{ oldId: string; newId: string }>> {
  if (!existsSync(databasePath)) {
    return [];
  }

  const db = new Database(databasePath, { create: false, readwrite: true });
  try {
    const rows = db
      .query("SELECT id FROM profiles WHERE id GLOB 'profile_*'")
      .all() as Array<{ id: string }>;

    return rows.map((row) => {
      const newId = normalizeProfileId(row.id);
      validateNewId(newId);
      return { oldId: row.id, newId };
    });
  } finally {
    db.close();
  }
}

async function readFilesystemMappings(configDir: string): Promise<Array<{ oldId: string; newId: string }>> {
  const profilesDir = join(configDir, "profiles");
  if (!existsSync(profilesDir)) {
    return [];
  }

  const entries = await readdir(profilesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PROFILE_PREFIX))
    .map((entry) => {
      const newId = normalizeProfileId(entry.name);
      validateNewId(newId);
      return { oldId: entry.name, newId };
    });
}

function mergeMappings(
  left: Array<{ oldId: string; newId: string }>,
  right: Array<{ oldId: string; newId: string }>,
): Array<{ oldId: string; newId: string }> {
  const map = new Map<string, string>();
  for (const entry of [...left, ...right]) {
    map.set(entry.oldId, entry.newId);
  }

  return [...map.entries()]
    .map(([oldId, newId]) => ({ oldId, newId }))
    .sort((a, b) => a.oldId.localeCompare(b.oldId));
}

async function detectCollisions(
  databasePath: string,
  configDir: string,
  mappings: Array<{ oldId: string; newId: string }>,
): Promise<string[]> {
  const collisions: string[] = [];
  const profilesDir = join(configDir, "profiles");

  if (existsSync(databasePath)) {
    const db = new Database(databasePath, { create: false, readwrite: true });
    try {
      for (const { oldId, newId } of mappings) {
        const oldCount = db.query("SELECT COUNT(*) as count FROM profiles WHERE id = ?").get(oldId) as {
          count: number;
        };
        const newCount = db.query("SELECT COUNT(*) as count FROM profiles WHERE id = ?").get(newId) as {
          count: number;
        };
        if (oldCount.count > 0 && newCount.count > 0) {
          collisions.push(`profile row collision ${oldId} -> ${newId}`);
        }
      }
    } finally {
      db.close();
    }
  }

  for (const { oldId, newId } of mappings) {
    if (existsSync(join(profilesDir, oldId)) && existsSync(join(profilesDir, newId))) {
      collisions.push(`profile folder collision ${oldId} -> ${newId}`);
    }
  }

  return collisions;
}

async function migrateDatabase(
  databasePath: string,
  mappings: Array<{ oldId: string; newId: string }>,
  dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }>,
): Promise<void> {
  if (!existsSync(databasePath)) {
    return;
  }

  const db = new Database(databasePath, { create: false, readwrite: true });
  let inTransaction = false;
  try {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN EXCLUSIVE");
    inTransaction = true;

    for (const { oldId, newId } of mappings) {
      const oldExists = count(db, "SELECT COUNT(*) AS count FROM profiles WHERE id = ?", [oldId]) > 0;
      if (!oldExists) {
        continue;
      }

      const newExists = count(db, "SELECT COUNT(*) AS count FROM profiles WHERE id = ?", [newId]) > 0;

      if (newExists) {
        deleteOldProfileRows(db, oldId);
        dropped.push({ kind: "row", id: oldId, reason: `prefer existing ${newId}` });
      } else {
        db.query("UPDATE profiles SET id = ? WHERE id = ?").run(newId, oldId);
        updateChildTableProfileIds(db, oldId, newId);
      }

      migrateSkillPaths(db, oldId, newId, dropped);
    }

    recreateAutomationsTableWithDefault(db);

    db.exec("COMMIT");
    inTransaction = false;
    db.exec("PRAGMA foreign_keys = ON");

    const fkIssues = db.query("PRAGMA foreign_key_check").all();
    if (fkIssues.length > 0) {
      throw new Error(`Foreign key check failed: ${JSON.stringify(fkIssues)}`);
    }
  } catch (error) {
    if (inTransaction) {
      db.exec("ROLLBACK");
    }
    throw error;
  } finally {
    db.close();
  }
}

function count(db: Database, query: string, params: unknown[]): number {
  const row = db.query(query).get(...params) as { count: number };
  return row.count;
}

function updateChildTableProfileIds(db: Database, oldId: string, newId: string): void {
  const tables = [
    "automations",
    "sessions",
    "tasks",
    "profile_tools",
    "profile_mcp_servers",
    "profile_skills",
  ];

  for (const table of tables) {
    db.query(`UPDATE ${table} SET profile_id = ? WHERE profile_id = ?`).run(newId, oldId);
  }
}

function deleteOldProfileRows(db: Database, oldId: string): void {
  const tables = [
    "automations",
    "sessions",
    "tasks",
    "profile_tools",
    "profile_mcp_servers",
    "profile_skills",
  ];

  for (const table of tables) {
    db.query(`DELETE FROM ${table} WHERE profile_id = ?`).run(oldId);
  }

  db.query("DELETE FROM profiles WHERE id = ?").run(oldId);
}

function migrateSkillPaths(
  db: Database,
  oldId: string,
  newId: string,
  dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }>,
): void {
  const rows = db.query("SELECT id, source_path FROM skills").all() as Array<{
    id: string;
    source_path: string;
  }>;

  for (const row of rows) {
    const normalized = row.source_path.replaceAll("\\", "/");
    const oldToken = `/profiles/${oldId}/skills/`;
    if (!normalized.includes(oldToken)) {
      continue;
    }

    const replacement = normalized.replace(oldToken, `/profiles/${newId}/skills/`);
    const collision = db
      .query("SELECT id FROM skills WHERE source_path = ? AND id != ?")
      .get(replacement, row.id) as { id: string } | null;

    if (collision) {
      db.query("DELETE FROM profile_skills WHERE skill_id = ?").run(row.id);
      db.query("DELETE FROM skills WHERE id = ?").run(row.id);
      dropped.push({ kind: "skill", id: row.id, reason: `source_path collision with ${collision.id}` });
      continue;
    }

    db.query("UPDATE skills SET source_path = ? WHERE id = ?").run(replacement, row.id);
  }
}

function recreateAutomationsTableWithDefault(db: Database): void {
  const columns = db.query("PRAGMA table_info(automations)").all() as Array<{
    name: string;
    dflt_value: string | null;
  }>;
  const profileColumn = columns.find((column) => column.name === "profile_id");
  if (!profileColumn) {
    return;
  }

  const defaultValue = (profileColumn.dflt_value ?? "").replace(/^'+|'+$/g, "");
  if (defaultValue === "default") {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS automations_new (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      definition TEXT NOT NULL,
      profile_id TEXT NOT NULL DEFAULT 'default',
      enabled INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
    );

    INSERT INTO automations_new (
      id,
      name,
      version,
      definition,
      profile_id,
      enabled,
      created_at,
      updated_at
    )
    SELECT
      id,
      name,
      version,
      definition,
      profile_id,
      enabled,
      created_at,
      updated_at
    FROM automations;

    DROP TABLE automations;
    ALTER TABLE automations_new RENAME TO automations;
  `);
}

async function migrateProfileFolders(
  configDir: string,
  mappings: Array<{ oldId: string; newId: string }>,
  dropped: Array<{ kind: "row" | "folder" | "skill"; id: string; reason: string }>,
): Promise<void> {
  const profilesDir = join(configDir, "profiles");
  if (!existsSync(profilesDir)) {
    return;
  }

  for (const { oldId, newId } of mappings) {
    const oldDir = join(profilesDir, oldId);
    const newDir = join(profilesDir, newId);
    if (!existsSync(oldDir)) {
      continue;
    }

    if (existsSync(newDir)) {
      await rm(oldDir, { recursive: true, force: true });
      dropped.push({ kind: "folder", id: oldId, reason: `prefer existing ${newId}` });
      continue;
    }

    await rename(oldDir, newDir);
  }
}

async function migrateConfigFiles(configDir: string): Promise<void> {
  const iniFiles = [
    join(configDir, "cli.ini"),
    join(configDir, "telegram", "config.ini"),
    join(configDir, "whatsapp", "config.ini"),
  ];

  for (const filePath of iniFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = await readFile(filePath, "utf8");
    const next = raw.replace(/^profile_id\s*=\s*(.+)$/m, (_, value: string) => {
      return `profile_id=${normalizeProfileId(value.trim())}`;
    });

    if (next !== raw) {
      await writeAtomicallyWithBackup(filePath, next);
    }
  }

  const sessionFiles = [
    join(configDir, "telegram", "chat-sessions.json"),
    join(configDir, "whatsapp", "chat-sessions.json"),
  ];

  for (const filePath of sessionFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateProfileIdsInJson(parsed);
    if (JSON.stringify(parsed) === JSON.stringify(migrated)) {
      continue;
    }

    await writeAtomicallyWithBackup(filePath, `${JSON.stringify(migrated, null, 2)}\n`);
  }
}

function migrateProfileIdsInJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(migrateProfileIdsInJson);
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "profileId" && typeof entry === "string") {
        next[key] = normalizeProfileId(entry);
      } else {
        next[key] = migrateProfileIdsInJson(entry);
      }
    }
    return next;
  }

  return value;
}

async function verifyMigration(databasePath: string, configDir: string): Promise<void> {
  if (existsSync(databasePath)) {
    const db = new Database(databasePath, { create: false, readwrite: true });
    try {
      const integrity = db.query("PRAGMA integrity_check").get() as { integrity_check: string };
      if (integrity.integrity_check !== "ok") {
        throw new Error(`Integrity check failed: ${integrity.integrity_check}`);
      }

      const fk = db.query("PRAGMA foreign_key_check").all();
      if (fk.length > 0) {
        throw new Error(`Foreign key check failed: ${JSON.stringify(fk)}`);
      }

      const dbTables = [
        "profiles:id",
        "automations:profile_id",
        "sessions:profile_id",
        "tasks:profile_id",
        "profile_tools:profile_id",
        "profile_mcp_servers:profile_id",
        "profile_skills:profile_id",
      ];

      for (const tableColumn of dbTables) {
        const [table, column] = tableColumn.split(":");
        const row = db
          .query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} GLOB 'profile_*'`)
          .get() as { count: number };
        if (row.count > 0) {
          throw new Error(`Verification failed: ${table}.${column} still has prefixed values.`);
        }
      }

      const pathCount = db
        .query("SELECT COUNT(*) AS count FROM skills WHERE source_path LIKE '%/profiles/profile_/%'")
        .get() as { count: number };
      if (pathCount.count > 0) {
        throw new Error("Verification failed: skills.source_path still contains /profiles/profile_/.");
      }

      const profileIds = db.query("SELECT id FROM profiles").all() as Array<{ id: string }>;
      const folderless = profileIds
        .map((row) => row.id)
        .filter((id) => !existsSync(join(configDir, "profiles", id)));
      if (folderless.length > 0) {
        throw new Error(`Verification failed: folderless profiles found (${folderless.join(", ")}).`);
      }
    } finally {
      db.close();
    }
  }

  const liveConfigFiles = [
    join(configDir, "cli.ini"),
    join(configDir, "telegram", "config.ini"),
    join(configDir, "whatsapp", "config.ini"),
    join(configDir, "telegram", "chat-sessions.json"),
    join(configDir, "whatsapp", "chat-sessions.json"),
  ];

  for (const filePath of liveConfigFiles) {
    if (!existsSync(filePath)) {
      continue;
    }
    const content = await readFile(filePath, "utf8");
    if (filePath.endsWith(".ini") && /profile_id\s*=\s*profile_/m.test(content)) {
      throw new Error(`Verification failed: prefixed profile id still found in ${filePath}`);
    }
    if (filePath.endsWith(".json") && /"profileId"\s*:\s*"profile_/.test(content)) {
      throw new Error(`Verification failed: prefixed profile id still found in ${filePath}`);
    }
  }

  const profilesDir = join(configDir, "profiles");
  if (existsSync(profilesDir)) {
    const entries = await readdir(profilesDir, { withFileTypes: true });
    const prefixed = entries.find((entry) => entry.isDirectory() && entry.name.startsWith(PROFILE_PREFIX));
    if (prefixed) {
      throw new Error(`Verification failed: ${prefixed.name} still exists under profiles/.`);
    }
  }
}

function validateIntegrity(databasePath: string): void {
  const db = new Database(databasePath, { create: false, readonly: true });
  try {
    const row = db.query("PRAGMA integrity_check").get() as { integrity_check: string };
    if (row.integrity_check !== "ok") {
      throw new Error(`Backup database integrity check failed: ${row.integrity_check}`);
    }
  } finally {
    db.close();
  }
}

async function writeAtomicallyWithBackup(path: string, content: string): Promise<void> {
  const backupPath = `${path}.pre-profile-migration`;
  if (!existsSync(backupPath) && existsSync(path)) {
    await copyFile(path, backupPath);
  }

  const tempPath = `${path}.tmp-${Date.now()}`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, path);
}

async function writeMigrationLog(logPath: string, log: MigrationLog): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  const tempPath = `${logPath}.tmp-${Date.now()}`;
  await writeFile(tempPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  await rename(tempPath, logPath);
}

async function readMigrationLog(path: string): Promise<MigrationLog | null> {
  if (!existsSync(path)) {
    return null;
  }

  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as MigrationLog;
}

function assertNoPrefixedEnvVar(name: string): void {
  const value = process.env[name]?.trim();
  if (value?.startsWith(PROFILE_PREFIX)) {
    throw new Error(`${name} still uses ${PROFILE_PREFIX} prefix (${value}).`);
  }
}

async function acquireLock(lockPath: string): Promise<void> {
  if (existsSync(lockPath)) {
    throw new Error(`Migration lock already exists at ${lockPath}.`);
  }

  await writeFile(lockPath, `${process.pid}\n`, { flag: "wx" });
}

async function releaseLock(lockPath: string): Promise<void> {
  if (!existsSync(lockPath)) {
    return;
  }

  await rm(lockPath, { force: true });
}

function parseArgs(argv: string[]): MigrationOptions {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    acceptDataLoss: argv.includes("--accept-data-loss"),
    skipEnvCheck: argv.includes("--skip-env-check"),
  };
}

if (import.meta.main) {
  runProfileIdMigration(parseArgs(process.argv.slice(2)))
    .then((result) => {
      const mode = result.dryRun ? "dry-run" : "live";
      console.log(`Profile migration (${mode}) completed.`);
      console.log(`Config dir: ${result.configDir}`);
      console.log(`DB path: ${result.databasePath}`);
      console.log(`Mappings: ${result.mappings.length}`);
      console.log(`Dropped artifacts: ${result.dropped.length}`);
      if (result.backupConfigDir) {
        console.log(`Backup config dir: ${result.backupConfigDir}`);
      }
      if (result.backupDbPath) {
        console.log(`Backup DB: ${result.backupDbPath}`);
      }
      console.log("Delete scripts/migrate-profile-ids.ts after migration verification passes.");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Profile migration failed: ${message}`);
      process.exitCode = 1;
    });
}

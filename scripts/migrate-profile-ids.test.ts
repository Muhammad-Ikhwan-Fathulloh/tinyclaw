import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { runProfileIdMigration } from "./migrate-profile-ids";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createFixtureDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tinyclaw-profile-migrate-"));
  tempDirs.push(dir);
  return dir;
}

function createTestDb(path: string): Database {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      model TEXT,
      is_super INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE automations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      definition TEXT NOT NULL,
      profile_id TEXT NOT NULL DEFAULT 'profile_default',
      enabled INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'web',
      created_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
    );

    CREATE TABLE profile_tools (
      profile_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      PRIMARY KEY (profile_id, tool_id)
    );

    CREATE TABLE profile_mcp_servers (
      profile_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      PRIMARY KEY (profile_id, server_id)
    );

    CREATE TABLE skills (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      source_path TEXT NOT NULL UNIQUE,
      has_tool INTEGER DEFAULT 0 NOT NULL,
      disable_model_invocation INTEGER DEFAULT 0 NOT NULL,
      enabled INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE profile_skills (
      profile_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      PRIMARY KEY (profile_id, skill_id)
    );
  `);

  return db;
}

describe("migrate-profile-ids script", () => {
  test("migrates prefixed profile ids across DB, folders, and config files", async () => {
    const configDir = await createFixtureDir();
    await mkdir(join(configDir, "profiles", "profile_default"), { recursive: true });
    await mkdir(join(configDir, "telegram"), { recursive: true });
    await mkdir(join(configDir, "whatsapp"), { recursive: true });
    await mkdir(join(configDir, "data", "sqlite"), { recursive: true });

    await writeFile(join(configDir, "cli.ini"), "profile_id=profile_default\n", "utf8");
    await writeFile(join(configDir, "telegram", "config.ini"), "profile_id=profile_default\n", "utf8");
    await writeFile(join(configDir, "whatsapp", "config.ini"), "profile_id=profile_default\n", "utf8");
    await writeFile(
      join(configDir, "telegram", "chat-sessions.json"),
      JSON.stringify({ "123": { profileId: "profile_default" } }),
      "utf8",
    );
    await writeFile(
      join(configDir, "whatsapp", "chat-sessions.json"),
      JSON.stringify({ "wa": { profileId: "profile_default" } }),
      "utf8",
    );

    const dbPath = join(configDir, "data", "sqlite", "tinyclaw.sqlite");
    const db = createTestDb(dbPath);
    db.exec(`
      INSERT INTO profiles (id, name, system_prompt, model, is_super, created_at, updated_at)
      VALUES ('profile_default', 'Default', 'hi', NULL, 0, 'now', 'now');
      INSERT INTO automations (id, name, version, definition, profile_id, enabled, created_at, updated_at)
      VALUES ('auto_1', 'A', 1, '{}', 'profile_default', 1, 'now', 'now');
      INSERT INTO sessions (id, profile_id, channel, created_at)
      VALUES ('sess_1', 'profile_default', 'web', 'now');
      INSERT INTO tasks (id, title, description, prompt, profile_id, status, position, created_at, updated_at)
      VALUES ('task_1', 'T', '', 'p', 'profile_default', 'backlog', 0, 'now', 'now');
      INSERT INTO profile_tools (profile_id, tool_id)
      VALUES ('profile_default', 'tool_1');
      INSERT INTO profile_mcp_servers (profile_id, server_id)
      VALUES ('profile_default', 'server_1');
      INSERT INTO skills (id, name, description, source_path, has_tool, disable_model_invocation, enabled, created_at, updated_at)
      VALUES ('skill_1', 'weather', 'x', '/tmp/.tinyclaw/profiles/profile_default/skills/weather', 0, 0, 1, 'now', 'now');
      INSERT INTO profile_skills (profile_id, skill_id)
      VALUES ('profile_default', 'skill_1');
    `);
    db.close();

    const result = await runProfileIdMigration({
      configDir,
      databaseUrl: "file:data/sqlite/tinyclaw.sqlite",
      skipEnvCheck: true,
    });

    expect(result.mappings).toContainEqual({ oldId: "profile_default", newId: "default" });

    const verifyDb = new Database(dbPath, { readonly: true });
    const profileRow = verifyDb.query("SELECT id FROM profiles").get() as { id: string };
    expect(profileRow.id).toBe("default");

    const automationDefault = verifyDb
      .query("PRAGMA table_info(automations)")
      .all() as Array<{ name: string; dflt_value: string | null }>;
    const profileIdColumn = automationDefault.find((column) => column.name === "profile_id");
    expect(profileIdColumn?.dflt_value).toContain("default");
    verifyDb.close();

    expect(await readFile(join(configDir, "cli.ini"), "utf8")).toContain("profile_id=default");
    expect(await readFile(join(configDir, "telegram", "config.ini"), "utf8")).toContain(
      "profile_id=default",
    );
    expect(await readFile(join(configDir, "whatsapp", "config.ini"), "utf8")).toContain(
      "profile_id=default",
    );

    const tgSessions = JSON.parse(await readFile(join(configDir, "telegram", "chat-sessions.json"), "utf8")) as {
      [key: string]: { profileId: string };
    };
    expect(tgSessions["123"]?.profileId).toBe("default");

    expect(existsSync(join(configDir, "profiles", "default"))).toBe(true);
    expect(existsSync(join(configDir, "profiles", "profile_default"))).toBe(false);
  });

  test("dry run reports mappings without mutating data", async () => {
    const configDir = await createFixtureDir();
    await mkdir(join(configDir, "profiles", "profile_default"), { recursive: true });
    await mkdir(join(configDir, "data", "sqlite"), { recursive: true });

    const dbPath = join(configDir, "data", "sqlite", "tinyclaw.sqlite");
    const db = createTestDb(dbPath);
    db.exec(`
      INSERT INTO profiles (id, name, system_prompt, model, is_super, created_at, updated_at)
      VALUES ('profile_default', 'Default', 'hi', NULL, 0, 'now', 'now');
    `);
    db.close();

    const result = await runProfileIdMigration({
      configDir,
      databaseUrl: "file:data/sqlite/tinyclaw.sqlite",
      dryRun: true,
      skipEnvCheck: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.mappings).toContainEqual({ oldId: "profile_default", newId: "default" });

    const verifyDb = new Database(dbPath, { readonly: true });
    const row = verifyDb.query("SELECT id FROM profiles").get() as { id: string };
    expect(row.id).toBe("profile_default");
    verifyDb.close();

    expect(existsSync(join(configDir, "profiles", "profile_default"))).toBe(true);
  });

  test("requires explicit data-loss acceptance for collisions", async () => {
    const configDir = await createFixtureDir();
    await mkdir(join(configDir, "profiles", "profile_default"), { recursive: true });
    await mkdir(join(configDir, "profiles", "default"), { recursive: true });
    await mkdir(join(configDir, "data", "sqlite"), { recursive: true });

    const dbPath = join(configDir, "data", "sqlite", "tinyclaw.sqlite");
    const db = createTestDb(dbPath);
    db.exec(`
      INSERT INTO profiles (id, name, system_prompt, model, is_super, created_at, updated_at)
      VALUES ('profile_default', 'Default old', 'hi', NULL, 0, 'now', 'now');
      INSERT INTO profiles (id, name, system_prompt, model, is_super, created_at, updated_at)
      VALUES ('default', 'Default new', 'hi', NULL, 0, 'now', 'now');
    `);
    db.close();

    await expect(
      runProfileIdMigration({
        configDir,
        databaseUrl: "file:data/sqlite/tinyclaw.sqlite",
        skipEnvCheck: true,
      }),
    ).rejects.toThrow("--accept-data-loss");
  });
});

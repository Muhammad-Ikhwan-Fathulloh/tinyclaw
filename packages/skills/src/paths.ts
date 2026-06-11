import { readdir } from "node:fs/promises";
import path from "node:path";
import { getUserConfigDir, pathExists } from "@tinyclaw/core";

export const SKILL_FILE_NAME = "SKILL.md";
export const SKILL_TOOL_FILES = ["tool.ts", "tool.js"] as const;

export function getGlobalSkillsDir(): string {
  return path.join(getUserConfigDir(), "agent", "skills");
}

export function getProfileSkillsDir(profileId: string): string {
  return path.join(getUserConfigDir(), "profiles", profileId, "skills");
}

export async function resolveSkillDiscoveryDirs(options: {
  profileId?: string;
} = {}): Promise<string[]> {
  const dirs = [getGlobalSkillsDir()];

  if (options.profileId) {
    dirs.push(getProfileSkillsDir(options.profileId));
    return [...new Set(dirs)];
  }

  const profilesDir = path.join(getUserConfigDir(), "profiles");

  if (await pathExists(profilesDir)) {
    const entries = await readdir(profilesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(getProfileSkillsDir(entry.name));
      }
    }
  }

  return [...new Set(dirs)];
}

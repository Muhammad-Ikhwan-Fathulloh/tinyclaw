import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "@tinyclaw/core";
import { parseSkillMarkdown } from "./parse";
import {
  getGlobalSkillsDir,
  getProfileSkillsDir,
  SKILL_FILE_NAME,
} from "./paths";

export interface CreateSkillFileOptions {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
  profileId?: string;
}

export function composeSkillMarkdown(options: {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
}): string {
  const lines = [
    "---",
    `name: ${options.name}`,
    `description: ${options.description}`,
  ];

  if (options.disableModelInvocation) {
    lines.push("disable-model-invocation: true");
  }

  lines.push("---", "", options.body?.trim() ?? "");

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function createSkillFile(options: CreateSkillFileOptions): Promise<string> {
  const name = options.name.trim();
  const description = options.description.trim();
  const skillsRoot = options.profileId
    ? getProfileSkillsDir(options.profileId)
    : getGlobalSkillsDir();
  const directory = path.join(skillsRoot, name);
  const skillFilePath = path.join(directory, SKILL_FILE_NAME);

  if (await pathExists(skillFilePath)) {
    throw new Error(`Skill "${name}" already exists.`);
  }

  const content = composeSkillMarkdown({
    name,
    description,
    body: options.body,
    disableModelInvocation: options.disableModelInvocation,
  });

  parseSkillMarkdown(content, skillFilePath);

  await mkdir(directory, { recursive: true });
  await writeFile(skillFilePath, content, "utf8");

  return directory;
}

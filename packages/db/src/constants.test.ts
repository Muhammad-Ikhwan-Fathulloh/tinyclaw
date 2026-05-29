import { describe, expect, test } from "bun:test";
import { SUPER_BOT_SYSTEM_PROMPT, SUPER_BOT_TOOL_AUTHORING_RULES } from "./constants";

describe("super bot tool authoring prompt", () => {
  test("forbids shell-script based persistent tools", () => {
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain("Never write bash scripts (.sh) or shell files for tools.");
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain(
      "If the user gives a curl command or bash snippet and asks for a tool, treat it as a prototype only. Re-implement it in JavaScript.",
    );
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain(
      "Never create files like .sh, .bash, .command, or shell wrappers for persistent tools.",
    );
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain(
      'Never describe a registered placeholder or partial setup as if it were a working tool.',
    );
  });

  test("requires user confirmation before assigning newly created tools", () => {
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain(
      "Do not call list_profiles or assign_tool_to_profile until the user confirms in chat",
    );
    expect(SUPER_BOT_SYSTEM_PROMPT).toContain(
      "Never assign to all profiles unless the user explicitly asks for that",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Do NOT call list_profiles before or during tool creation",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Do not call assign_tool_to_profile until the user confirms which profile(s) should receive the tool",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Never assign a newly created tool to all profiles without explicit user approval in chat",
    );
  });

  test("runtime tool authoring rules require translating shell examples to javascript", () => {
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "If the user provides curl/bash example commands, translate them into JavaScript code inside the tool",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Do NOT create .sh, .bash, .command, or wrapper files for persistent tools",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "If you wrote a shell file by mistake, delete it and replace it with a .js module before continuing",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Call list_tools first to check whether the requested tool name already exists",
    );
    expect(SUPER_BOT_TOOL_AUTHORING_RULES).toContain(
      "Never describe a placeholder or partial setup as a working tool",
    );
  });
});

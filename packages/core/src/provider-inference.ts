export type UserProviderName = "openai" | "anthropic" | "openrouter";

export function inferProviderFromApiKey(apiKey: string): UserProviderName {
  const trimmed = apiKey.trim();

  if (trimmed.startsWith("sk-ant-")) {
    return "anthropic";
  }

  if (trimmed.startsWith("sk-or-")) {
    return "openrouter";
  }

  return "openai";
}

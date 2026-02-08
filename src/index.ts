import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";

export type HooksConfig = {
  chatMessage: boolean;
  system: boolean;
  messageHistory: boolean;
  textComplete: boolean;
  toolOutput: boolean;
};

type ReplaceConfig = {
  enabled: boolean;
  replacement: string;
  hooks: HooksConfig;
  caseVariants: boolean;
};

type OptionalReplaceConfig = Partial<ReplaceConfig>;

type ReplaceState = {
  cachedConfig?: ReplaceConfig;
  lastLoaded?: number;
  projectConfigPath?: string;
  globalConfigPath?: string;
  variantRegex?: RegExp;
};

export const DEFAULT_HOOKS_CONFIG: HooksConfig = {
  chatMessage: true,
  system: true,
  messageHistory: true,
  textComplete: true,
  toolOutput: true,
};

export function mergeHooksConfig(
  globalHooks: Partial<HooksConfig> | undefined,
  projectHooks: Partial<HooksConfig> | undefined,
): HooksConfig {
  return {
    ...DEFAULT_HOOKS_CONFIG,
    ...(globalHooks ?? {}),
    ...(projectHooks ?? {}),
  };
}

const DEFAULT_CONFIG: ReplaceConfig = {
  enabled: true,
  replacement: "Renamer",
  hooks: DEFAULT_HOOKS_CONFIG,
  caseVariants: false,
};

const CONFIG_FILENAME = "renamer-config.json";

const ENV_ENABLED = "OPENCODE_RENAMER_REPLACE_ENABLED";
const ENV_REPLACEMENT = "OPENCODE_RENAMER_REPLACE_TEXT";

const URL_REGEX = /https?:\/\/[^\s`"')\]]+/gi;
const PATH_REGEX =
  /(?:\b[a-zA-Z]:\\[^\s`"')\]]+)|(?:~\/[^\s`"')\]]+)|(?:\.\.?\/[^\s`"')\]]+)/g;

const OPENCODE_REGEX = /opencode/gi;

export function splitIntoWords(target: string): string[] {
  // For "opencode", hardcoded since it has no camelCase boundaries
  if (target.toLowerCase() === "opencode") {
    return ["open", "code"];
  }
  return [target];
}

export function generateCaseVariants(words: string[]): string[] {
  const lower = words.map((w) => w.toLowerCase());
  const upper = words.map((w) => w.toUpperCase());
  const capitalize = (w: string) =>
    w[0].toUpperCase() + w.slice(1).toLowerCase();

  return [
    // camelCase: openCode
    lower[0] + words.slice(1).map(capitalize).join(""),
    // PascalCase: OpenCode
    words.map(capitalize).join(""),
    // kebab-case: open-code
    lower.join("-"),
    // snake_case: open_code
    lower.join("_"),
    // SCREAMING_SNAKE: OPEN_CODE
    upper.join("_"),
    // SCREAMING_KEBAB: OPEN-CODE
    upper.join("-"),
    // dot.case: open.code
    lower.join("."),
  ];
}

export function buildVariantRegex(variants: string[]): RegExp {
  const escaped = variants.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("|"), "g");
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function shouldReloadConfig(state: ReplaceState): boolean {
  if (!state.lastLoaded) return true;
  return Date.now() - state.lastLoaded > 1000;
}

async function readConfigFile(
  filePath: string,
): Promise<OptionalReplaceConfig | undefined> {
  const raw = await fs.readFile(filePath, "utf8").catch(() => undefined);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as OptionalReplaceConfig;
    return parsed;
  } catch {
    return undefined;
  }
}

async function loadConfig(state: ReplaceState): Promise<ReplaceConfig> {
  try {
    if (!shouldReloadConfig(state) && state.cachedConfig) {
      return state.cachedConfig;
    }

    const projectConfig = state.projectConfigPath
      ? await readConfigFile(state.projectConfigPath)
      : undefined;
    const globalConfig = state.globalConfigPath
      ? await readConfigFile(state.globalConfigPath)
      : undefined;

    const merged: ReplaceConfig = {
      ...DEFAULT_CONFIG,
      ...(globalConfig ?? {}),
      ...(projectConfig ?? {}),
      hooks: mergeHooksConfig(
        (globalConfig as Record<string, unknown> | undefined)?.hooks as
          | Partial<HooksConfig>
          | undefined,
        (projectConfig as Record<string, unknown> | undefined)?.hooks as
          | Partial<HooksConfig>
          | undefined,
      ),
    };

    const envEnabled = parseBool(process.env[ENV_ENABLED]);
    if (envEnabled !== undefined) {
      merged.enabled = envEnabled;
    }

    const envReplacement = process.env[ENV_REPLACEMENT];
    if (envReplacement && envReplacement.trim().length > 0) {
      merged.replacement = envReplacement;
    }

    // Compile variant regex when caseVariants is enabled
    if (merged.caseVariants) {
      const words = splitIntoWords("opencode");
      const variants = generateCaseVariants(words);
      // Also include base case-insensitive variants
      variants.push("opencode", "Opencode", "OpenCode", "OPENCODE");
      state.variantRegex = buildVariantRegex(variants);
    } else {
      state.variantRegex = undefined;
    }

    state.cachedConfig = merged;
    state.lastLoaded = Date.now();
    return merged;
  } catch (error) {
    console.error("[renamer-opencode-plugin] loadConfig error:", error);
    // Return default config on error to prevent plugin from breaking
    return DEFAULT_CONFIG;
  }
}

export function replaceOpencode(
  text: string,
  replacement: string,
  regex?: RegExp,
): string {
  if (!text) return text;
  return text.replace(regex ?? OPENCODE_REGEX, replacement);
}

export function mergeRanges(
  ranges: Array<[number, number]>,
): Array<[number, number]> {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
      continue;
    }

    merged.push([current[0], current[1]]);
  }

  return merged;
}

export function replaceOutsideRanges(
  text: string,
  replacement: string,
  ranges: Array<[number, number]>,
  regex?: RegExp,
): string {
  if (ranges.length === 0) return replaceOpencode(text, replacement, regex);
  const sorted = mergeRanges(
    ranges
      .map(
        (range) =>
          [Math.max(0, range[0]), Math.max(0, range[1])] as [number, number],
      )
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0]),
  );

  let result = "";
  let cursor = 0;

  for (const [start, end] of sorted) {
    if (start > cursor) {
      result += replaceOpencode(text.slice(cursor, start), replacement, regex);
    }
    result += text.slice(start, end);
    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) {
    result += replaceOpencode(text.slice(cursor), replacement, regex);
  }

  return result;
}

export function replaceExcludingUrlsAndPaths(
  text: string,
  replacement: string,
  regex?: RegExp,
): string {
  const ranges: Array<[number, number]> = [];

  const urlMatches = text.matchAll(URL_REGEX);
  for (const match of urlMatches) {
    if (match.index === undefined) continue;
    ranges.push([match.index, match.index + match[0].length]);
  }

  const pathMatches = text.matchAll(PATH_REGEX);
  for (const match of pathMatches) {
    if (match.index === undefined) continue;
    ranges.push([match.index, match.index + match[0].length]);
  }

  return replaceOutsideRanges(text, replacement, ranges, regex);
}

export function replaceInInlineCodeSegments(
  text: string,
  replacement: string,
  regex?: RegExp,
): string {
  const segments = text.split("`");
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return replaceExcludingUrlsAndPaths(segment, replacement, regex);
    })
    .join("`");
}

export function replaceInText(
  text: string,
  replacement: string,
  regex?: RegExp,
): string {
  if (!text || typeof text !== "string") return text;
  const blocks = text.split("```");
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) return block;
      return replaceInInlineCodeSegments(block, replacement, regex);
    })
    .join("```");
}

function replaceInParts(
  parts: Array<Record<string, unknown>>,
  replacement: string,
  regex?: RegExp,
): void {
  if (!parts || !Array.isArray(parts)) return;
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      part.text = replaceInText(part.text, replacement, regex);
    }

    if (part.type === "subtask") {
      if (typeof part.prompt === "string") {
        part.prompt = replaceInText(part.prompt, replacement, regex);
      }
      if (typeof part.description === "string") {
        part.description = replaceInText(part.description, replacement, regex);
      }
    }

    if (typeof part.title === "string") {
      part.title = replaceInText(part.title, replacement, regex);
    }

    if (typeof part.description === "string") {
      part.description = replaceInText(part.description, replacement, regex);
    }
  }
}

function replaceInMessages(
  messages: Array<{
    info: Record<string, unknown>;
    parts: Array<Record<string, unknown>>;
  }>,
  replacement: string,
  regex?: RegExp,
): void {
  if (!messages || !Array.isArray(messages)) return;
  for (const message of messages) {
    replaceInParts(message.parts, replacement, regex);
    if (typeof message.info?.title === "string") {
      message.info.title = replaceInText(
        message.info.title,
        replacement,
        regex,
      );
    }
  }
}

function updateSessionTitleIfNeeded(
  title: string | undefined,
  replacement: string,
  regex?: RegExp,
): string | undefined {
  if (!title) return title;
  const testRegex = regex ?? OPENCODE_REGEX;
  if (!testRegex.test(title)) return title;
  // Reset lastIndex since test() advances it for global regexes
  testRegex.lastIndex = 0;
  return replaceInText(title, replacement, regex);
}

export const RenamerReplacePlugin: Plugin = async ({
  client,
  directory,
  worktree,
}) => {
  const state: ReplaceState = {};
  const projectRoot = worktree || directory;

  state.projectConfigPath = path.join(
    projectRoot,
    ".opencode",
    CONFIG_FILENAME,
  );
  state.globalConfigPath = path.join(
    os.homedir(),
    ".config",
    "opencode",
    CONFIG_FILENAME,
  );

  async function withConfig<T>(
    fn: (config: ReplaceConfig) => Promise<T> | T,
  ): Promise<T> {
    try {
      const config = await loadConfig(state);
      return fn(config);
    } catch (error) {
      console.error("[renamer-opencode-plugin] withConfig error:", error);
      throw error;
    }
  }

  return {
    event: async ({ event }) => {
      if (
        event.type === "file.edited" ||
        event.type === "file.watcher.updated"
      ) {
        const filePath = (event as { path?: string }).path;
        if (
          filePath &&
          (filePath === state.projectConfigPath ||
            filePath === state.globalConfigPath)
        ) {
          state.lastLoaded = 0;
        }
      }

      if (event.type === "session.updated") {
        await withConfig(async (config) => {
          if (!config.enabled) return;
          const title = (event as { title?: string }).title;
          const updated = updateSessionTitleIfNeeded(
            title,
            config.replacement,
            state.variantRegex,
          );
          if (!updated || updated === title) return;
          const sessionID = (event as { sessionID?: string }).sessionID;
          if (!sessionID) return;
          await client.session.update({
            path: { id: sessionID },
            body: { title: updated },
          });
        }).catch((error) => {
          console.error(
            "[renamer-opencode-plugin] event.session.updated error:",
            error,
          );
        });
      }
    },

    "chat.message": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        if (!config.hooks.chatMessage) return;
        if (!output.parts || !Array.isArray(output.parts)) return;
        replaceInParts(
          output.parts as Array<Record<string, unknown>>,
          config.replacement,
          state.variantRegex,
        );
      }).catch((error) => {
        console.error("[renamer-opencode-plugin] chat.message error:", error);
      });
    },

    "experimental.chat.system.transform": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        if (!config.hooks.system) return;
        const system = output?.system;
        if (!system || !Array.isArray(system)) return;
        for (let i = 0; i < system.length; i += 1) {
          if (typeof system[i] === "string") {
            system[i] = replaceInText(
              system[i],
              config.replacement,
              state.variantRegex,
            );
          }
        }
      }).catch((error) => {
        console.error(
          "[renamer-opencode-plugin] experimental.chat.system.transform error:",
          error,
        );
      });
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        if (!config.hooks.messageHistory) return;
        if (!output.messages || !Array.isArray(output.messages)) return;
        replaceInMessages(
          output.messages as Array<{
            info: Record<string, unknown>;
            parts: Array<Record<string, unknown>>;
          }>,
          config.replacement,
          state.variantRegex,
        );
      }).catch((error) => {
        console.error(
          "[renamer-opencode-plugin] experimental.chat.messages.transform error:",
          error,
        );
      });
    },

    "experimental.text.complete": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        if (!config.hooks.textComplete) return;
        if (typeof output.text !== "string") return;
        output.text = replaceInText(
          output.text,
          config.replacement,
          state.variantRegex,
        );
      }).catch((error) => {
        console.error(
          "[renamer-opencode-plugin] experimental.text.complete error:",
          error,
        );
      });
    },

    "tool.execute.after": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        if (!config.hooks.toolOutput) return;
        if (typeof output.title === "string") {
          output.title = replaceInText(
            output.title,
            config.replacement,
            state.variantRegex,
          );
        }
        if (typeof output.output === "string") {
          output.output = replaceInText(
            output.output,
            config.replacement,
            state.variantRegex,
          );
        }
      }).catch((error) => {
        console.error(
          "[renamer-opencode-plugin] tool.execute.after error:",
          error,
        );
      });
    },
  };
};

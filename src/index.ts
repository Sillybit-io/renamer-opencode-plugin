import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";

type ReplaceConfig = {
  enabled: boolean;
  replacement: string;
};

type OptionalReplaceConfig = Partial<ReplaceConfig>;

type ReplaceState = {
  cachedConfig?: ReplaceConfig;
  lastLoaded?: number;
  projectConfigPath?: string;
  globalConfigPath?: string;
};

const DEFAULT_CONFIG: ReplaceConfig = {
  enabled: true,
  replacement: "Renamer",
};

const CONFIG_FILENAME = "renamer-config.json";

const ENV_ENABLED = "OPENCODE_RENAMER_REPLACE_ENABLED";
const ENV_REPLACEMENT = "OPENCODE_RENAMER_REPLACE_TEXT";

const URL_REGEX = /https?:\/\/[^\s`"')\]]+/gi;
const PATH_REGEX =
  /(?:\b[a-zA-Z]:\\[^\s`"')\]]+)|(?:~\/[^\s`"')\]]+)|(?:\.\.?\/[^\s`"')\]]+)|(?:\/[^\s`"')\]]+)/g;

const OPENCODE_REGEX = /opencode/gi;

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
    };

    const envEnabled = parseBool(process.env[ENV_ENABLED]);
    if (envEnabled !== undefined) {
      merged.enabled = envEnabled;
    }

    const envReplacement = process.env[ENV_REPLACEMENT];
    if (envReplacement && envReplacement.trim().length > 0) {
      merged.replacement = envReplacement;
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

export function replaceOpencode(text: string, replacement: string): string {
  if (!text) return text;
  return text.replace(OPENCODE_REGEX, replacement);
}

export function replaceOutsideRanges(
  text: string,
  replacement: string,
  ranges: Array<[number, number]>,
): string {
  if (ranges.length === 0) return replaceOpencode(text, replacement);
  const sorted = ranges
    .map(
      (range) =>
        [Math.max(0, range[0]), Math.max(0, range[1])] as [number, number],
    )
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let result = "";
  let cursor = 0;

  for (const [start, end] of sorted) {
    if (start > cursor) {
      result += replaceOpencode(text.slice(cursor, start), replacement);
    }
    result += text.slice(start, end);
    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) {
    result += replaceOpencode(text.slice(cursor), replacement);
  }

  return result;
}

export function replaceExcludingUrlsAndPaths(
  text: string,
  replacement: string,
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

  return replaceOutsideRanges(text, replacement, ranges);
}

export function replaceInInlineCodeSegments(
  text: string,
  replacement: string,
): string {
  const segments = text.split("`");
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return replaceExcludingUrlsAndPaths(segment, replacement);
    })
    .join("`");
}

export function replaceInText(text: string, replacement: string): string {
  if (!text || typeof text !== "string") return text;
  const blocks = text.split("```");
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) return block;
      return replaceInInlineCodeSegments(block, replacement);
    })
    .join("```");
}

function replaceInParts(
  parts: Array<Record<string, unknown>>,
  replacement: string,
): void {
  if (!parts || !Array.isArray(parts)) return;
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      part.text = replaceInText(part.text, replacement);
    }

    if (part.type === "subtask") {
      if (typeof part.prompt === "string") {
        part.prompt = replaceInText(part.prompt, replacement);
      }
      if (typeof part.description === "string") {
        part.description = replaceInText(part.description, replacement);
      }
    }

    if (typeof part.title === "string") {
      part.title = replaceInText(part.title, replacement);
    }

    if (typeof part.description === "string") {
      part.description = replaceInText(part.description, replacement);
    }
  }
}

function replaceInMessages(
  messages: Array<{
    info: Record<string, unknown>;
    parts: Array<Record<string, unknown>>;
  }>,
  replacement: string,
): void {
  if (!messages || !Array.isArray(messages)) return;
  for (const message of messages) {
    replaceInParts(message.parts, replacement);
    if (typeof message.info?.title === "string") {
      message.info.title = replaceInText(message.info.title, replacement);
    }
  }
}

function updateSessionTitleIfNeeded(
  title: string | undefined,
  replacement: string,
): string | undefined {
  if (!title) return title;
  if (!OPENCODE_REGEX.test(title)) return title;
  return replaceInText(title, replacement);
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
          const updated = updateSessionTitleIfNeeded(title, config.replacement);
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
        if (!output.parts || !Array.isArray(output.parts)) return;
        replaceInParts(
          output.parts as Array<Record<string, unknown>>,
          config.replacement,
        );
      }).catch((error) => {
        console.error("[renamer-opencode-plugin] chat.message error:", error);
      });
    },

    "experimental.chat.system.transform": async (_input, output) => {
      await withConfig((config) => {
        if (!config.enabled) return;
        const system = output?.system;
        if (!system || !Array.isArray(system)) return;
        for (let i = 0; i < system.length; i += 1) {
          if (typeof system[i] === "string") {
            system[i] = replaceInText(system[i], config.replacement);
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
        if (!output.messages || !Array.isArray(output.messages)) return;
        replaceInMessages(
          output.messages as Array<{
            info: Record<string, unknown>;
            parts: Array<Record<string, unknown>>;
          }>,
          config.replacement,
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
        if (typeof output.text !== "string") return;
        output.text = replaceInText(output.text, config.replacement);
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
        if (typeof output.title === "string") {
          output.title = replaceInText(output.title, config.replacement);
        }
        if (typeof output.output === "string") {
          output.output = replaceInText(output.output, config.replacement);
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

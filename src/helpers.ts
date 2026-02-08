export type HooksConfig = {
  chatMessage: boolean;
  system: boolean;
  messageHistory: boolean;
  textComplete: boolean;
  toolOutput: boolean;
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

const OPENCODE_REGEX = /opencode/gi;

const URL_REGEX = /https?:\/\/[^\s`"')\]]+/gi;
const PATH_REGEX =
  /(?:\b[a-zA-Z]:\\[^\s`"')\]]+)|(?:~\/[^\s`"')\]]+)|(?:\.\.?\/[^\s`"')\]]+)/g;

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

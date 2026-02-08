import { describe, expect, test } from "bun:test";
import {
  buildVariantRegex,
  generateCaseVariants,
  mergeHooksConfig,
  replaceInText,
  splitIntoWords,
} from "../src/index";

describe("integration - all features combined", () => {
  test("bug fix + variants: URL with opencode + variant in text → only text replaced", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const result = replaceInText(
      "Visit https://opencode.ai and use open-code library",
      "Renamer",
      regex,
    );
    expect(result).toBe("Visit https://opencode.ai and use Renamer library");
  });

  test("variants respect all protected ranges: URLs, paths, and code", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = `
      URL: https://open-code.dev
      Path: ./open_code/config.json
      Code: \`const OPEN_CODE = true\`
      Text: use open-code here
    `;

    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("https://open-code.dev");
    expect(result).toContain("./open_code/config.json");
    expect(result).toContain("`const OPEN_CODE = true`");
    expect(result).toContain("use Renamer here");
  });

  test("empty replacement string doesn't crash", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    expect(() => replaceInText("hello open-code", "", regex)).not.toThrow();
    const result = replaceInText("hello open-code", "", regex);
    expect(result).toBe("hello ");
  });

  test("replacement containing opencode doesn't cause double-replacement", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const result = replaceInText("hello open-code", "NewOpenCode", regex);
    expect(result).toBe("hello NewOpenCode");
    expect(result).not.toContain("NewNewOpenCode");
  });

  test("multiple variants in same text all replaced", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = "use openCode, open-code, and open_code together";
    const result = replaceInText(text, "Renamer", regex);
    expect(result).toBe("use Renamer, Renamer, and Renamer together");
  });

  test("config merge: global + project + env overrides work together", () => {
    const globalHooks = {
      chatMessage: false,
      system: false,
    };
    const projectHooks = {
      chatMessage: true,
    };

    const result = mergeHooksConfig(globalHooks, projectHooks);

    expect(result.chatMessage).toBe(true);
    expect(result.system).toBe(false);
    expect(result.messageHistory).toBe(true);
    expect(result.textComplete).toBe(true);
    expect(result.toolOutput).toBe(true);
  });

  test("all features combined: variants + URL protection + code protection", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const complexText = `
      Check out https://opencode.ai for docs.
      Install from ./open_code/setup.sh
      Use \`const OPEN_CODE = true\` in your code.
      The open-code library is great.
      Visit https://docs.opencode.ai/api
      Path: ~/open_code/config.json
      Inline: \`open_code\` variable
      Text: open_code is awesome
    `;

    const result = replaceInText(complexText, "Renamer", regex);

    expect(result).toContain("https://opencode.ai");
    expect(result).toContain("https://docs.opencode.ai/api");
    expect(result).toContain("./open_code/setup.sh");
    expect(result).toContain("~/open_code/config.json");
    expect(result).toContain("`const OPEN_CODE = true`");
    expect(result).toContain("`open_code`");
    expect(result).toContain("The Renamer library is great");
    expect(result).toContain("Text: Renamer is awesome");
  });

  test("variant regex with all 7 variants matches correctly", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);

    expect(variants).toHaveLength(7);

    expect(variants[0]).toBe("openCode");
    expect(variants[1]).toBe("OpenCode");
    expect(variants).toContain("open-code");
    expect(variants).toContain("open_code");
    expect(variants).toContain("OPEN_CODE");
    expect(variants).toContain("OPEN-CODE");
    expect(variants).toContain("open.code");

    const regex = buildVariantRegex(variants);

    expect("hello openCode world".match(regex)).toBeTruthy();
    expect("hello OpenCode world".match(regex)).toBeTruthy();
    expect("hello open-code world".match(regex)).toBeTruthy();
    expect("hello open_code world".match(regex)).toBeTruthy();
    expect("hello OPEN_CODE world".match(regex)).toBeTruthy();
    expect("hello OPEN-CODE world".match(regex)).toBeTruthy();
    expect("hello open.code world".match(regex)).toBeTruthy();
  });

  test("fenced code blocks protect all variants", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = `
      Before code block
      \`\`\`
      const opencode = 1;
      const open_code = 2;
      const OPEN_CODE = 3;
      \`\`\`
      After code block
    `;

    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("const opencode = 1;");
    expect(result).toContain("const open_code = 2;");
    expect(result).toContain("const OPEN_CODE = 3;");
  });

  test("mixed inline and fenced code blocks with surrounding text", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = `
      Use open-code library.
      \`\`\`
      import opencode from 'opencode';
      \`\`\`
      The open-code package is great.
      Use \`open_code\` variable.
      Final: open-code rocks.
    `;

    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("Use Renamer library.");
    expect(result).toContain("The Renamer package is great.");
    expect(result).toContain("Final: Renamer rocks.");

    expect(result).toContain("import opencode from 'opencode';");
    expect(result).toContain("`open_code`");
  });

  test("URL with variant in domain and text variant outside", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = "Visit https://open-code.dev for open-code docs";
    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("https://open-code.dev");
    expect(result).toContain("for Renamer docs");
  });

  test("path with variant in directory name and text variant outside", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = "Config at ./open_code/config.json uses open_code library";
    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("./open_code/config.json");
    expect(result).toContain("uses Renamer library");
  });

  test("multiple URLs and paths with variants interspersed with text", () => {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    const regex = buildVariantRegex(variants);

    const text = `
      Use open-code from https://opencode.ai
      Config: ./open_code/setup.sh
      Also try open-code at https://open-code.dev
      Path: ~/open_code/config.json
      Text: open-code is great
    `;

    const result = replaceInText(text, "Renamer", regex);

    expect(result).toContain("https://opencode.ai");
    expect(result).toContain("https://open-code.dev");
    expect(result).toContain("./open_code/setup.sh");
    expect(result).toContain("~/open_code/config.json");
    expect(result).toContain("Use Renamer from");
    expect(result).toContain("Also try Renamer at");
    expect(result).toContain("Text: Renamer is great");
  });
});

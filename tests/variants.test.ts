import { describe, expect, test } from "bun:test";
import {
  buildVariantRegex,
  generateCaseVariants,
  replaceInText,
  splitIntoWords,
} from "../src/helpers";

describe("splitIntoWords", () => {
  test("splits 'opencode' into ['open', 'code']", () => {
    expect(splitIntoWords("opencode")).toEqual(["open", "code"]);
  });
});

describe("generateCaseVariants", () => {
  test("generates 7 variants from ['open', 'code']", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toHaveLength(7);
  });

  test("includes camelCase: openCode", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("openCode");
  });

  test("includes PascalCase: OpenCode", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("OpenCode");
  });

  test("includes kebab-case: open-code", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("open-code");
  });

  test("includes snake_case: open_code", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("open_code");
  });

  test("includes SCREAMING_SNAKE: OPEN_CODE", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("OPEN_CODE");
  });

  test("includes SCREAMING_KEBAB: OPEN-CODE", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("OPEN-CODE");
  });

  test("includes dot.case: open.code", () => {
    const variants = generateCaseVariants(["open", "code"]);
    expect(variants).toContain("open.code");
  });
});

describe("buildVariantRegex", () => {
  test("returns regex matching all variants", () => {
    const variants = ["openCode", "open-code", "open.code"];
    const regex = buildVariantRegex(variants);
    expect("hello openCode world".match(regex)).toBeTruthy();
    expect("hello open-code world".match(regex)).toBeTruthy();
    expect("hello open.code world".match(regex)).toBeTruthy();
  });

  test("dot in dot.case is escaped in regex", () => {
    const regex = buildVariantRegex(["open.code"]);
    expect("open.code".match(regex)).toBeTruthy();
    expect("openXcode".match(regex)).toBeFalsy();
  });

  test("uses global flag for multiple matches", () => {
    const regex = buildVariantRegex(["openCode"]);
    const matches = "openCode and openCode".match(regex);
    expect(matches).toHaveLength(2);
  });

  test("does NOT use case-insensitive flag", () => {
    const regex = buildVariantRegex(["openCode"]);
    expect("OPENCODE".match(regex)).toBeFalsy();
  });
});

describe("replaceInText with variant regex", () => {
  function makeVariantRegex(): RegExp {
    const words = splitIntoWords("opencode");
    const variants = generateCaseVariants(words);
    return buildVariantRegex(variants);
  }

  test("matches camelCase variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello openCode world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches PascalCase variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello OpenCode world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches kebab-case variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello open-code world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches snake_case variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello open_code world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches SCREAMING_SNAKE variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello OPEN_CODE world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches SCREAMING_KEBAB variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello OPEN-CODE world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches dot.case variant", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("hello open.code world", "Renamer", regex);
    expect(result).toBe("hello Renamer world");
  });

  test("matches multiple different variants in same text", () => {
    const regex = makeVariantRegex();
    const result = replaceInText(
      "openCode and open_code and OPEN_CODE",
      "Renamer",
      regex,
    );
    expect(result).toBe("Renamer and Renamer and Renamer");
  });

  test("variants in URLs are NOT replaced", () => {
    const regex = makeVariantRegex();
    const result = replaceInText(
      "visit https://open-code.dev for info",
      "Renamer",
      regex,
    );
    expect(result).toBe("visit https://open-code.dev for info");
  });

  test("variants in code blocks are NOT replaced", () => {
    const regex = makeVariantRegex();
    const result = replaceInText("use `open_code` variable", "Renamer", regex);
    expect(result).toBe("use `open_code` variable");
  });

  test("variants in fenced code blocks are NOT replaced", () => {
    const regex = makeVariantRegex();
    const result = replaceInText(
      "text\n```\nconst open_code = 1;\n```\nmore text",
      "Renamer",
      regex,
    );
    expect(result).toBe("text\n```\nconst open_code = 1;\n```\nmore text");
  });

  test("without regex param, default behavior unchanged", () => {
    const result = replaceInText("hello opencode world", "Renamer");
    expect(result).toBe("hello Renamer world");
  });
});

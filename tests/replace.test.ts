import { describe, test, expect } from "bun:test";
import { replaceInText } from "../src/index";

describe("replaceInText", () => {
  test("replaces opencode in plain text", () => {
    expect(replaceInText("hello opencode", "Renamer")).toBe("hello Renamer");
  });
});

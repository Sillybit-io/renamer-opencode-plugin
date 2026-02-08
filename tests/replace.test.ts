import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  replaceExcludingUrlsAndPaths,
  replaceInText,
  replaceOutsideRanges,
} from "../src/index";

const URL_DOCS = ["https", "://", "opencode.ai", "/docs"].join("");
const URL_HOME = ["https", "://", "opencode.ai"].join("");
const URL_API = ["https", "://", "docs.opencode.ai", "/api"].join("");

describe("replaceOutsideRanges - overlapping ranges", () => {
  test("URL containing target word is not duplicated", () => {
    const text = `Visit ${URL_DOCS} for more`;

    const result = replaceOutsideRanges(text, "Renamer", [
      [6, 29],
      [12, 29],
    ]);

    assert.equal(result, text);
  });

  test("contained overlapping range is emitted only once", () => {
    const result = replaceOutsideRanges("opencode opencode", "Renamer", [
      [0, 8],
      [2, 8],
    ]);

    assert.equal(result, "opencode Renamer");
  });
});

describe("replaceExcludingUrlsAndPaths", () => {
  test("URL containing opencode is left untouched and not duplicated", () => {
    const text = `Visit ${URL_DOCS}`;
    const result = replaceExcludingUrlsAndPaths(text, "Renamer");

    assert.equal(result, text);
  });

  test("text around URL is still replaced", () => {
    const result = replaceExcludingUrlsAndPaths(
      `opencode is at ${URL_DOCS} and opencode rocks`,
      "Renamer",
    );

    assert.equal(result, `Renamer is at ${URL_DOCS} and Renamer rocks`);
  });
});

describe("replaceInText - URL handling", () => {
  test("URL is untouched and not duplicated", () => {
    const text = `Visit ${URL_DOCS} for more`;
    const result = replaceInText(text, "Renamer");

    assert.equal(result, text);
  });

  test("multiple URLs in one string are untouched", () => {
    const text = `See ${URL_HOME} and ${URL_API}`;
    const result = replaceInText(text, "Renamer");

    assert.equal(result, text);
  });

  test("URL untouched while surrounding text is replaced", () => {
    const result = replaceInText(
      `opencode is at ${URL_DOCS} and opencode rocks`,
      "Renamer",
    );

    assert.equal(result, `Renamer is at ${URL_DOCS} and Renamer rocks`);
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { HooksConfig } from "../src/helpers";
import { DEFAULT_HOOKS_CONFIG, mergeHooksConfig } from "../src/helpers";

describe("hook config defaults", () => {
  test("all hooks default to true when hooks config is omitted", () => {
    const result = mergeHooksConfig(undefined, undefined);
    assert.deepStrictEqual(result, {
      chatMessage: true,
      system: true,
      messageHistory: true,
      textComplete: true,
      toolOutput: true,
    });
  });

  test("DEFAULT_HOOKS_CONFIG has all hooks enabled", () => {
    assert.strictEqual(DEFAULT_HOOKS_CONFIG.chatMessage, true);
    assert.strictEqual(DEFAULT_HOOKS_CONFIG.system, true);
    assert.strictEqual(DEFAULT_HOOKS_CONFIG.messageHistory, true);
    assert.strictEqual(DEFAULT_HOOKS_CONFIG.textComplete, true);
    assert.strictEqual(DEFAULT_HOOKS_CONFIG.toolOutput, true);
  });
});

describe("hook config merging", () => {
  test("partial hooks config leaves unspecified hooks at true", () => {
    const result = mergeHooksConfig({ chatMessage: false }, undefined);
    assert.strictEqual(result.chatMessage, false);
    assert.strictEqual(result.system, true);
    assert.strictEqual(result.messageHistory, true);
    assert.strictEqual(result.textComplete, true);
    assert.strictEqual(result.toolOutput, true);
  });

  test("project config overrides global config", () => {
    const globalHooks: Partial<HooksConfig> = {
      chatMessage: false,
      system: false,
    };
    const projectHooks: Partial<HooksConfig> = { chatMessage: true };
    const result = mergeHooksConfig(globalHooks, projectHooks);
    assert.strictEqual(result.chatMessage, true);
    assert.strictEqual(result.system, false);
  });

  test("hooks.chatMessage: false disables chat message hook", () => {
    const result = mergeHooksConfig({ chatMessage: false }, undefined);
    assert.strictEqual(result.chatMessage, false);
  });

  test("hooks.system: false disables system transform hook", () => {
    const result = mergeHooksConfig({ system: false }, undefined);
    assert.strictEqual(result.system, false);
  });

  test("hooks.messageHistory: false disables messages transform hook", () => {
    const result = mergeHooksConfig({ messageHistory: false }, undefined);
    assert.strictEqual(result.messageHistory, false);
  });

  test("hooks.textComplete: false disables text complete hook", () => {
    const result = mergeHooksConfig({ textComplete: false }, undefined);
    assert.strictEqual(result.textComplete, false);
  });

  test("hooks.toolOutput: false disables tool output hook", () => {
    const result = mergeHooksConfig({ toolOutput: false }, undefined);
    assert.strictEqual(result.toolOutput, false);
  });
});

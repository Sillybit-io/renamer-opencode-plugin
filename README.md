# @sillybit/renamer-opencode-plugin

A small OpenCode plugin that **replaces case-insensitive occurrences of `opencode`** with a configurable word (default: `Renamer`) across OpenCode outputs.

This is mainly useful for **privacy/safety**: it helps reduce accidental disclosure of the platform name in logs, screenshots, demos, shared transcripts, or tool output.

## Why would I use this?

- **Safer sharing**: reduces chance your pasted output reveals “opencode”.
- **Cleaner demos and screenshots**: consistent wording in public materials.
- **Non-invasive**: avoids changing URLs, file paths, and code blocks so you don’t break commands, stack traces, or links.

## What it changes (and what it doesn’t)

The plugin runs on multiple OpenCode hooks, including chat messages, system prompts, tool output, and session titles.

It **does not replace** inside:

- URLs (example: `https://opencode.ai/docs/plugins`)
- file paths (example: `.opencode/...`, `/usr/local/...`, `C:\Users\...`)
- inline code and fenced code blocks (anything inside backticks)

## Quickstart (npm)

1. Install the plugin in your project:

```bash
bun add -d @sillybit/renamer-opencode-plugin
```

2. Add the plugin to your OpenCode config (`opencode.json` or `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@sillybit/renamer-opencode-plugin"]
}
```

3. Restart OpenCode.

OpenCode installs npm plugins automatically at startup (cached under `~/.cache/opencode/node_modules/`), so the manual install step is optional.

## Updating the plugin

If the plugin is installed in your project `devDependencies`, update it with Bun:

```bash
bun update -d @sillybit/renamer-opencode-plugin
```

To force the latest published version:

```bash
bun add -d @sillybit/renamer-opencode-plugin@latest
```

After updating, restart OpenCode so it reloads the plugin.

If you only reference the plugin in `opencode.json`/`opencode.jsonc` (without adding it to your project dependencies), restarting OpenCode is usually enough for it to fetch the newest cached-compatible version.

## Configuration

Config is optional. If you don’t configure anything, the plugin is enabled and replaces `opencode` → `Renamer`.

Config files are JSON and loaded from both locations:

- Global: `~/.config/opencode/renamer-config.json`
- Project: `.opencode/renamer-config.json`

Project config overrides global config.

Example:

```json
{
  "enabled": true,
  "replacement": "Renamer",
  "hooks": {
    "chatMessage": true,
    "system": true,
    "messageHistory": true,
    "textComplete": true,
    "toolOutput": true
  },
  "caseVariants": false
}
```

### Environment variables (highest precedence)

- `OPENCODE_RENAMER_REPLACE_ENABLED` (`true`/`false`, also supports `1/0`, `yes/no`, `on/off`)
- `OPENCODE_RENAMER_REPLACE_TEXT` (non-empty string)

## Hook Configuration

By default, all hooks are enabled. You can selectively disable specific hooks using the `hooks` configuration:

```json
{
  "enabled": true,
  "replacement": "Renamer",
  "hooks": {
    "chatMessage": false, // Disable replacement in chat messages
    "system": true, // Keep replacement in system prompts
    "messageHistory": true, // Keep replacement in message history
    "textComplete": true, // Keep replacement in text completions
    "toolOutput": true // Keep replacement in tool outputs
  }
}
```

**Available hook toggles:**

- `chatMessage` - Controls replacement in chat messages
- `system` - Controls replacement in system prompts
- `messageHistory` - Controls replacement in message history
- `textComplete` - Controls replacement in text completions
- `toolOutput` - Controls replacement in tool outputs

**Note:** Session title replacement (the `event` handler) is always active when `enabled: true` and cannot be disabled via hooks configuration.

## Case Variant Matching

By default, the plugin only matches `opencode` (case-insensitive). You can enable matching of case variants using the `caseVariants` option:

```json
{
  "enabled": true,
  "replacement": "Renamer",
  "caseVariants": true
}
```

When `caseVariants: true`, the plugin matches and replaces these 7 variants:

- **camelCase**: `openCode` → `Renamer`
- **PascalCase**: `OpenCode` → `Renamer`
- **kebab-case**: `open-code` → `Renamer`
- **snake_case**: `open_code` → `Renamer`
- **SCREAMING_SNAKE**: `OPEN_CODE` → `Renamer`
- **SCREAMING_KEBAB**: `OPEN-CODE` → `Renamer`
- **dot.case**: `open.code` → `Renamer`

**Important notes:**

- Replacement is always the literal `replacement` string (not case-aware)
- Variants respect protected ranges (URLs, paths, code blocks)
- Default is `false` for backward compatibility

**Example:**

Input:

```
Use open-code or open_code in your project
Visit https://open-code.dev for docs
```

Output (with `caseVariants: true`):

```
Use Renamer or Renamer in your project
Visit https://open-code.dev for docs
```

The URL is protected, but the text variants are replaced.

## Examples

### Normal text (replaced)

Input:
`I’m using opencode for this task`

Output (default):
`I’m using Renamer for this task`

### URL (not replaced)

`https://opencode.ai/docs/plugins` stays unchanged.

### Code (not replaced)

Inline code: `` `opencode` `` stays unchanged.

Fenced code blocks stay unchanged:

```sh
echo "opencode"
```

## Behavior details

- Match is case-insensitive: `OpenCode`, `OPENCODE`, `opencode` all become your `replacement`.
- **Case variant matching**: When `caseVariants: true` is enabled, variants like `open-code` or `open_code` are also matched and replaced.
- Replacement target is intentionally fixed to `opencode` (not configurable).

## Development

```bash
bun install
bun run build
```

## Contributing

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build config, etc.)

**Examples:**

```
feat: add support for custom replacement patterns
fix: exclude URLs from text replacement
docs: update installation instructions
chore: update dependencies
```

**Breaking Changes:**
Use `!` after the type/scope to indicate breaking changes:

```
feat!: change default replacement from "Renamer" to "Custom"
```

## License

MIT

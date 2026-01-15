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
  "plugin": ["@sillybit/renamer-opencode-plugin@latest"]
}
```

3. Restart OpenCode.

OpenCode installs npm plugins automatically at startup (cached under `~/.cache/opencode/node_modules/`), so the manual install step is optional.

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
  "replacement": "Renamer"
}
```

### Environment variables (highest precedence)

- `OPENCODE_RENAMER_REPLACE_ENABLED` (`true`/`false`, also supports `1/0`, `yes/no`, `on/off`)
- `OPENCODE_RENAMER_REPLACE_TEXT` (non-empty string)

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

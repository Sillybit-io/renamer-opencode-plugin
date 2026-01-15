# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-15T11:49:40Z

## OVERVIEW

TypeScript OpenCode plugin that replaces case-insensitive `opencode` text with a configurable value (default: `Renamer`) across chat messages, system prompts, tool outputs, and session titles. It excludes URLs, file paths, and code blocks from replacement.

**Package Manager:** Bun

## ABOUT OPENCODE

OpenCode is an AI-powered development environment that provides a plugin system for extending functionality. Key concepts:

- **Plugin System:** OpenCode plugins are TypeScript/JavaScript modules that export a plugin function
- **Plugin Function:** Receives `{ client, directory, worktree }` and returns an object with hook handlers
- **Hooks:** Lifecycle events and transformation points where plugins can intercept and modify behavior
- **Configuration:** Plugins can read from:
  - Project config: `.opencode/plugin-name-config.json` or `opencode.json`
  - Global config: `~/.config/opencode/plugin-name-config.json`
  - Environment variables
- **Client API:** Provides access to OpenCode services (e.g., `client.session.update()`)
- **Plugin Directory:** Plugins can be installed:
  - Locally: `.opencode/plugin/plugin-name.js`
  - Via npm/bun: Listed in `opencode.json` or `opencode.jsonc` config file

### OpenCode Plugin Types

1. **Event Hooks:** React to file system events, session updates, etc.
2. **Transform Hooks:** Modify content as it flows through the system:
   - `chat.message` - Transform chat message outputs
   - `experimental.chat.system.transform` - Transform system prompts
   - `experimental.chat.messages.transform` - Transform message history
   - `experimental.text.complete` - Transform text completions
   - `tool.execute.after` - Transform tool execution results

## STRUCTURE

```
./
├── src/index.ts      # Plugin implementation + text transform helpers
├── package.json      # Publishable npm package metadata (ESM)
├── tsconfig.json     # TypeScript compiler config (build → dist/)
├── biome.json        # Biome formatter and linter configuration
├── bun.lock          # Bun dependency lock file
└── README.md         # Install + configuration docs
```

## WHERE TO LOOK

- Plugin entry/export: `src/index.ts`
- Replacement rules (skip URLs/paths/code): `src/index.ts`
- Config/env names and defaults: `src/index.ts`
- Publish setup (exports/prepack/files): `package.json`

## COMMANDS

```bash
# Install deps
bun install

# Build (emits dist/)
bun run build

# Format code
bun run format

# Lint code
bun run lint

# Format and lint together
bun run check

# Pre-publish check (runs build via prepack)
bun pm pack --dry-run

# Publish
bun publish
```

**Note:** This project uses Bun as the package manager. All commands should use `bun` instead of `npm`. Use `bun pm pack --dry-run` for publish checks.

### Lint & Format

- **Biome** is configured for formatting and linting (see `biome.json`)
- Configuration: 2-space indentation, double quotes, import organization enabled
- `bun run format` - Format code with Biome
- `bun run lint` - Lint code with Biome
- `bun run check` - Format and lint in one command
- Biome automatically respects `.gitignore` and excludes `dist/` directory

### Tests

- No test runner configured.
- Single-test execution: not applicable until tests are added.

### Release Automation

- Uses `release-please` via `.github/workflows/release-please.yml`.
- Config files: `release-please-config.json`, `.release-please-manifest.json`.
- Publishes to npm automatically on release creation (requires `NPM_TOKEN` secret).
- Manual publish workflow retained as `workflow_dispatch` in `.github/workflows/publish.yml`.

## CODE STYLE GUIDELINES

### General

- Keep changes small and focused; avoid refactors in bugfixes.
- Do not add heavyweight dependencies; this is a lightweight plugin.
- Preserve behavior that skips URLs/paths/code when replacing text.

### Imports

- Use ESM imports only (`type`: `module`).
- Prefer `import type` for type-only imports (see `src/index.ts`).
- Node core imports should be explicit (`node:fs/promises`, `node:path`, `node:os`).

### Formatting

- **Biome** is used for code formatting (configured in `biome.json`)
- TypeScript code is formatted with 2-space indentation
- Double quotes for strings (configured in Biome)
- Keep function signatures and chained calls readable; break long lines
- Use trailing commas in multiline parameter lists and object literals
- Run `bun run format` or `bun run check` before committing

### Types

- Prefer explicit types for config and state objects (e.g., `ReplaceConfig`, `ReplaceState`).
- Use `Partial<T>` for config overrides and merge explicitly.
- Avoid `any`, `@ts-ignore`, and `@ts-expect-error`.

### Naming

- Constants in `SCREAMING_SNAKE_CASE` for env vars and regex names.
- Use descriptive function names for transforms (e.g., `replaceInText`).
- Boolean helpers should be predicate-style (`shouldReloadConfig`).

### Error Handling

- File reads should be resilient: treat missing/invalid config as undefined.
- Do not throw on bad config; fall back to defaults.
- Avoid empty `catch` blocks unless intentionally swallowing non-critical errors.

### Replacement Rules

- Replacement is case-insensitive (`/opencode/gi`).
- Exclude URLs, file paths, inline code, and fenced code blocks.
- Do not replace inside URLs/paths/code; treat them as protected ranges.

## COMMIT CONVENTIONS

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification.
All agents and Cursor must use Conventional Commits for every commit.

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Required Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build config, etc.)

**Breaking Changes:**
Use `!` after the type/scope: `feat!: change default replacement`

**Examples:**

- `feat: add support for custom replacement patterns`
- `fix: exclude URLs from text replacement`
- `docs: update installation instructions`
- `chore: update dependencies`

**Guidelines:**

- Always use conventional commit format
- Keep subject line under 72 characters
- Use imperative mood ("add" not "added" or "adds")
- Reference issues/PRs in footer if applicable

## CONFIGURATION

### Plugin Configuration

- Global config: `~/.config/opencode/renamer-config.json`
- Project config: `.opencode/renamer-config.json`
- Env overrides:
  - `OPENCODE_RENAMER_REPLACE_ENABLED`
  - `OPENCODE_RENAMER_REPLACE_TEXT`

### Publish Configuration

- **Repository:** `https://github.com/Sillybit-io/renamer-opencode-plugin.git`
- **Package files:** `dist/`, `README.md` (configured in `package.json` `files` field)
- **Build:** Automatic via `prepack` script before publishing
- **Verification:** Run `bun pm pack --dry-run` to verify publish contents

## NOTES

- **Package Manager:** Bun (uses `bun.lock` for dependency locking, not `package-lock.json` or `yarn.lock`)
- Plugin uses ESM (`type: "module"` in package.json)
- Requires Node.js >= 18 (or Bun runtime)
- No external dependencies except `@opencode-ai/plugin`
- **Code formatting:** Biome (configured in `biome.json`, 2-space indentation, double quotes)
- **Commit conventions:** Conventional Commits specification (see COMMIT CONVENTIONS section)
- **Publish ready:** Package includes description, repository, homepage, and bugs URLs
- No test framework configured (consider adding tests)

### OpenCode Integration

- Plugins are loaded from `.opencode/plugin/` directory or via npm/bun registry
- Configuration files follow pattern: `~/.config/opencode/` (global) and `.opencode/` (project)
- Plugin hooks are called asynchronously and can modify outputs in-place
- The `client` object provides access to OpenCode APIs for session management, file operations, etc.

# Ritual — Claude Code Plugin

Plan before you build. [Ritual](https://ritual.work) runs a structured exploration —
discovery questions, recommendations, a validated build brief — so your coding agent
gets the intent, constraints, and prior decisions it can't infer from the repo.

The plugin bundles two things:

- **The Ritual MCP server connection** — sign in with your Ritual account when
  prompted; the agent gets the full Ritual tool surface.
- **The `/ritual` skill** — the flow that drives those tools: `build` (full
  planning-to-sync cycle), `resume`, `lineage`, `context-pulse`.

## Install

```
/plugin marketplace add ritual-work/claude-plugin
/plugin install ritual@ritual
```

Then in any repo:

```
/ritual build "what you want to build"
```

The first tool call prompts you to sign in to Ritual.

## Updating

```
/plugin marketplace update ritual
/plugin update ritual@ritual
```

## Other ways to install Ritual

Not using Claude Code plugins? The [Ritual CLI](https://www.npmjs.com/package/@ritualai/cli)
installs the same skill for Claude Code, Cursor, Windsurf, Kiro, Gemini, VS Code, and Codex:

```bash
npx @ritualai/cli init
```

## License

MIT — see [LICENSE](LICENSE). The skill content is generated from Ritual's canonical
skill source and synced here; report issues on this repo.

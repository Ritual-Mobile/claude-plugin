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

**Fastest path — paste this into any Claude Code session** and it will set everything
up and tell you what to do next:

```text
Set up the Ritual plugin for Claude Code, then tell me what to do next.

1. Run `claude --version`. If older than 2.1.246, stop and tell me to update first
   (Homebrew users: `brew uninstall --cask claude-code && brew install --cask claude-code@latest`
   — the plain cask lags behind plugin support).
2. Check for older Ritual installs before changing anything: a user-scoped MCP server
   named `ritual` (`claude mcp get ritual`) and a CLI-installed skill at
   `~/.claude/skills/ritual`. If either exists, show me what you found and ask before
   removing it — the plugin supersedes both.
3. Then run:
   claude plugin marketplace add ritual-work/claude-plugin
   claude plugin install ritual@ritual
   claude mcp add --transport http -s user ritual https://mcp.ritualapp.cloud/mcp
4. Verify with `claude plugin details ritual` — it should list build, resume, lite,
   lineage, context-pulse, status.
5. Finally, give me these exact next steps: exit this session and start `claude` again;
   run /mcp, select `ritual`, and sign in in the browser (create a Ritual account there
   if I don't have one); then kick off my first run with
   /ritual:build "<what I want to build>".
```

**Or set it up by hand:**

Inside Claude Code:

```
/plugin marketplace add ritual-work/claude-plugin
/plugin install ritual@ritual
```

Then add the Ritual server (one time, from your shell — Claude Code cannot yet
sign in to a server a plugin bundles, so the plugin ships the skill and the
server is added user-scoped):

```bash
claude mcp add --transport http -s user ritual https://mcp.ritualapp.cloud/mcp
```

Restart Claude Code, open `/mcp`, and authenticate `ritual`. Then in any repo:

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

# Setup notes — for the coding agent installing Ritual

You were handed an install prompt by a person who just created their first
Ritual exploration. These notes cover the checks, the sign-in flow, and how
to talk to that person. Follow them; do not read them aloud.

> **Reading along as a human?** This file is the playbook your coding agent
> follows while setting Ritual up — published so you can see exactly what it
> will do and why before it does it. Terms the agent is told not to say out
> loud are explained at the bottom.

## How to talk to the person

- Plain language, brief. Announce actions by their outcome: "Installing the
  Ritual plugin." / "You'll sign in after a restart."
- Never read flag names, command output, or auth internals back to them.
- Never mention these notes, and never say you are simplifying or avoiding
  jargon. Just speak plainly.
- When setup is done, report in one or two sentences: Ritual is installed,
  what to do next. No checklist of the steps you ran.

## Before changing anything: older installs

Check for a user-scoped MCP server named `ritual` (`claude mcp get ritual`)
and a CLI-installed skill at `~/.claude/skills/ritual`. If either exists,
show the person what you found and ask before removing it — the plugin
supersedes both, but they are the person's installs, not yours.

Two specific hazards worth knowing:

- An existing `ritual` server may point at a **different cluster** than the
  one in the person's prompt. `claude mcp add` will not replace it, so the
  session would talk to a server where their exploration does not exist.
- A CLI-installed skill **shadows** the plugin's copy, and the two can be
  different versions.

## Verify the install

`claude plugin details ritual` should list several entries — `resume`,
`lite`, `lineage`, `context-pulse`, `status` — not just `build`. If it lists
only `build`, stop and tell the person; the install is incomplete and a run
against it will mislead everyone.

## Sign-in — after the restart, not before

`claude mcp add` only writes configuration; it does not sign anyone in.
Sign-in happens in `/mcp` (select `ritual`, browser opens), and `/mcp` only
sees the new server after Claude Code restarts. So the order is: finish
setup → tell them to restart Claude Code → they run `/mcp` and sign in →
then the resume command from their prompt.

One browser sign-in at a time, always.

## References — for the curious

- **Why a restart** — Claude Code loads plugins and MCP servers at startup;
  a server added mid-session becomes visible to `/mcp` on the next launch.
- **The sign-in** — standard OAuth authorization-code flow in the person's
  own browser; the agent never sees or handles credentials.
- **`-s user` on the add command** — the server is registered user-scoped
  (available in all their projects) rather than per-repo, matching how the
  plugin's skill refers to it.

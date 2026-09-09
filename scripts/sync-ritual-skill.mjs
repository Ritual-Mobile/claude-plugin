#!/usr/bin/env node
/**
 * sync-ritual-skill — pull the claude-code flavor of the Ritual build-flow
 * skill from ritual-enterprise into plugins/ritual/skills/.
 *
 * WHY THIS EXISTS (2026-08-26). A connector ships ZERO skill content: signing
 * in gives 80 tools and no flow, the documented "tools with no instructions"
 * failure. Every assistant channel packages its own synced, stamped copy of
 * the skill; this repo shipped only the per-persona command packs until now.
 * See ritual-enterprise documents/architecture/chatgpt-plugin-testing-runbook.md
 * § "Skills never travel with the connector".
 *
 * BUILDS FRESH upstream (apps/cli/scripts/build-skills.js) rather than copying
 * the committed apps/cli/skills/claude-code dir — that committed copy is a
 * build artifact and lags (found 0.36.110/fcb5602a there while the source was
 * 0.36.111/66ea3efe6c00). Same lesson as chatgpt-plugin's sync-skills.
 *
 * ALLOWLIST copy, not whole-dir: the upstream skill source dir carries
 * internal authoring artifacts (DESIGN.md, design/ screenshots, agents/
 * surface metadata, a file inventory manifest) that must not ship in a
 * public plugin. Only what the agent reads at runtime crosses over.
 *
 * CHANNEL: the upstream bundle is stamped `channel: mcp-direct` (that build
 * is what `ritual init` ships). This plugin is a different delivery path, so
 * the frontmatter is rewritten to `channel: claude-plugin` — the server's
 * ping handshake uses it to tell plugin installs from CLI installs and to
 * pick the right stale-skill remedy (marketplace update, not `ritual init`).
 *
 *   node scripts/sync-ritual-skill.mjs [path-to-ritual-enterprise]
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const upstream = process.argv[2] ?? resolve(REPO, "..", "ritual-enterprise");
const builder = join(upstream, "apps", "cli", "scripts", "build-skills.js");
if (!existsSync(builder)) {
  console.error(`✗ ritual-enterprise not found at ${upstream}`);
  process.exit(1);
}

/*
 * WHICH upstream commit, not just which directory. Building fresh beats a
 * committed artifact (see above), but neither tells you the checkout was
 * parked on someone's unmerged feature branch — and the stamp cannot, because
 * it hashes the skill SOURCE. Name the branch, and refuse anything but an
 * integration branch unless the caller insists.
 */
const gitIn = (a) =>
  execFileSync("git", a, { cwd: upstream, encoding: "utf8" }).trim();
const upstreamBranch = gitIn(["rev-parse", "--abbrev-ref", "HEAD"]);
const upstreamSha = gitIn(["rev-parse", "--short", "HEAD"]);
if (
  !["dev", "main"].includes(upstreamBranch) &&
  !process.argv.includes("--allow-branch")
) {
  console.error(
    `✗ upstream ${upstream} is on '${upstreamBranch}', not dev/main`,
  );
  console.error(
    "  syncing from a feature branch ships unreviewed skill changes.",
  );
  console.error("  pass --allow-branch if that is genuinely what you want.");
  process.exit(1);
}

console.log(
  `▶ building the agent skill bundles upstream (${upstreamBranch} @ ${upstreamSha})…`,
);
execFileSync("node", [builder], { cwd: upstream, stdio: "ignore" });

const src = join(upstream, "apps", "cli", "skills", "claude-code", "ritual");
if (!existsSync(join(src, "SKILL.md"))) {
  console.error(`✗ claude-code bundle missing at ${src}`);
  process.exit(1);
}

// Only what the agent reads at runtime. Everything else in the source dir is
// internal authoring material and stays behind.
const SHIP = ["SKILL.md", "references", ".ritual-bundle.json"];

// The skill ships as `build` (not `ritual`): plugin skills render as
// <plugin>:<skill>, so the canonical name would read /ritual:ritual. Same
// rename the chatgpt adapter makes. The dispatcher's other subcommands are
// exposed as thin plugin COMMANDS in plugins/ritual/commands/, generated
// upstream and synced below, that route into this skill.
const dest = join(REPO, "plugins", "ritual", "skills", "build");
rmSync(join(REPO, "plugins", "ritual", "skills", "ritual"), {
  recursive: true,
  force: true,
});
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const entry of SHIP) {
  const from = join(src, entry);
  if (!existsSync(from)) {
    console.error(`✗ expected bundle entry missing: ${entry}`);
    process.exit(1);
  }
  cpSync(from, join(dest, entry), { recursive: true });
}
// Public plugins share the upstream scrub policy; keep Markdown indentation intact.
const { scrubPublic } = await import(
  pathToFileURL(
    join(upstream, "packages/shared-types/scripts/lib/scrub-public.mjs"),
  ).href
);
for (const file of [
  "SKILL.md",
  ...readdirSync(join(dest, "references"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `references/${name}`),
]) {
  const path = join(dest, file);
  writeFileSync(path, scrubPublic(readFileSync(path, "utf8"), { tidy: false }));
}

// cpSync copies dotfiles inside references/ too — drop Finder junk.
execFileSync("find", [dest, "-name", ".DS_Store", "-delete"]);

/*
 * COMMANDS come from the OTHER upstream builder. The skill above is built by
 * apps/cli/scripts/build-skills.js; the subcommand commands are generated by
 * apps/mcp/scripts/build-agent-skills.mjs from apps/mcp/skills/ritual/
 * commands.json, which is also what the chatgpt channel gets — one authored
 * source, so the two plugins cannot describe the same subcommand differently.
 *
 * These were hand-written and committed here until 2026-08-28. Generated
 * output is byte-identical to what was committed, so this is a takeover, not
 * a rewrite — but from here a commands.json edit reaches both channels, and a
 * subcommand renamed in SKILL.md without a matching command fails the build
 * upstream instead of silently orphaning a slash command.
 */
const cmdBuilder = join(
  upstream,
  "apps",
  "mcp",
  "scripts",
  "build-agent-skills.mjs",
);
if (!existsSync(cmdBuilder)) {
  console.error(
    `✗ no command generator at ${cmdBuilder} — sync a newer ritual-enterprise`,
  );
  process.exit(1);
}
execFileSync("node", [cmdBuilder], { cwd: upstream, stdio: "ignore" });
const cmdSrc = join(
  upstream,
  "dist",
  "agent-skills",
  "skills",
  "claude",
  "commands",
);
if (!existsSync(cmdSrc)) {
  /* Loud, not silent: an upstream that stopped emitting commands would leave
     the last synced copies sitting here and look like a healthy build. */
  console.error(
    `✗ upstream produced no commands at ${cmdSrc} — expected since #1471`,
  );
  process.exit(1);
}
const cmdDest = join(REPO, "plugins", "ritual", "commands");
rmSync(cmdDest, { recursive: true, force: true });
cpSync(cmdSrc, cmdDest, { recursive: true });

// Tool names stay CANONICAL (mcp__ritual__*): the plugin does NOT bundle its
// MCP server — Claude Code cannot authenticate OAuth servers bundled by
// plugins (anthropics/claude-code#75961: hidden from /mcp, no auth surface),
// so the server is added user-scoped as `ritual` per the README, which is
// exactly the name the canonical skill references. Revisit bundling (and the
// mcp__plugin_ritual_<server>__ rewrite this script once did) when #75961 is
// fixed upstream.
const skillMd = join(dest, "SKILL.md");
const fm = readFileSync(skillMd, "utf8");
if (!/^channel: mcp-direct$/m.test(fm)) {
  console.error(
    "✗ upstream bundle carries no `channel: mcp-direct` frontmatter — sync a newer ritual-enterprise",
  );
  process.exit(1);
}
writeFileSync(
  skillMd,
  fm
    .replace(/^channel: mcp-direct$/m, "channel: claude-plugin")
    .replace(/^name: ritual$/m, "name: build"),
);

const stamp = /^stamp:\s*(\S+)/m.exec(fm)?.[1] ?? "unknown";
const cli = /^cli_version:\s*(\S+)/m.exec(fm)?.[1] ?? "unknown";
writeFileSync(
  join(REPO, "plugins", "ritual", ".skill-stamp.json"),
  // upstreamBranch/Sha say which commit the adapters and commands.json came
  // from — the stamp only covers the skill source and cannot.
  JSON.stringify(
    {
      stamp,
      cli_version: cli,
      channel: "claude-plugin",
      upstreamBranch,
      upstreamSha,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `✓ plugins/ritual/skills/build (stamp ${stamp}, cli ${cli}, channel claude-plugin)`,
);
console.log(
  `✓ plugins/ritual/commands (${readdirSync(cmdDest).length} commands)`,
);
console.log(
  "  next: review, bump plugins/ritual version on content change, commit.",
);

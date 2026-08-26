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
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = process.argv[2] ?? resolve(REPO, '..', 'ritual-enterprise');
const builder = join(upstream, 'apps', 'cli', 'scripts', 'build-skills.js');
if (!existsSync(builder)) {
  console.error(`✗ ritual-enterprise not found at ${upstream}`);
  process.exit(1);
}

console.log('▶ building the agent skill bundles upstream…');
execFileSync('node', [builder], { cwd: upstream, stdio: 'ignore' });

const src = join(upstream, 'apps', 'cli', 'skills', 'claude-code', 'ritual');
if (!existsSync(join(src, 'SKILL.md'))) {
  console.error(`✗ claude-code bundle missing at ${src}`);
  process.exit(1);
}

// Only what the agent reads at runtime. Everything else in the source dir is
// internal authoring material and stays behind.
const SHIP = ['SKILL.md', 'references', '.ritual-bundle.json'];

const dest = join(REPO, 'plugins', 'ritual', 'skills', 'ritual');
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
// cpSync copies dotfiles inside references/ too — drop Finder junk.
execFileSync('find', [dest, '-name', '.DS_Store', '-delete']);

// Tool names stay CANONICAL (mcp__ritual__*): the plugin does NOT bundle its
// MCP server — Claude Code cannot authenticate OAuth servers bundled by
// plugins (anthropics/claude-code#75961: hidden from /mcp, no auth surface),
// so the server is added user-scoped as `ritual` per the README, which is
// exactly the name the canonical skill references. Revisit bundling (and the
// mcp__plugin_ritual_<server>__ rewrite this script once did) when #75961 is
// fixed upstream.
const skillMd = join(dest, 'SKILL.md');
const fm = readFileSync(skillMd, 'utf8');
if (!/^channel: mcp-direct$/m.test(fm)) {
  console.error(
    '✗ upstream bundle carries no `channel: mcp-direct` frontmatter — sync a newer ritual-enterprise',
  );
  process.exit(1);
}
writeFileSync(skillMd, fm.replace(/^channel: mcp-direct$/m, 'channel: claude-plugin'));

const stamp = /^stamp:\s*(\S+)/m.exec(fm)?.[1] ?? 'unknown';
const cli = /^cli_version:\s*(\S+)/m.exec(fm)?.[1] ?? 'unknown';
writeFileSync(
  join(REPO, 'plugins', 'ritual', '.skill-stamp.json'),
  JSON.stringify({ stamp, cli_version: cli, channel: 'claude-plugin' }, null, 2) + '\n',
);
console.log(`✓ plugins/ritual/skills/ritual (stamp ${stamp}, cli ${cli}, channel claude-plugin)`);
console.log('  next: review, bump plugins/ritual version on content change, commit.');

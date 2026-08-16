#!/usr/bin/env node
/**
 * sync-snapshot.mjs — pulls canonical/plugin-snapshot.json from Ritual's
 * monorepo, the single source of truth (work-graph.ts → emit-plugin-snapshot.mjs
 * → src/generated/plugin-snapshot.json).
 *
 * This is the ONE kind of staleness `generate-packs.mjs --check` cannot see: that
 * check proves packs match the snapshot, not that the snapshot matches upstream.
 * A retired job upstream leaves both green while the packs ship a dead command.
 *
 * MAINTAINER-ONLY: the monorepo is private, so this cannot run in this repo's CI.
 * Point it at a local checkout:
 *
 *   RITUAL_MONOREPO=~/path/to/ritual-enterprise node scripts/sync-snapshot.mjs
 *   node scripts/sync-snapshot.mjs --from ~/path/to/ritual-enterprise --check
 *
 * Usage: node scripts/sync-snapshot.mjs [--check] [--from <monorepo-root>]
 *   --check : exit 1 if the committed snapshot differs from upstream (no write).
 *
 * After a sync, ALWAYS run `node scripts/generate-packs.mjs` — the snapshot alone
 * changes nothing that ships.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = join(ROOT, 'canonical', 'plugin-snapshot.json');
const UPSTREAM_REL = join('packages', 'shared-types', 'src', 'generated', 'plugin-snapshot.json');
const CHECK = process.argv.includes('--check');

function fail(msg) {
  console.error(`\n❌ sync-snapshot: ${msg}\n`);
  process.exit(1);
}
function expandHome(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

const fromFlag = process.argv.indexOf('--from');
const monorepo = fromFlag !== -1 ? process.argv[fromFlag + 1] : process.env.RITUAL_MONOREPO;
if (!monorepo) {
  fail(
    'no monorepo location given.\n' +
      '   Set RITUAL_MONOREPO=<path to ritual-enterprise> or pass --from <path>.',
  );
}

const upstreamPath = join(resolve(expandHome(monorepo)), UPSTREAM_REL);
if (!existsSync(upstreamPath)) fail(`upstream snapshot not found at ${upstreamPath}`);

const upstream = readFileSync(upstreamPath, 'utf8');
const local = existsSync(LOCAL) ? readFileSync(LOCAL, 'utf8') : null;
const sha = (s) => JSON.parse(s).sourceSha;

if (local === upstream) {
  console.log(`✓ snapshot is current with upstream (sourceSha ${sha(upstream)}).`);
  process.exit(0);
}

if (CHECK) {
  fail(
    `snapshot is STALE.\n` +
      `   local    sourceSha ${local ? sha(local) : '(missing)'}\n` +
      `   upstream sourceSha ${sha(upstream)}\n` +
      `   Sync with \`node scripts/sync-snapshot.mjs\`, then \`node scripts/generate-packs.mjs\`.`,
  );
}

writeFileSync(LOCAL, upstream);
console.log(
  `✓ synced snapshot ${local ? sha(local) : '(missing)'} → ${sha(upstream)}.\n` +
    `  Next: node scripts/generate-packs.mjs`,
);

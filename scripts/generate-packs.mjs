#!/usr/bin/env node
/**
 * generate-packs.mjs — DETERMINISTIC generator for the development-function
 * persona packs, from the canonical snapshot (canonical/plugin-snapshot.json,
 * synced from Ritual's monorepo work-graph). NO LLM.
 *
 * For each dev persona that LEADS ≥1 job, emits a pack:
 *   plugins/<persona>/.claude-plugin/plugin.json
 *   plugins/<persona>/commands/<command-name>.md   (one per LEAD job)
 *   plugins/<persona>/skills/<persona>-guide/SKILL.md   (thin discoverability)
 * and updates .claude-plugin/marketplace.json + canonical/jtbd-allowlist.json.
 *
 * Commands are job-native (`/<persona>:<command-name>`), user-invoked — zero
 * model arbitration. The command body embeds the PUBLIC Ritual orchestration
 * seeded with the job's jtbd_id + persona (an L1 projection — it points at the
 * MCP capability, never restates Ritual's internal flow), and degrades to
 * build-discipline when Ritual isn't connected.
 *
 * Usage: node scripts/generate-packs.mjs [--check]
 *   --check : exit 1 if any committed pack file is stale (CI guard).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(ROOT, 'canonical', 'plugin-snapshot.json');
const ALLOWLIST = join(ROOT, 'canonical', 'jtbd-allowlist.json');
const MARKETPLACE = join(ROOT, '.claude-plugin', 'marketplace.json');

const AUTHOR = { name: 'Ritual', url: 'https://ritual.work' };
const COMMON = {
  author: AUTHOR,
  homepage: 'https://ritual.work',
  repository: 'https://github.com/ritual-work/claude-plugin',
  license: 'MIT',
};
// dev-backend-services is REPLACED by the generated dev packs.
const REMOVED_PACKS = new Set(['dev-backend-services']);

function fail(msg) {
  console.error(`\n❌ generate-packs: ${msg}\n`);
  process.exit(1);
}
function titleCase(s) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
/** Preserve an existing plugin.json's version so regen doesn't churn versions. */
function existingVersion(persona, fallback) {
  const p = join(ROOT, 'plugins', persona, '.claude-plugin', 'plugin.json');
  return existsSync(p) ? readJson(p).version ?? fallback : fallback;
}

const snapshot = readJson(SNAPSHOT);
if (snapshot.function !== 'development') fail(`unexpected snapshot function ${snapshot.function}`);

const files = new Map(); // path -> string content

for (const pack of snapshot.personas) {
  const { persona, label, commands } = pack;
  const version = existingVersion(persona, '0.1.0');

  // plugin.json
  files.set(join('plugins', persona, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: persona,
    displayName: `Ritual — ${label}`,
    version,
    description:
      `Role pack for ${label.toLowerCase()}s. Job-native commands for ${label.toLowerCase()} work — ` +
      `discovery commands scope a job into a decision-ready Ritual brief before you build; standalone ` +
      `check commands run a local recipe (no Ritual needed). Depends on build-discipline.`,
    ...COMMON,
    keywords: ['ritual', 'agentic-coding', persona, 'discovery'],
    dependencies: ['build-discipline'],
  }, null, 2) + '\n');

  // commands/<name>.md — one per job (discovery or standalone)
  for (const cmd of commands) {
    if (cmd.mode === 'standalone') {
      const checklist = cmd.recipe.map((r) => `- [ ] ${r}`).join('\n');
      files.set(join('plugins', persona, 'commands', `${cmd.commandName}.md`), `---
description: ${cmd.summary}
---

# ${label}: ${titleCase(cmd.commandName)}

${cmd.summary} A **standalone check** — it runs a local recipe; **no Ritual
discovery engine needed**.

What to review: $ARGUMENTS

**Apply the build-discipline posture** — surface assumptions, define what "good"
means here, keep it surgical, and verify against the checklist.

## Run it
1. Read the request through the **${label}** lens (job: \`${cmd.jtbdId}\`).
2. Surface assumptions + the success criteria for this review.
3. Work the checklist against the code/surface under review:
${checklist}
4. Verify each item — confirmed present, or raised as an explicit gap (note the file/line).
   **Done when:** ${cmd.doneCriteria}
5. **Escalate to Ritual discovery** (\`ritual build\`, or this pack's discovery
   commands) ONLY if the task turns out ambiguous, cross-functional, or needs
   constraints that live outside the code — say so rather than guessing.

No Ritual connection is required for this check.
`);
      continue;
    }
    const sections = cmd.sections.map((s) => `- ${s}`).join('\n');
    const body = `---
description: ${`Scope "${titleCase(cmd.jtbdId)}" as a ${label} — produces a ${cmd.deliverableTemplate} (a decision-ready brief, not code).`}
---

# ${label}: ${titleCase(cmd.commandName)}

Scope **${titleCase(cmd.jtbdId)}** through the ${label} lens — a Ritual discovery
command that produces a **${cmd.deliverableTemplate}** (a decision-ready brief,
not code), then folds that brief into plan mode before any implementation. When
Ritual is connected this is the same flow as \`ritual build\`, seeded for this job.

The user's request: $ARGUMENTS

**Apply the build-discipline posture throughout** — surface assumptions, define
success criteria, keep changes surgical, and verify the constraints survived.
(\`build-discipline\` is this pack's dependency + offline fallback; its posture is
woven into the steps below, so you don't rely on it firing ambiently.)

## 1 · Frame — before Ritual
- Read the request through the **${label}** lens and this job (**${cmd.jtbdId}**).
- Surface assumptions, missing inputs, constraints, and anti-goals — state them
  explicitly; never silently guess a load-bearing ambiguity.
- Establish the success criteria for the deliverable.

## 2 · Discover — run Ritual (MCP is the runtime)
Discovery runs on the **Ritual MCP**. Check, in order:
1. **Ritual MCP available** (\`mcp__ritual__*\` tools present)? → **use it.** Create
   an exploration for the request seeded with **jtbd \`${cmd.jtbdId}\`** under the
   **${persona}** lens, focused on the ${label} sections below; walk discovery →
   recommendations → build brief (poll
   \`get_exploration_status.recommendationsStatus\` until \`ready\`), review the
   recommendations, and fold the returned brief into plan mode. Same experience
   as \`ritual build\` today.
2. **Only the \`ritual\` CLI is present** (MCP not wired yet)? → the CLI is the
   **setup path**: \`ritual init\` authenticates + connects the MCP, then re-run
   this command. The CLI is how you install/connect/repair Ritual — not a runtime
   dependency.
3. **Neither** → Ritual isn't connected this session. Say so plainly and offer the
   one-step setup (don't imply the CLI is always required — a user may already
   have the MCP wired via a custom connector / Claude Code MCP config, in which
   case step 1 applies):
   \`\`\`
   ritual init   # authenticate, connect the Ritual MCP, install recommended plugins
   \`\`\`
   While not connected, offer to either (a) continue with a local checklist only,
   or (b) stop here until Ritual is connected. Don't proceed as if the missing
   context were resolved.

## 3 · Verify — after Ritual
- Confirm the resulting brief/output preserves the original constraints + success
  criteria.
- Explicitly list any unresolved assumptions, questions, or risks. Don't proceed
  as if uncertain points are resolved.

## What you contribute (${label} sections)
${sections}

The full ${cmd.deliverableTemplate} composes ${cmd.composedSectionCount} sections
across every contributing lens; the above are the ${label}'s own. Speak in the
practitioner's language — the work and its outcome, never routing internals.
`;
    files.set(join('plugins', persona, 'commands', `${cmd.commandName}.md`), body);
  }

  // thin discoverability guide skill
  const cmdList = commands.map((c) => `- \`/${persona}:${c.commandName}\` — ${titleCase(c.jtbdId)}`).join('\n');
  files.set(join('plugins', persona, 'skills', `${persona}-guide`, 'SKILL.md'), `---
name: ${persona}-guide
description: >-
  Discoverability for the ${label} pack. When a task reads like ${label} work
  that needs scoping before building, point the user to the matching job-native
  command below. This skill does NOT run discovery itself — the commands do.
---

# ${label} — pack guide

When a task looks like ${label} work, the right entry is a **job-native command**
(user-invoked, no guessing). Suggest the closest match:

${cmdList}

Each command scopes its job into a decision-ready Ritual brief (not code) and
degrades cleanly when Ritual isn't connected. If none fit, defer to
**build-discipline** for generic tiering.
`);
}

// allowlist = snapshot ∪ what the hand-authored leaf registries actually use
// (preserves product/marketing entries; a jtbd retired upstream and used by no
// registry drops out instead of lingering forever).
function registryUsage() {
  const jtbds = new Set();
  const people = new Set();
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'leaf-registry.json') {
        for (const l of readJson(p).leaves ?? []) {
          if (l.jtbd_id) jtbds.add(l.jtbd_id);
          if (l.persona) people.add(l.persona);
        }
      }
    }
  };
  walk(join(ROOT, 'plugins'));
  return { jtbds, people };
}
const existingAllow = readJson(ALLOWLIST);
const used = registryUsage();
const jtbd_ids = [...new Set([...snapshot.allowlist.jtbdIds, ...used.jtbds])].sort();
const personas = [...new Set([...snapshot.allowlist.personas, ...used.people])].sort();
files.set(join('canonical', 'jtbd-allowlist.json'), JSON.stringify({
  _comment: existingAllow._comment,
  jtbd_ids,
  personas,
}, null, 2) + '\n');

// marketplace: keep build-discipline + non-dev/non-removed packs; insert dev packs.
const market = readJson(MARKETPLACE);
const devPersonas = new Set(snapshot.personas.map((p) => p.persona));
const base = market.plugins.find((p) => p.name === 'build-discipline');
const kept = market.plugins.filter(
  (p) => p.name !== 'build-discipline' && !devPersonas.has(p.name) && !REMOVED_PACKS.has(p.name),
);
const devEntries = snapshot.personas.map((pack) => {
  const pj = JSON.parse(files.get(join('plugins', pack.persona, '.claude-plugin', 'plugin.json')));
  return {
    name: pack.persona,
    source: `./plugins/${pack.persona}`,
    description: pj.description,
    version: pj.version,
    ...COMMON,
    keywords: pj.keywords,
    category: 'productivity',
  };
});
files.set(join('.claude-plugin', 'marketplace.json'), JSON.stringify({
  ...market,
  plugins: [...(base ? [base] : []), ...devEntries, ...kept],
}, null, 2) + '\n');

// ---- orphans: files inside a generated pack dir that the snapshot no longer
// emits (e.g. a command whose job was retired upstream). Those dirs are 100%
// generated, so anything not in `files` is stale by construction.
function orphanFiles() {
  const out = [];
  const walk = (rel) => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const child = join(rel, e.name);
      if (e.isDirectory()) walk(child);
      else if (!files.has(child)) out.push(child);
    }
  };
  for (const pack of snapshot.personas) walk(join('plugins', pack.persona));
  return out;
}
const orphans = orphanFiles();

// ---- apply or check ----
if (process.argv.includes('--check')) {
  const stale = [];
  for (const [rel, content] of files) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs) || readFileSync(abs, 'utf8') !== content) stale.push(rel);
  }
  // a removed pack still present = stale
  for (const name of REMOVED_PACKS) {
    if (existsSync(join(ROOT, 'plugins', name))) stale.push(`plugins/${name} (should be removed)`);
  }
  for (const rel of orphans) stale.push(`${rel} (no longer in the snapshot — should be removed)`);
  if (stale.length) {
    fail('packs are STALE — regenerate with `node scripts/generate-packs.mjs`:\n  ' + stale.join('\n  '));
  }
  console.log(`✓ packs in sync with the snapshot (${files.size} files).`);
  process.exit(0);
}

for (const name of REMOVED_PACKS) {
  const dir = join(ROOT, 'plugins', name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
for (const rel of orphans) rmSync(join(ROOT, rel), { force: true });
for (const [rel, content] of files) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}
console.log(
  `✓ generated ${snapshot.personas.length} dev packs (${snapshot.commandCount} commands), ` +
    `removed [${[...REMOVED_PACKS].join(', ')}]${
      orphans.length ? ` + ${orphans.length} orphan file(s): ${orphans.join(', ')}` : ''
    }, updated marketplace + allowlist.`,
);

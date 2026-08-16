# Contributing

## The packs are generated — don't hand-edit them

Everything under `plugins/<persona>/` is generated from `canonical/plugin-snapshot.json`
by `scripts/generate-packs.mjs`. That snapshot is emitted by Ritual's monorepo from
`work-graph.ts`, the single source of truth for the job taxonomy. Editing a command
file by hand works right up until the next regeneration silently reverts it.

`build-discipline`, `product`, and `marketing` are hand-authored and outside the
generator's reach.

## Re-syncing after a taxonomy change

When a job is added, renamed, or retired in the monorepo, this repo does not find out
on its own. Re-sync it:

```bash
RITUAL_MONOREPO=<path to ritual-enterprise> npm run resync
```

That runs sync → generate → check → validate. Then commit and open a PR. If a
user-facing command appeared or disappeared, bump the affected pack's `version` in
`plugins/<persona>/.claude-plugin/plugin.json` and re-run `npm run generate` so the
marketplace entry picks it up.

Individual steps, if you want them:

| Command | What it proves / does |
| --- | --- |
| `npm run sync` | Pull the snapshot from the monorepo |
| `npm run sync:check` | Is `canonical/` behind the monorepo? |
| `npm run generate` | Regenerate the packs from the snapshot |
| `npm run check` | Do the committed packs match the snapshot? |
| `npm run validate` | Do the hand-authored leaf registries use canonical ids? |

## Why `npm run check` is not enough

`check` proves the packs match the **committed** snapshot. It says nothing about
whether that snapshot is current — so it passes happily while this repo ships
commands for jobs retired months ago. That is not hypothetical: between monorepo
#977 and #1209 the `developer` pack kept shipping `/developer:plan-implementation`
for `create-implementation-plan`, retired in #1013, with CI green the whole time.

`sync:check` is the one that catches it, and it can only run against a local
monorepo checkout — the monorepo is private, so this repo's CI cannot do it. The
automated backstop lives on the monorepo side (`claude-plugin-sync-guard.yml`),
which compares its emitted `sourceSha` against this repo's `main` after every
work-graph change and weekly. If that guard goes red, the fix is `npm run resync`
here.

## What CI does check

`.github/workflows/validate.yml` runs `npm run check` and `npm run validate` on every
push and PR. `check` fails on three things: a pack file that drifted from the
snapshot, a pack directory that should have been removed, and a command file the
snapshot no longer emits — the last of which is how a retired job leaves behind a
dead but still-installable command.

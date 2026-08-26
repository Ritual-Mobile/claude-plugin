# Contributing

## The skill is synced — don't hand-edit it

Everything under `plugins/ritual/skills/` is generated from Ritual's canonical skill
source and copied here by `scripts/sync-ritual-skill.mjs`. Editing a synced file by
hand works right up until the next sync silently reverts it. Report skill-content
issues on this repo; fixes land upstream and arrive with the next sync.

`plugins/ritual/.skill-stamp.json` records which skill content a checkout carries
(`stamp`), the version of the CLI that built it (`cli_version`), and the delivery
channel (`claude-plugin`). The `/ritual` skill reports the same values to the Ritual
server once per session so stale installs can be detected.

## Releasing an update

1. Run `npm run sync` (maintainers only — requires the upstream source).
2. Review the diff; bump `version` in `plugins/ritual/.claude-plugin/plugin.json`
   and `.claude-plugin/marketplace.json` when skill content changed.
3. Open a PR. On merge, installed copies pick up the change via
   `/plugin marketplace update ritual` + `/plugin update ritual@ritual`.

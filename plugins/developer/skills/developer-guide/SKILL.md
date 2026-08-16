---
name: developer-guide
description: >-
  Discoverability for the Developer pack. When a task reads like Developer work
  that needs scoping before building, point the user to the matching job-native
  command below. This skill does NOT run discovery itself — the commands do.
---

# Developer — pack guide

When a task looks like Developer work, the right entry is a **job-native command**
(user-invoked, no guessing). Suggest the closest match:

- `/developer:understand-codebase` — Understand Codebase Area
- `/developer:integrate-api` — Integrate Api
- `/developer:build-docs-site` — Create Docs Site
- `/developer:refactor-code` — Refactor Code
- `/developer:debug-production-issue` — Debug Production Issue
- `/developer:improve-performance` — Improve Performance
- `/developer:add-tests` — Add Tests
- `/developer:prepare-release` — Prepare Release
- `/developer:build-spike` — Build Technical Spike

Each command scopes its job into a decision-ready Ritual brief (not code) and
degrades cleanly when Ritual isn't connected. If none fit, defer to
**build-discipline** for generic tiering.

# Upstream v0.4.0 Integration Implementation Plan

> **For agentic workers:** Use executing-plans for this tightly coupled integration; review the complete merge before handing it back.

**Goal:** Integrate upstream v0.4.0 while preserving all current fork features and performance.
**Architecture:** Checkpoint the dirty fork, create an integration branch from that checkpoint, merge the exact upstream release, resolve three known conflicts, verify semantics and performance. No new architecture or product behavior beyond the approved spec.
**Tech Stack:** Next.js, React, TypeScript, Electron, existing browser harnesses.
**Spec:** docs/superpowers/specs/2026-10-31-upstream-v040-integration-design.md (approved by user: «реализуй»).

## Global constraints

- Target commit: dc4c398d5167865b84b0ccb3ec809eb88bf8f65f (v0.4.0).
- Preserve current dirty files; checkpoint includes tracked and untracked source/tests/docs, not generated work artifacts or secrets.
- Preserve presets, teacher/check instructions, demoBuilder Kimi Coding k3-256k/max, inline demos, Kroki, width rails, performance, manual scroll priority, legacy compatibility.
- No push, publication, installed-app replacement, live model calls or changes to real user histories/settings.
- Keep private backup outside Git. Use a copy with LH_DATA_DIR for data checks.
- No concurrent build during performance measurement. Three paired samples against checkpoint, not pristine upstream.

## Task 1: Safe baseline and integration

- [ ] Read spec, AGENTS.md, local-macos-build.md, current Git status and work/ui-performance-ultra/REPORT.md. Record exact status and source hashes in work/upstream-v040/.
- [ ] Inventory untracked files with `git ls-files --others --exclude-standard`; inspect source/docs/tests for secrets/generated artifacts before staging. Do not stage work/ wholesale.
- [ ] Make owner-only backup of real LearnHarness data outside repo; record path only, never contents or credentials. Detect active writers; do not write real data during tests.
- [ ] Commit approved fork checkpoint. Record SHA; create integration branch from it. Obtain baseline performance fixtures from this checkpoint with identical synthetic data for both revisions.
- [ ] Install dependencies via npm ci; read relevant local Next docs before code changes.
- [ ] Collect three baseline runs of input/streaming/drag/history, runtime Formula/SVG, startup JS using existing work/ui-performance-ultra harnesses. Inspect each harness for old-baseline selection and output overwrite before reuse; adapt task-local copies to current checkpoint. Retain commands and results.
- [ ] `git merge --no-commit --no-ff dc4c398d5167865b84b0ccb3ec809eb88bf8f65f`.
- [ ] Resolve components/chat.tsx: retain memoized transcript and InlineVisualText; apply upstream `PathText` to learner text inside that transcript; retain new retry/pending/dock logic. Do not restore a duplicate messages.map.
- [ ] Resolve components/settings/agent-section.tsx: upstream shared model catalog plus readPrompts/presets and demoBuilder slot. Remove stale modelsMounted/readModels references if upstream replaced their declarations. Retain catalog error/retry and custom vision-model behavior.
- [ ] Resolve src/server/index.ts by retaining both preset and upstream Claude/custom-provider exports.
- [ ] Inspect clean merges in package.json, teacher-agent.ts, headless.ts, core barrels/settings-resolution, chat-handler.ts and tests. Preserve build:visuals scripts; lockfile matches upstream dependency additions.
- [ ] Check `git diff --check`, no conflict markers; run typecheck and repair integration-only errors without changing approved behavior.

## Task 2: Verification and completion

- [ ] Run full unit tests with isolated LH_DATA_DIR/LH_AUTH_FILE, typecheck, lint, production build. Capture exit status and logs. Diagnose failures using existing regression assertions; add a focused test if a merge error was not covered.
- [ ] Run smoke-provider-runtime, build-server, smoke-server plus upstream compression/image/file-path/opening-prompt smoke scripts according to their documented invocation; inspect prerequisites first.
- [ ] Run current browser runtime, width, motion, wheel, Kroki and upstream UI regressions. Use documented repo browser scripts; keep all data synthetic. Check long dock/short window, file-chip keyboard input, pending drafts/Retry, math `<`, lazy Mermaid failure/retry, inline state preservation.
- [ ] On private data copy verify sessions and prompt overrides unchanged; Russian → Default → Russian; demoBuilder model/max; no automatic new-provider opt-in. Never log private content.
- [ ] Collect three after-merge performance runs with same fixtures/environment and paired baseline runs where needed. Compare input/history renders, streaming, drag, Formula/SVG, startup JS. Investigate reproducible regression beyond baseline spread; keep all animations.
- [ ] Write work/upstream-v040/REPORT.md with exact SHAs, resolution decisions, tests, numerical comparisons, backup/checkpoint paths and unverified boundaries. Include all spec acceptance items as passed/failed/unverified, not inferred.
- [ ] Commit verified merge and any targeted regression tests; do not push or reinstall. Keep checkpoint and integration branch. Do not erase test evidence. Stop task-owned processes; remove only task-created transient build output as required by local policy, retaining report/evidence.
- [ ] Parent performs independent merge/spec review; address important findings and re-run only affected verification.

# Upstream v0.6.1 integration analysis

Date: 2026-11-18. Status: approved upstream integration resolved and validated for fork main.

## Baseline and scope

- Fork: https://github.com/reznikily/learnharness, `main` at `95ffd0e9`.
- Previous upstream baseline: `v0.4.0`, `dc4c398d5167865b84b0ccb3ec809eb88bf8f65f`.
- Target: exactly `v0.6.1`, `cb25c8e49b85eed9e78315584731cad73a0118a6`.
- Upstream range: 333 commits and 893 changed files, including plugins, examples, documentation, and tests.
- `git merge-tree --write-tree HEAD v0.6.1` reports 32 files with textual conflicts. It does not modify the checkout.
- User approved merging current source, tests, and documentation first, keeping `work/` local, then analyzing and integrating this release. Conflicting behavior decisions return to the user.

## Current fork validation

The first merge fast-forwarded fork main from `3dc88472` to `95ffd0e9`. The new checkpoint contains 69 changed files. Validation used a clean temporary source copy with byte-for-byte equality checked against the checkout, excluding local `work/` artifacts.

- `npm ci`: installed the locked dependencies.
- `npm test`: 2,995 passed, zero failures or skips.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run build`: compiled successfully but initially exited on Next.js's security advisory; the unchanged retry passed. Next.js 16.4.3 remains pinned and the advisory is unresolved.
- Provider-runtime smoke: passed with zero network attempts.
- Standalone server smoke: passed under host Node and Electron's bundled Node.
- Native rendering/browser-service suite under Electron: 25 passed.
- Existing motion-feedback and chat-width browser suites: passed. Motion required its screenshot output directory to exist.
- Electron's automatic download failed. The official v44.9.3 arm64 archive was downloaded with curl and verified against the package's SHA-256 checksum before final validation.

No installed application or user data was changed.

## Release changes

### 0.4.1

Folder and multi-file note imports, selectable-text PDF imports, persistent source folders, keyboard navigation and source deletion controls. Local input drafts reduce typing work. Model slots gain cache-retention preferences and session stats gain observed cache-hit rates. Malformed questions gain explicit recovery. Claude gets held-question timeout and bare-tool-call recovery fixes.

### 0.5.0

Composer file/folder attachments, learner image snapshots and annotations, optional folder restrictions for file tools, protected credential/transcript paths, and hidden-file filtering. Search adds Exa, Firecrawl, and hosted Ollama. Store writes become atomic. Claude sessions isolate unrelated local instructions and guard against missing teaching prose. Practice pending-state and event-adoption fixes are included.

### 0.6.0

A plugin platform ships four disabled-by-default core plugins: Flashcards, Coding Questions, Drawing Pad, and Rich Code Blocks. New themes include light palettes, color customization, import/export, and a code-ligatures switch. Side conversations and citations retain the main lesson position and share completed helper exchanges with the tutor. Reasoning-aware compaction estimates are opt-in.

Builds now prepare core plugins and the downloadable authoring package; source setup requires `npm run plugins:setup`. Security changes include private-network restrictions for research fetches, blocked remote Markdown images, native-only SVG rendering, constrained external-link schemes, and localhost/same-origin checks for source-mode servers.

### 0.6.1

Typing-latency fixes; Flashcards host-session forwarding for OpenCode Go; preservation of concurrent skips, dismissals, direction changes and pause state during compaction; conservative encoded-code-fence recovery; nested llama.cpp context metadata; Nix Claude discovery. Graph and Chains statements gain Markdown/math/code rendering, graph cards reposition after content growth, wide tables wrap, and graph snapshots avoid repeated source-map reads.

The release notes still identify the reasoning-chain premise-loss limitation and do not claim to fix the prior notes-import timeout or audit-recovery issues.

## Integration decisions

All three behavior decisions are approved for implementation.

1. **Compaction, approved 2026-11-18:** adopt upstream's insertion of the summary before concurrently appended messages, retain the fork's manual endpoint, and extend its tests to that contract. The fork currently aborts on any message change. An automatic merge retains both policies and duplicate imports, so it is not correct without deliberate reconciliation.
2. **Visual tools, approved 2026-11-18:** keep the fork's unified component builder for ordinary demo/visual calls; route visual calls containing a learner image through upstream's snapshot/SVG annotation path. Tool descriptions and image instructions must agree with this routing.
3. **Code recovery, approved 2026-11-18:** retain the fork's recovery semantics. Direct execution confirmed that both sides recover the fork's Refal example. Upstream decodes fully JSON-escaped blocks that the fork leaves alone, but leaves partially escaped quoted JavaScript unrecovered and can interpret literal `\\nabla` in an encoded TeX fence as a newline. Selecting upstream semantics would therefore change existing regressions and displayed code.

## Integration implementation

- Combined upstream plugin submissions, side conversations, images, and malformed-question recovery with the fork's memoized transcript, stable context values, inline visuals, width rails, and motion effects.
- Preserved named prompt presets and the separate demo-builder model slot while adding upstream cache-retention controls, search engines, plugin worker controls, and prompt-usage labels.
- Kept Pi 1.5.0 and Gemini foreign-history handling alongside upstream cache-retention options.
- Preserved fork Claude replay and timeout changes alongside upstream instruction isolation, tool recovery, session routing, and context-budget fixes.
- Combined plugin build steps with visual-runtime preparation and verified the lockfiles and standalone tracing.
- Reviewed automatically merged files and textual conflicts, including compaction, session-core, prompt composition, subagent routing, settings resolution, and CSS.

## Sources

- https://github.com/amosblomqvist/learnharness/releases/tag/v0.4.1
- https://github.com/amosblomqvist/learnharness/releases/tag/v0.5.0
- https://github.com/amosblomqvist/learnharness/releases/tag/v0.6.0
- https://github.com/amosblomqvist/learnharness/releases/tag/v0.6.1
- Local Git range, merge-tree preview, source inspection, and direct execution of both code-recovery implementations.

## Integration validation

Validation ran against a temporary source copy, verified byte-for-byte against all tracked checkout files.

- Application tests: 5,368 passed, zero failures; two Windows-specific tests skipped on macOS.
- Plugin tests: 388 passed across all five plugin packages. Coding Questions' time-budgeted partial-parser test initially failed during concurrent heavy checks; the isolated test and a complete unchanged package rerun passed.
- Typecheck passed. Lint passed with one upstream warning about a `<head>` element in `tests/source-name-ui.test.tsx`.
- Production build, core plugin bundles, and plugin authoring archive passed on an unchanged retry. The first build again stopped at Next.js 16.4.3's security-advisory gate after compilation. The advisory remains unresolved; this integration does not upgrade Next.js beyond the fork's locked dependency.
- Native PDF/SVG/browser-service tests under Electron: 33 passed.
- Motion-feedback and chat-width browser suites passed. The motion suite caught a bypass of the fork's success signal in upstream's new submission route; signaling now lives in the shared accepted-answer path. Browser fixtures now supply upstream theme and side-conversation data.
- Plugin SDK lockfiles were regenerated for retained Pi 1.5.0 and verified with clean `npm ci` installs. Plugin dependency installation reported high-severity audit findings; dependency security remediation is not part of this release integration.
- Provider-runtime smoke passed with zero network attempts. Standalone server smoke passed under host Node and Electron, including compression, all four core plugins, and external-plugin activation/disable with preserved data.
- Visual browser suites passed: runtime sandbox/interactions, rendering performance, resize/motion, all 128 wheel timing/viewport combinations plus keyboard and touch, and offline Mermaid/PlantUML rendering in both themes.

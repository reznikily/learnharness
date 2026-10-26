# Agent prompt presets

Approved behavior: each named preset holds its own Markdown replacements. Present
texts override their matching current source segments; missing segments use the
current source. Default selects no overrides and preserves all presets. Selection
applies to the next message in existing and new chats, including practice.

Settings → Agent → System prompts offers selection, creation of an empty preset,
rename, deletion, and the existing text editor. Switching with unsaved edits asks
before discarding them. Deleting the selected preset returns to Default.

Persist names, texts and active selection together in data/prompts/presets.json,
using an atomic file replacement. On first use, copy every legacy override into
an active Russian preset; keep original Markdown files. With no legacy overrides,
start on Default. A persisted empty list prevents repeated migration. Corrupt
preset data fails visibly rather than being overwritten.

The store owns persistence. The server passes a snapshot of active texts into the
agent factory each turn; the agent retains source discovery and composition.
Legacy override APIs remain available for compatibility, but do not modify presets.
Presets live in LH_DATA_DIR, outside the source tree; upstream changes to missing
segments appear automatically. Overrides for removed segments remain saved but
are not composed.

Validation: migration idempotence and source preservation, independent texts,
Default roundtrip, empty replacements, unknown segments/IDs and invalid names,
route integration, prompt composition, typecheck/lint, and browser CRUD roundtrip.

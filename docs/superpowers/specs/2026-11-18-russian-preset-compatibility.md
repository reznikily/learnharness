# Russian preset compatibility with v0.6.1

The owner approved targeted updates while preserving the custom teaching prompts and style, and selected a dedicated editable side-helper fragment.

- Retain all teaching, probing, and practice doctrine except the sentences that describe visual routing and allowed practice problem tools.
- Distinguish ordinary inline visuals from learner-image annotations, which display automatically. Translate the new image and recorded-side-conversation fragments.
- Allow enabled plugin problem tools in practice while preserving the single-active-problem and explicit-next-problem rules.
- Add `side-chat/80-voice.md` as an editable preset fragment. Its default is empty. Copy the existing Russian style, accuracy, and formatting guidance verbatim into the Russian preset's fragment; leave the main agents' style text unchanged.
- Resolve side-helper shared fragments and its dedicated fragment from the active preset on every request. Missing keys use current defaults; empty overrides remain empty. Keep the fixed side-helper base and final brevity rules outside preset editing.
- Test preset activation, default restoration, empty overrides, missing-key fallback, side-only isolation, and retained spoiler/brevity rules. Verify the installed Settings editor and update the app using the documented local-build procedure.

The installed preset is user data. Apply guarded, atomic updates only to the Russian preset, preserving its identity and active selection. Do not commit its complete private contents. Keep source tests and this implementation record in the repository.

## Validation

The clean verification copy passed 5,371 application tests, with two Windows-only skips, typecheck, lint with its existing upstream warning, the production build, provider-runtime smoke, and the packaged-server smoke under Electron. The first build stopped at the known Next.js 16.4.3 advisory gate; the unchanged retry passed. The advisory remains unresolved.

Preset composition checks confirmed that 19 existing fragments are unchanged, only the approved sentences in the teacher and practice fragments changed, and the dedicated side guidance retains spoiler protection and final brevity. Private preset contents are kept outside the repository and build source tree.

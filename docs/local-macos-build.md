# Local macOS fork build

The installed target is /Applications/LearnHarness.app. Its user data remains in
~/Library/Application Support/LearnHarness; never remove that directory during
build cleanup. Original prompt Markdown files are retained after preset migration.

Use next build, scripts/smoke-provider-runtime.mjs, scripts/build-server.mjs and
scripts/smoke-server.mjs before electron-builder. Build --mac --arm64 --dir
--publish never: no installers needed for a local update. Override the build icon
to build/icon.icns when Xcode's Icon Composer compiler is unavailable.

For a local ad-hoc signature (mac.identity="-", mac.notarize=false), copy the
repository entitlements and add com.apple.security.cs.disable-library-validation.
Keep allow-jit and audio-input. Without the library-validation exception, the
hardened-runtime executable aborts at launch with DYLD "different Team IDs".
This exception is for the local app only, not a global macOS setting.

The --dir build may omit Resources/app-update.yml. Supply a GitHub feed for
reznikily/learnharness and updaterCacheDirName: learnharness-fork-updater before
signing; never leave the fork tracking the author's automatic updates. Updates
require a separately published compatible fork release.

Quit the running app, retain the old bundle only until verification, and install
the new one. Verify codesign --verify --deep --strict AND real app launch: signature
verification alone did not catch the DYLD issue. Verify Settings → Agent → System
prompts, Russian → Default → Russian, and original session/override preservation.
Then remove the old bundle, .next, dist, build-only node_modules, task-owned
preview data/logs and downloaded Electron zip. Leave no temporary build config.

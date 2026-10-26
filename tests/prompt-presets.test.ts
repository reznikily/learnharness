import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-presets-"));
process.env.LH_DATA_DIR = dir;
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const { effectivePromptSegments } = await import("../src/agent/prompt-segments.ts");

it("a preset replaces present texts, including empty text, and falls back for missing files", () => {
	const view = effectivePromptSegments("teacher", {}, { "system-prompt.md": "Русский", "teacher/20-teaching.md": "" });
	assert.equal(view.find(s => s.path === "system-prompt.md")?.overrideText, "Русский");
	assert.equal(view.find(s => s.path === "system-prompt.md")?.enabled, true);
	assert.equal(view.find(s => s.path === "teacher/20-teaching.md")?.enabled, true);
	assert.equal(view.find(s => s.path === "shared/10-voice.md")?.enabled, false);
});

it("migrates all legacy texts once; switching and editing isolates presets without deleting originals", async () => {
	const { promptOverrides } = await import("../src/store/prompt-overrides.ts");
	promptOverrides.writeOverride("system-prompt.md", "Русский");
	const { readPromptPresets, updatePromptPresets, activePromptTexts } = await import("../src/store/prompt-presets.ts");
	const migrated = readPromptPresets();
	assert.equal(migrated.presets[0]?.name, "Russian");
	const russian = migrated.activeId;
	assert.ok(russian);
	assert.equal(activePromptTexts()["system-prompt.md"], "Русский");
	updatePromptPresets({ action: "activate", id: null });
	assert.deepEqual(activePromptTexts(), {});
	assert.equal(readPromptPresets().activeId, null, "migration must not reactivate Russian");
	const created = updatePromptPresets({ action: "create", name: "Other" });
	const other = created.activeId;
	assert.ok(other);
	updatePromptPresets({ action: "write", id: other, path: "system-prompt.md", text: "Other text" });
	assert.equal(activePromptTexts()["system-prompt.md"], "Other text");
	updatePromptPresets({ action: "activate", id: russian });
	assert.equal(activePromptTexts()["system-prompt.md"], "Русский");
	updatePromptPresets({ action: "rename", id: russian, name: "Russian renamed" });
	assert.equal(readPromptPresets().presets.find(p => p.id === russian)?.name, "Russian renamed");
	assert.throws(() => updatePromptPresets({ action: "write", id: russian, path: "../evil.md", text: "bad" }));
	assert.throws(() => updatePromptPresets({ action: "activate", id: "missing" }));
	assert.throws(() => updatePromptPresets({ action: "create", name: " " }));
	updatePromptPresets({ action: "removeText", id: other, path: "system-prompt.md" });
	assert.deepEqual(readPromptPresets().presets.find(p => p.id === other)?.texts, {});
	updatePromptPresets({ action: "delete", id: russian });
	assert.deepEqual(activePromptTexts(), {});
	assert.equal(promptOverrides.readOverride("system-prompt.md"), "Русский");
});

it("API rejects invalid input, exposes persisted selection, and composes that selection", async () => {
	const { POST } = await import("../app/api/settings/prompt-presets/route.ts");
	const { GET } = await import("../app/api/settings/prompts/route.ts");
	const { composeInstructions, createTeacherAgent } = await import("../src/agent/teacher-agent.ts");
	const { activePromptTexts } = await import("../src/store/prompt-presets.ts");
	const post = (body: unknown) => POST(new Request("http://test/api/settings/prompt-presets", { method: "POST", body: JSON.stringify(body) }));
	assert.equal((await post({ action: "create", name: "" })).status, 400);
	const created = await post({ action: "create", name: "API preset" });
	assert.equal(created.status, 200);
	const { activeId } = await created.json();
	assert.equal((await post({ action: "write", id: activeId, path: "teacher/999-absent.md", text: "invalid" })).status, 400);
	assert.equal((await post({ action: "write", id: activeId, path: "system-prompt.md", text: "UNIQUE PRESET TEXT" })).status, 200);
	assert.ok(composeInstructions("teacher", {}, activePromptTexts()).includes("UNIQUE PRESET TEXT"));
	const { createFauxCore } = await import("@earendil-works/pi-ai");
	const faux = createFauxCore({});
	const engine = { model: faux.getModel(), streamFn: faux.streamSimple };
	assert.ok(createTeacherAgent(undefined, { engine, promptTexts: activePromptTexts() }).state.systemPrompt.includes("UNIQUE PRESET TEXT"));
	const view = await (await GET()).json();
	assert.equal(view.activeId, activeId);
	assert.equal(view.teacher.find((s: {path: string}) => s.path === "system-prompt.md").enabled, true);
	await post({ action: "activate", id: null });
	assert.ok(!composeInstructions("teacher", {}, activePromptTexts()).includes("UNIQUE PRESET TEXT"));
	assert.ok(!createTeacherAgent(undefined, { engine, promptTexts: activePromptTexts() }).state.systemPrompt.includes("UNIQUE PRESET TEXT"));
	await post({ action: "activate", id: activeId });
	assert.ok(composeInstructions("teacher", {}, activePromptTexts()).includes("UNIQUE PRESET TEXT"));
});

it("corrupt stored presets are reported and never overwritten", async () => {
	const { readPromptPresets } = await import("../src/store/prompt-presets.ts");
	const file = path.join(dir, "prompts", "presets.json");
	const original = fs.readFileSync(file, "utf8");
	try {
		fs.writeFileSync(file, "broken json");
		assert.throws(() => readPromptPresets());
		assert.equal(fs.readFileSync(file, "utf8"), "broken json");
	} finally {
		fs.writeFileSync(file, original);
	}
});

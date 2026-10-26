import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PROMPTS_OVERRIDE_DIR } from "../../config.ts";
import { isValidSegmentPath } from "../core/prompt-segments.ts";
import { promptOverrides } from "./prompt-overrides.ts";

const nameSchema = z.string().trim().min(1).max(80);
const segmentSchema = z.string().refine(isValidSegmentPath, "Invalid segment path");
const stateSchema = z.object({
	activeId: z.string().nullable(),
	presets: z.array(z.object({
		id: z.string().min(1), name: nameSchema,
		texts: z.record(segmentSchema, z.string()),
	})),
}).refine(s => s.activeId === null || s.presets.some(p => p.id === s.activeId), "Unknown active preset");
export type PromptPresets = z.infer<typeof stateSchema>;

const actionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("create"), name: nameSchema }),
	z.object({ action: z.literal("rename"), id: z.string(), name: nameSchema }),
	z.object({ action: z.literal("delete"), id: z.string() }),
	z.object({ action: z.literal("activate"), id: z.string().nullable() }),
	z.object({ action: z.literal("write"), id: z.string(), path: segmentSchema, text: z.string() }),
	z.object({ action: z.literal("removeText"), id: z.string(), path: segmentSchema }),
]);

const file = path.join(PROMPTS_OVERRIDE_DIR, "presets.json");
function save(state: PromptPresets): void {
	fs.mkdirSync(PROMPTS_OVERRIDE_DIR, { recursive: true });
	const temp = `${file}.${randomUUID()}.tmp`;
	try {
		fs.writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
		fs.renameSync(temp, file);
	} finally {
		fs.rmSync(temp, { force: true });
	}
}

export function readPromptPresets(): PromptPresets {
	try {
		return stateSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
	} catch (error) {
		// Never replace unreadable or corrupt user data with an empty state.
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const texts = Object.fromEntries(promptOverrides.listOverrides().map(segment => [
		segment, fs.readFileSync(path.join(PROMPTS_OVERRIDE_DIR, segment), "utf8"),
	]));
	const presets = Object.keys(texts).length ? [{ id: randomUUID(), name: "Russian", texts }] : [];
	const state = { activeId: presets[0]?.id ?? null, presets };
	// Original .md files remain intact; this file marks migration complete.
	save(state);
	return state;
}

export function activePromptTexts(state = readPromptPresets()): Record<string, string> {
	return state.presets.find(p => p.id === state.activeId)?.texts ?? {};
}

export class PromptPresetInputError extends Error {}

export function updatePromptPresets(input: unknown): PromptPresets {
	const parsed = actionSchema.safeParse(input);
	if (!parsed.success) throw new PromptPresetInputError("Invalid preset action, name, or segment path");
	const action = parsed.data;
	const state = readPromptPresets();
	if (action.action === "create") {
		if (state.presets.some(p => p.name === action.name)) throw new PromptPresetInputError("Preset name already exists");
		const preset = { id: randomUUID(), name: action.name, texts: {} };
		state.presets.push(preset);
		state.activeId = preset.id;
	} else if (action.action === "activate" && action.id === null) {
		state.activeId = null;
	} else {
		const preset = state.presets.find(p => p.id === action.id);
		if (!preset) throw new PromptPresetInputError("Preset not found");
		switch (action.action) {
			case "activate": state.activeId = preset.id; break;
			case "rename":
				if (state.presets.some(p => p.id !== preset.id && p.name === action.name)) throw new PromptPresetInputError("Preset name already exists");
				preset.name = action.name;
				break;
			case "delete":
				state.presets = state.presets.filter(p => p.id !== preset.id);
				if (state.activeId === preset.id) state.activeId = null;
				break;
			case "write": preset.texts[action.path] = action.text; break;
			case "removeText": delete preset.texts[action.path]; break;
		}
	}
	save(state);
	return state;
}

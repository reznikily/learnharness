import { effectiveSideChatPromptSegments, effectivePromptSegments, readPromptPresets, activePromptTexts } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const state = readPromptPresets();
	const texts = activePromptTexts(state);
	return Response.json({
		activeId: state.activeId,
		presets: state.presets.map(({ id, name }) => ({ id, name })),
		prober: effectivePromptSegments("prober", {}, texts),
		teacher: effectivePromptSegments("teacher", {}, texts),
		demoBuilder: effectivePromptSegments("demoBuilder", {}, texts),
		practice: effectivePromptSegments("practice", {}, texts),
		sideChat: effectiveSideChatPromptSegments({}, texts),
	});
}

import { allSegmentPaths, updatePromptPresets, PromptPresetInputError } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	if (body?.action === "write" && !allSegmentPaths().includes(body.path)) {
		return Response.json({ error: "Not a current source segment" }, { status: 400 });
	}
	try {
		const state = updatePromptPresets(body);
		return Response.json({ activeId: state.activeId, presets: state.presets.map(({ id, name }) => ({ id, name })) });
	} catch (error) {
		if (error instanceof PromptPresetInputError) return Response.json({ error: error.message }, { status: 400 });
		throw error;
	}
}

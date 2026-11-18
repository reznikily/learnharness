import { piEngineForSpec } from "../agent/models.ts";
import { isSubscriptionProvider } from "../agent/subscription-connections.ts";
import { composeInstructions } from "../agent/teacher-agent.ts";
import { hasProbeDone } from "../core/native-messages.ts";
import { resolveConversationSpec } from "../core/settings-resolution.ts";
import { modelsNotConfigured, providerKeyMissing } from "../core/settings.ts";
import { activePromptTexts } from "../store/prompt-presets.ts";
import { compactionInFlight, manuallyCompact } from "./compaction.ts";
import { providerKeyPresent } from "./keys.ts";
import { refreshConnectionCatalog } from "./model-catalog.ts";
import { effectiveSettings, stores } from "./stores.ts";
import { isTurnRunning } from "./turn-liveness.ts";

export async function compactChatSession(chatId: string): Promise<Response> {
	if (!/^[A-Za-z0-9_-]+$/.test(chatId)) return Response.json({ error: "Unknown chat" }, { status: 404 });
	const record = stores.chatStore.getChat(chatId);
	if (!record) return Response.json({ error: "Unknown chat" }, { status: 404 });
	if (isTurnRunning(chatId) || compactionInFlight(chatId)) return Response.json({ error: "Session is busy" }, { status: 409 });
	const spec = resolveConversationSpec(record.settings, effectiveSettings().models.strong);
	if (!spec) return Response.json(modelsNotConfigured(["strong"]), { status: 503 });
	if (isSubscriptionProvider(spec.provider)) await refreshConnectionCatalog(spec.provider);
	if (!providerKeyPresent(spec.provider)) return Response.json(providerKeyMissing(spec.provider, ["strong"]), { status: 503 });
	let engine;
	try {
		// An explicit manual request uses foreground subscription permission.
		engine = piEngineForSpec(spec, false);
	} catch {
		return Response.json({ error: "The selected session model is unavailable" }, { status: 503 });
	}
	return manuallyCompact({
		chatStore: stores.chatStore,
		engine,
		modelId: `${engine.model.provider}:${engine.model.id}`,
		kind: record.kind === "practice" ? "practice" : hasProbeDone(record.messages) ? "teach" : "probe",
		thresholdTokens: 0,
		systemPromptTokens: Math.ceil(composeInstructions(record.kind === "practice" ? "practice" : "teacher", {}, activePromptTexts()).length / 4),
	}, chatId);
}

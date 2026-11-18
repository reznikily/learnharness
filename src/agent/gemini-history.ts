import type { Api, Model, StreamOptions, TranscriptContext } from "@earendil-works/pi-ai";

/** Pi 1.5 drops foreign signatures but does not mark imported tool calls for Gemini. */
export function geminiHistoryOptions(model: Model<Api>, context: TranscriptContext, options?: StreamOptions): StreamOptions | undefined {
	if (!["google-generative-ai", "google-vertex"].includes(model.api) || Number(/^gemini(?:-live)?-(\d+)/i.exec(model.id)?.[1] ?? 0) < 3) return options;
	const foreign = new Set<string>();
	const native = new Set<string>();
	for (const message of context.messages) {
		if (message.role !== "assistant") continue;
		const ids = message.provider === model.provider && message.model === model.id ? native : foreign;
		for (const block of message.content) {
			if (block.type === "toolCall") ids.add(block.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64));
		}
	}
	for (const id of native) foreign.delete(id);
	if (!foreign.size) return options;
	return {
		...options,
		onPayload: async (raw, target) => {
			const payload = await options?.onPayload?.(raw, target) ?? raw;
			// Patch only the outgoing Google payload, never persisted messages or native signatures.
			const request = payload as { contents?: { parts?: { functionCall?: { id?: string }; thoughtSignature?: string }[] }[] };
			for (const content of request.contents ?? []) {
				for (const part of content.parts ?? []) {
					if (part.functionCall?.id && foreign.has(part.functionCall.id) && !part.thoughtSignature) {
						part.thoughtSignature = "skip_thought_signature_validator";
					}
				}
			}
			return payload;
		},
	};
}

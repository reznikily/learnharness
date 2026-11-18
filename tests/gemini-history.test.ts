import assert from "node:assert/strict";
import { it } from "node:test";
import { normalizeContext, type AssistantMessage, type TranscriptContext } from "@earendil-works/pi-ai";
import { geminiHistoryOptions } from "../src/agent/gemini-history.ts";
import { piEngineForSpec } from "../src/agent/models.ts";

it("Gemini wire history marks foreign calls, preserves native signatures and never edits the transcript", async () => {
	const engine = piEngineForSpec({ provider: "opencode-go", id: "gemini-4-argon" });
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
	const assistant = (id: string, foreign: boolean, signature?: string): AssistantMessage => ({
		role: "assistant", api: foreign ? "anthropic-messages" : engine.model.api,
		provider: foreign ? "claude-code" : engine.model.provider, model: foreign ? "sonnet" : engine.model.id,
		content: [{ type: "toolCall", id, name: "quiz", arguments: { type: "check" }, ...(signature && { thoughtSignature: signature }) }],
		stopReason: "toolUse", timestamp: 1, usage,
	});
	const messages: TranscriptContext["messages"] = [{ role: "user", content: "Continue", timestamp: 0 }];
	for (const msg of [assistant("foreign|quiz", true), { ...assistant("other_model", false, "b2xkc2ln"), model: "gemini-3-pro" }, assistant("native", false, "c2lnbmF0dXJl"), assistant("unsigned", false)]) {
		messages.push(msg, { role: "toolResult", toolCallId: (msg.content[0] as { id: string }).id, toolName: "quiz", content: [{ type: "text", text: "correct" }], isError: false, timestamp: 2 });
	}
	const before = JSON.stringify(messages);
	const originalFetch = globalThis.fetch;
	let hookCalled = false;
	let body: { contents: { parts: { functionCall?: { id: string; name: string }; thoughtSignature?: string }[] }[] } | undefined;
	globalThis.fetch = async (_input, init) => {
		body = JSON.parse(String(init?.body));
		return new Response('data: {"candidates":[{"content":{"role":"model","parts":[{"text":"OK"}]},"finishReason":"STOP"}]}\n\n', { headers: { "content-type": "text/event-stream" } });
	};
	try {
		const stream = engine.streamFn(engine.model, normalizeContext({ messages }), { apiKey: "dummy-offline", maxRetries: 0, onPayload: raw => { hookCalled = true; return structuredClone(raw); } });
		const result = await stream.result();
		assert.notEqual(result.stopReason, "error", result.errorMessage);
	} finally { globalThis.fetch = originalFetch; }
	assert.ok(hookCalled);
	assert.equal(JSON.stringify(messages), before);
	const calls = body!.contents.flatMap(c => c.parts).filter(p => p.functionCall);
	assert.equal(calls[0]!.thoughtSignature, "skip_thought_signature_validator");
	assert.equal(calls[0]!.functionCall!.id, "foreign_quiz");
	assert.equal(calls[1]!.thoughtSignature, "skip_thought_signature_validator");
	assert.equal(calls[2]!.thoughtSignature, "c2lnbmF0dXJl");
	assert.equal(calls[3]!.thoughtSignature, undefined, "do not hide missing signatures from Gemini itself");
});

it("non-Google transports retain their options unchanged", () => {
 const engine = piEngineForSpec({ provider: "openai", id: "gpt-4o-mini" });
 const options = { maxRetries: 0 };
 assert.equal(geminiHistoryOptions(engine.model, normalizeContext({ messages: [] }), options), options);
});

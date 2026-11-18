import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, it } from "node:test";

const data = fs.mkdtempSync(path.join(os.tmpdir(), "lh-manual-compaction-"));
process.env.LH_DATA_DIR = data;
const { POST } = await import("../app/api/chats/[id]/compact/route.ts");
const { stores, beginTurn, endTurn } = await import("../src/server/index.ts");
after(() => fs.rmSync(data, { recursive: true, force: true }));
const request = (id: string) => POST(new Request("http://localhost/api/chats/session/compact", { method: "POST" }), { params: Promise.resolve({ id }) });

it("manual route rejects missing, invalid, busy and unconfigured sessions without writes", async () => {
	assert.equal((await request("missing")).status, 404);
	assert.equal((await request("../settings")).status, 404);
	const chat = stores.chatStore.createChat("fixture");
	const before = stores.chatStore.getChat(chat.id);
	beginTurn(chat.id);
	try { assert.equal((await request(chat.id)).status, 409); }
	finally { endTurn(chat.id); }
	assert.equal((await request(chat.id)).status, 503);
	assert.deepEqual(stores.chatStore.getChat(chat.id), before);
});

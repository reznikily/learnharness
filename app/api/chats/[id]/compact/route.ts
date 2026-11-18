import { compactChatSession } from "@/src/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	return compactChatSession((await params).id);
}

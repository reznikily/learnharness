export { CLAUDE_CODE_PROVIDER } from "../../core/contracts/claude-code.ts";

export const CLAUDE_CODE_API = "claude-code-cli";

export enum ClaudeCodeError {
	CliNotFound = "claude CLI not found",
	NotSignedIn = "not signed in",
}

// A held MCP call lasts until pi calls back with the tool result, which for a question tool is
// whenever the learner answers; this must outlast the live-process idle timeout so the CLI never
// times out first.
export const MCP_TOOL_TIMEOUT_MS = 30 * 60_000;

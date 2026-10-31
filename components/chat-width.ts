export const MIN_FEED_WIDTH = 480;
export const FEED_WIDTH_KEY = "lh-message-feed-width";

export function parseFeedWidth(value: string | null): number | null {
	const width = Number(value);
	return Number.isFinite(width) && width > 0 ? width : null;
}

export function clampFeedWidth(width: number | null, available: number): number {
	return Math.min(available, Math.max(MIN_FEED_WIDTH, width ?? available));
}

export function draggedFeedWidth(start: number, delta: number, side: "left" | "right", available: number): number {
	return clampFeedWidth(start + delta * (side === "left" ? -2 : 2), available);
}

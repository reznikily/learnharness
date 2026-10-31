import assert from "node:assert/strict";
import { test } from "node:test";
import { clampFeedWidth, draggedFeedWidth, parseFeedWidth } from "../components/chat-width.ts";

test("feed width clamps to available area without changing the saved preference", () => {
 assert.equal(clampFeedWidth(700, 1000), 700);
 assert.equal(clampFeedWidth(200, 1000), 480);
 assert.equal(clampFeedWidth(900, 390), 390);
 assert.equal(clampFeedWidth(null, 1000), 1000);
});
test("either rail moves both boundaries symmetrically and never flips across center", () => {
 assert.equal(draggedFeedWidth(800, 50, "left", 1000), 700);
 assert.equal(draggedFeedWidth(800, -50, "right", 1000), 700);
 assert.equal(draggedFeedWidth(800, 900, "left", 1000), 480);
 assert.equal(draggedFeedWidth(800, 900, "right", 1000), 1000);
});
test("invalid persisted widths fall back to full width", () => {
 for (const value of [null, "", "NaN", "Infinity", "-1", "0", "oops"]) assert.equal(parseFeedWidth(value), null);
 assert.equal(parseFeedWidth("720"), 720);
});

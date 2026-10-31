# Adjustable message feed — approved 2026-10-27

Two vertical rails resize the feed symmetrically around the available chat area's center, excluding the sidebar. Messages, transcript assignments and inline demos follow this width; the composer and pending-question dock keep their current width.

Both rails fade in when either edge is hovered, remain visible during dragging, and are accessible by keyboard. Content sits 24px inside the rails. Dragging is immediate. Minimum width is 480px; maximum is the available area. Smaller areas use full width. One preference is shared across chats and survives reloads.

Implementation: isolate rail interaction from transcript rendering; update a CSS width variable on the session container. Persist the preferred width in localStorage, matching existing local UI preferences. Clamp displayed width on container resize without losing the preferred width. Preserve full-width behavior before a preference is chosen. No dependencies or model/prompt changes.

Validation: unit checks for symmetry/clamps/storage parsing; browser interaction checks for both rails, iframe crossing, persistence, sidebar, narrow windows, keyboard, reduced motion, unchanged dock; typecheck, lint and production build. Source-only delivery; installation is a separate action.

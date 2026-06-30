# Manual Queue Reordering Implementation Plan

## Overview
This document describes a concrete, testable implementation plan to add manual reordering of the user queue in the `QueueDrawer` UI. The `Up Next` context list remains read-only; the `Next in Queue` user list will become reorderable via drag-and-drop.

---

## UX Requirements
- Only the `Next in Queue` (user queue) is reorderable.
- Drag handle shown only on reorderable items.
- Visual feedback: lifted/ghost item, drop-target highlight, final position preview.
- Shuffle remains a separate action.

## Audit Points (where to look in repo)
- `src/components/QueueDrawer/QueueDrawer.jsx` — current drag UI and virtualization.
- `src/components/QueueDrawer/QueueDrawer.module.css` — styles for drag feedback and affordances.
- Player state (hook/context): locate `reorderUserQueue` implementation in `usePlayer` / player reducer.
- Verify `playingFromUserQueue` semantics and current-track index handling.

## Data Flow & Indexing
- Use absolute queue indices for source and target (not virtualization slice indices).
- Map rendered item → absolute index via `startIndex + visibleIndex` when virtualized.
- Reorder mutation occurs on `drop` only; hover/drag-over updates are purely visual.

## Implementation Steps (detailed)
1. Feature gating and affordance
   - If the feature is not yet implemented, hide or disable the drag handle to avoid misleading users.
   - Create a small `DraggableHandle` component (presentational) to show on reorderable rows.
   - This code represents the icons that means it can be dragged:  <span className={styles.dragHandle}>☰</span>

2. Drag lifecycle in `QueueDrawer.jsx`
   - `onDragStart(event)`
     - store `sourceIndexRef.current = absoluteIndex`
     - set `dragging` class on the source row for visual lift
     - set `event.dataTransfer.effectAllowed = 'move'` and `event.dataTransfer.setData('text/plain', sourceIndex)` (fallback)
   - `onDragOver(event)` / `onDragEnter(event)`
     - `event.preventDefault()` to allow drop
     - compute `targetIndex` as absolute index (use visible mapping)
     - throttle visual updates (e.g., 60ms–100ms) to set `dragOverIndex` for highlight
   - `onDrop(event)`
     - prevent default
     - read `sourceIndex` (from ref or dataTransfer)
     - compute `finalTargetIndex` and call `reorderUserQueue(sourceIndex, finalTargetIndex)`
     - clear drag state and classes
   - `onDragEnd()`
     - clear drag refs and temporary state (in case `drop` did not fire)

3. Reorder mutation (player state)
   - Ensure `reorderUserQueue(fromIndex, toIndex)`:
     - validates indices (clamp into range), no-op if same index
     - removes source item and inserts at target
     - updates any `currentTrack` index or `playingFromUserQueue` pointer if necessary
     - emits any necessary updates to UI and persisted state
   - Implement this in the central player state (hook/reducer) for single source of truth

4. Virtualization safety
   - The drawer's virtualization logic must expose the current `startIndex` for the rendered window
   - When rendering an item, attach absolute index with the DOM node (data-attr or closure)
   - On `drop`, convert the render-time index back to absolute index and call the reorder action

5. Visual feedback and performance
   - Use CSS `transform` and `opacity` for lift/ghost effects (GPU-accelerated)
   - Use `box-shadow` for drop highlight instead of border changes
   - Throttle `dragOverIndex` updates to ~60–100ms (already implemented in Phase 1)
   - Avoid state changes on every `mousemove`

6. Edge cases
   - Dragging the currently-playing item: maintain playback and update pointers so playback continues
   - Drop at first position or last position: ensure indices clamp correctly
   - Cancelled drags: `onDragEnd` must restore state
   - Queue length changes during drag: validate indexes before commit

7. Tests and verification
   - Unit test `reorderUserQueue(from, to)` for correctness
   - Integration/manual test:
     1. Open QueueDrawer
     2. Drag a user-queued item to a different position
     3. Verify UI updates immediately after drop
     4. Verify playback follows new order
   - Performance test: confirm drag does not trigger frequent reflows or excessive repaints

8. Documentation & UX notes
   - Update README or a short `docs/` note describing manual reorder behavior and any known limitations (virtualized lists, minor drop latency)
   - Mark the drag handle as draggable with accessible `aria-grabbed` / `role=button` attributes

---

## Quick Implementation Checklist (code pointers)
- `QueueDrawer.jsx`
  - Add `sourceIndexRef`, `dragOverIndex` state (visual only), handlers for `dragstart`, `dragover`, `drop`, `dragend`.
  - Use `data-` attributes or closures to attach absolute index to each rendered row.
  - Ensure virtualization mapping `startIndex + i` is correct.
- `usePlayer` or player reducer
  - Implement `reorderUserQueue(fromIndex, toIndex)` mutation.
- `QueueDrawer.module.css`
  - Add `.dragging`, `.dragOver` styles using `transform`/`opacity`/`box-shadow`.

---

## Rollout plan
1. Implement drag lifecycle in `QueueDrawer` and unit test `reorderUserQueue`.
2. QA manual reorders, fix edge cases, ensure playback correctness.
3. Add small accessibility improvements and docs.
4. Remove any misleading drag affordances until feature is fully validated (if starting from a UI-only affordance).

## Stage 3: Stabilize, document, and release
- Finalize performance smoothing and ensure drag feedback remains responsive under real library sizes.
- Complete accessibility checks for keyboard and screen-reader users, including `aria-grabbed`, roles, and clear drag handle affordances.
- Add or update documentation notes in `README.md` or project docs describing manual queue reorder limitations and expected behavior.
- Run end-to-end validation: reorder several items, verify current-playback continuity, and confirm persisted queue state if applicable.
- Remove any remaining temporary feature gating or development-only UI hints once the behavior is validated.

---

## Notes
- This plan keeps UI-only concerns in `QueueDrawer` and state mutation in the player state to ensure predictable, testable behavior.
- Virtualization mapping must be precise—off-by-one errors will break reorder.


*Created on 2026-06-20*

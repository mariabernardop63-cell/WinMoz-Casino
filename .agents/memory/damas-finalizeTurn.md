---
name: DamasGame finalizeTurn contract
description: finalizeTurn expects an already-transformed board; callers must apply the move first
---

## Rule
`finalizeTurn(from, to, captured, finalBoard)` expects `finalBoard` to **already** have the move applied — i.e., piece is at `to`, all captured squares are cleared.

**Why:** The original code called `applyBoardMove` inside `finalizeTurn`, but all callers (chain capture, single capture) had already applied the board. This caused a null-read crash on `piece.isDame` when the piece was no longer at `from`.

## How to apply
- For single capture: call `applyBoardMove(boardRef.current, selected, dest.to, [cap])` first, then pass the result to `finalizeTurn`.
- For non-capture moves: call `applyBoardMove(boardRef.current, selected, [r,c], [])` first, then pass the result.
- For chain captures: the board is already updated incrementally via `setBoard/boardRef.current = newBoard`; pass `newBoard` directly.

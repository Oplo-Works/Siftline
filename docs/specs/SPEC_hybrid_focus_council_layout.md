# Spec: Hybrid Focus Council Layout

> Date: 2026-06-03

## 1. Problem

Council Chat mode currently shows every active AI BrowserView as equal-width columns.
With many active AIs, each pane becomes too narrow, and the docked Council Chat panel
competes with the AI panes for attention.

The app also exposes Workflow mode as a top-level mode, but daily usage is now centered
on Council Chat. Workflow should remain available internally for future use, but it should
not be a primary visible mode in the main UI.

## 2. Goal

Make Council Chat the default visible experience and improve the AI pane layout:

- Left: one large Focus AI pane.
- Center: remaining active AIs in an adaptive compare grid.
- Right: docked Council Chat panel.
- Hide the top-level Workflow mode switch without deleting workflow code.

## 3. Scope

### In scope

- Default the renderer and main-process layout state to Council Chat.
- Replace the top-level Workflow/Council Chat toggle with a single Council Chat indicator.
- In Council Chat mode, render panel headers in a hybrid focus/compare structure.
- In Council Chat mode, place BrowserViews in matching focus and compare bounds.
- Allow a compare pane header to promote that AI into the Focus pane.

### Out of scope

- Deleting Workflow handlers, IPC, workflow prompts, or workflow persistence.
- Rewriting Council Chat message routing.
- Changing AI selectors or login behavior.
- Adding user-resizable splitters in this slice.

## 4. Expected Files

| File | Change |
|---|---|
| `src/App.tsx` | Default to chat, initialize main process in chat mode, pass focus handler |
| `src/components/TitleBar.tsx` | Hide mode toggle behind a single Council Chat indicator |
| `src/components/Toolbar.tsx` | Rename Council Chat primary selector label to Focus AI |
| `src/components/PanelGrid.tsx` | Render focus pane header and adaptive compare headers |
| `src/index.css` | Hybrid layout styling |
| `electron/main.ts` | Match BrowserView bounds to hybrid layout in chat mode |

## 5. Acceptance Criteria

- [ ] `npm run build` passes.
- [ ] App starts in Council Chat mode with the chat panel visible.
- [ ] Workflow mode is not visible as a top-level titlebar option.
- [ ] Focus AI BrowserView appears on the left.
- [ ] Remaining active AIs appear in the center compare area as 1xN, 2x2, or 2x2+1 style grids.
- [ ] Clicking/promoting a compare header changes the Focus AI.
- [ ] Workflow code paths remain present for future use.

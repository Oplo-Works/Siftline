# Plan: Hybrid Focus Council Layout

> Date: 2026-06-03

## Slice 1

Files: 5 code files plus spec/plan/log docs.

## Steps

1. `src/App.tsx`
   - Start with `interactionMode` set to `chat`.
   - During initial council room load, call `switchInteractionMode({ mode: 'chat', ... })`
     so Electron BrowserViews reserve the right chat panel immediately.
   - Pass `setPrimaryAi` into `PanelGrid` as a focus promotion handler.

2. `src/components/TitleBar.tsx`
   - Keep props/API intact.
   - Remove visible Workflow/Council toggle buttons from the titlebar.
   - Show a compact read-only `Council Chat` indicator instead.

3. `src/components/PanelGrid.tsx`
   - Split active panels into `focusPanel` and `comparePanels`.
   - Render a left focus header.
   - Render compare headers in an adaptive grid.
   - Add a small `Focus` button on compare headers.

4. `electron/main.ts`
   - Keep legacy column bounds for Workflow mode.
   - Use hybrid focus/compare bounds when `councilChatVisible` is true.
   - Use the current primary AI as the focus pane.

5. `src/index.css`
   - Make Council Chat mode panel area fill the browser workspace.
   - Style focus and compare header regions.
   - Keep final result behavior intact for hidden Workflow paths.

## Slice 2

Files: 1 code file.

6. `src/components/Toolbar.tsx`
   - Label the chat-mode focus selector as `Focus AI` instead of `Primary AI`.

## Verification

1. `npm run build`
2. Optional manual run with `build-and-run.bat`
3. Visual check:
   - chat panel visible on right
   - focus pane left
   - compare panes center
   - titlebar no longer offers Workflow mode as a main toggle

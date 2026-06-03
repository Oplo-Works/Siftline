# Plan: v1.0.9 Installers Release

> Date: 2026-06-03

## Slice 1

Files: 3-5 files.

1. Version metadata
   - Update `package.json` and `package-lock.json` to `1.0.9`.

2. GitHub Actions release workflow
   - Keep tag-triggered macOS and Windows builds.
   - Update release notes for the hybrid Council Chat layout.
   - Replace hard-coded legacy repo references with `${{ github.repository }}`.
   - Add a manual `release_tag` input for workflow-dispatch uploads.

3. Documentation/log
   - Record the release packaging work in `docs/DEV_LOG.md`.

## Verification

1. `npm run build`
2. `npm run package:installer`
3. Confirm `release/AI-Council-Setup.exe` exists and has a fresh timestamp.
4. Commit, push `main`, then push tag `v1.0.9`.


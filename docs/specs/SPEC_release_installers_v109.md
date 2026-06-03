# Spec: v1.0.9 Installers Release

> Date: 2026-06-03

## 1. Problem

The app has a new Council Chat hybrid focus/compare layout, and the user wants
updated Windows and macOS installers published to GitHub.

The local machine is Windows, so the Windows NSIS installer can be built locally.
macOS DMGs should be produced by GitHub Actions on a macOS runner.

## 2. Goal

- Publish the current UI update to `MinkyuTheBuilder/AI-Council-Chat`.
- Build a Windows installer locally.
- Trigger GitHub Actions to build macOS DMGs by pushing a release tag.
- Keep Workflow code present but hidden in the primary UI.

## 3. Scope

### In scope

- Bump app version to `1.0.9`.
- Update release workflow copy and manual upload target to the current repository.
- Build `release/AI-Council-Setup.exe` locally.
- Commit and push changes on `main`.
- Push tag `v1.0.9` so GitHub builds macOS DMGs and release assets.

### Out of scope

- Code signing/notarization for Windows or macOS.
- Deleting Workflow functionality.
- Rewriting README beyond release-target corrections needed for this release.

## 4. Acceptance Criteria

- [ ] `npm run build` passes.
- [ ] `npm run package:installer` produces `release/AI-Council-Setup.exe`.
- [ ] `main` is pushed to `MinkyuTheBuilder/AI-Council-Chat`.
- [ ] Tag `v1.0.9` is pushed to GitHub.
- [ ] GitHub Actions is able to build macOS DMG artifacts from the tag.


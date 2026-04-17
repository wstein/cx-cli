---
id: 20260417114500
aliases: ["homebrew tap automation", "tap workflow", "formula push workflow"]
tags: ["homebrew", "release", "github-actions"]
---

# Homebrew Tap Automation

`wstein/homebrew-tap` should stay intentionally small: accept formula commits, validate them on push, and avoid any build or publish logic.

## Tap repo workflow

Use a workflow like this in `wstein/homebrew-tap/.github/workflows/formula.yml`:

```yaml
name: Validate Formula

on:
  push:
    branches:
      - main
    paths:
      - "Formula/**"
  workflow_dispatch:

concurrency:
  group: validate-formula
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Validate Ruby syntax
        run: ruby -c Formula/cx-cli.rb

      - name: Lint formula
        run: |
          brew audit --strict --online Formula/cx-cli.rb
```

## Source repo release step

The source repo already owns formula generation. The release job should keep a step like this after generating `release-artifacts/cx-cli.rb`:

```yaml
- name: Checkout Homebrew tap
  uses: actions/checkout@v4
  with:
    repository: wstein/homebrew-tap
    token: ${{ secrets.HOMEBREW_TAP_PUSH_TOKEN }}
    path: homebrew-tap

- name: Update tap formula
  run: |
    set -euo pipefail
    cd homebrew-tap
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git checkout main || git checkout -b main
    mkdir -p Formula
    cp ../release-artifacts/cx-cli.rb Formula/cx-cli.rb
    if git diff --quiet -- Formula/cx-cli.rb; then
      echo "No formula updates required."
      exit 0
    fi
    git add Formula/cx-cli.rb
    git commit -m "chore(homebrew): update cx-cli formula for v${{ needs.prepare-release.outputs.release_version }}"
    git push origin main
```

## Why this lines up cleanly

- The source repo owns packaging and formula generation.
- The tap repo owns validation of the committed formula.
- A PAT or GitHub App token with write access to `wstein/homebrew-tap` triggers the tap repo workflow normally.
- There is no second packaging path and no duplicated release logic.

## Links

- `.github/workflows/publish.yml`
- `docs/RELEASE_CHECKLIST.md`
- `notes/Homebrew Tap.md`

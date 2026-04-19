<!-- Source: RELEASE_CHECKLIST.md | Status: CANONICAL | Stability: STABLE -->

# Release Checklist

Use this short checklist when cutting a release.

- Two-phase release protocol:
  1. Prepare the release candidate on `develop`.
  2. Finalize the release with a `vX.Y.Z` tag from the exact green candidate commit.
- Bumping `package.json` on `develop` starts the release candidate. Use `chore(release): start vX.Y.Z` for that commit and treat later commits on the candidate path as release-fix follow-ups only.
- Keep fixing forward on `develop` until the required CI lanes are green. Do not tag early and do not publish from an ordinary `develop` success alone.
- Create and push the release tag from the exact certified `develop` commit. The release workflow is the finalization step; the version bump is not.
- The release workflow must verify that the tag matches `package.json`, that the tagged commit already passed the required CI gates, and that the published artifacts come from that same certified commit.
- Promote `main` only after successful publishing, and do it with a fast-forward update to the released commit. Do not rebase `main` onto the release tag.
- The release workflow should own that final `main` fast-forward so the shipped commit and the branch tip stay identical without a manual replay step.
- Run `make certify` before tagging. This runs lint, typecheck, build, full test coverage, the contract lane, Repomix fork compatibility smoke, bundle transition matrix smoke, release integrity smoke, and a clean double-build reproducibility check. All steps must be green. Use `make verify` during development; `make certify` is the pre-tag CI-equivalent gate.
- The CI workflow validates Bun against the declared minimum runtime (`1.3.11`) and `latest` before release automation is allowed to proceed.
- The Pages publish now assembles one site tree with `/schemas/` and `/coverage/`; successful `main` CI publishes the latest coverage page automatically, while tagged releases still mirror schema files into release assets.
- Run `bun run pages:smoke` against the staged `site/` tree whenever you need to validate the public publish surface locally.
- If schema files change, update the published Pages site and verify the `schemas/` index still lists the current versions.
- The publish workflow runs the same smoke check in non-blocking mode before pushing `gh-pages`, and the separate `Pages Smoke` workflow keeps that validation visible on pull requests and `main`.
- If the Pages branch does not exist yet, let the publish workflow create `gh-pages` on the next run.
- GitHub Pages must be configured in repository settings to serve from the `gh-pages` branch.
- If a new schema version is added, refresh the public `$id` values in the JSON Schema files and keep the docs pointing at the GitHub Pages host.
- Mirror the same schema files into the GitHub Release assets for the tagged release.
- Tagged releases also publish the npm tarball, `release-integrity.json`, and the generated `cx-cli.rb` formula into GitHub release assets so the public release payload matches the documented integrity story.
- Use `make release VERSION=vX.Y.Z` as the local release wizard. The first call with a new version starts the candidate on `develop`; the second call with that same tagged version finalizes the release from the certified commit.
- Ensure `package.json` version matches the git tag before publishing release artifacts.
- The release workflow runs on `vX.Y.Z` tag pushes, plus a manual re-finalization path for an existing tag when needed.
- The release workflow only finalizes when the tagged commit already has a successful `develop` CI run; tag presence without certified CI is not enough.
- The release workflow in `.github/workflows/release.yml` requires `NPM_TOKEN` in the `node` environment so `npm publish` can authenticate to the npm registry, and `HOMEBREW_TAP_PUSH_TOKEN` in the `homebrew` environment so it can authenticate the cross-repo push to `wstein/homebrew-tap`.
- Confirm both environment secrets are set before the release workflow starts; the workflow now fails fast if either one is missing.
- Create `HOMEBREW_TAP_PUSH_TOKEN` as a fine-grained personal access token in GitHub Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token.
- Scope that token to the `wstein/homebrew-tap` repository only, and grant `Contents: Read and write` so the release workflow can commit and push `Formula/cx-cli.rb`.
- Store the token in the `homebrew` environment of the source repo under the name `HOMEBREW_TAP_PUSH_TOKEN`.
- Release order:
  1. Build the package once.
  2. Publish the packed tarball to npm.
  3. Generate `Formula/cx-cli.rb` from the same tarball.
  4. Commit the formula into `wstein/homebrew-tap`.
- Final release promotion order:
  1. `develop` prepares the candidate.
  2. The `vX.Y.Z` tag finalizes the certified candidate.
  3. The release workflow verifies integrity and publishes from that tagged commit.
  4. `main` fast-forwards to mirror the shipped commit.
- Verify the external tap repo `wstein/homebrew-tap` accepts direct formula updates from the single release workflow, and remember that the tap repo owns formula validation on push.

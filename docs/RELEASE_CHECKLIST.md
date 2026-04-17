# Release Checklist

Use this short checklist when cutting a release.

- Run `make verify` before tagging so lint, typecheck, build, and the full test suite with coverage are green.
- If schema files change, update the published Pages site and verify the `schemas/` index still lists the current versions.
- If the Pages branch does not exist yet, let the publish workflow create `gh-pages` on the next run.
- GitHub Pages must be configured in repository settings to serve from the `gh-pages` branch.
- If a new schema version is added, refresh the public `$id` values in the JSON Schema files and keep the docs pointing at the GitHub Pages host.
- Mirror the same schema files into the GitHub Release assets for the tagged release.
- Use `make release VERSION=x.y.z` to hand off the tagged release to the release script.
- Ensure `package.json` version matches the git tag before publishing release artifacts.
- The release workflow requires `NPM_TOKEN` in the `node` environment so `npm publish` can authenticate to the npm registry, and `HOMEBREW_TAP_PUSH_TOKEN` in the `homebrew` environment so it can authenticate the cross-repo push to `wstein/homebrew-tap`.
- Confirm both environment secrets are set before the release workflow starts; the workflow now fails fast if either one is missing.
- Create `HOMEBREW_TAP_PUSH_TOKEN` as a fine-grained personal access token in GitHub Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token.
- Scope that token to the `wstein/homebrew-tap` repository only, and grant `Contents: Read and write` so the release workflow can commit and push `Formula/cx-cli.rb`.
- Store the token in the `homebrew` environment of the source repo under the name `HOMEBREW_TAP_PUSH_TOKEN`.
- Release order:
  1. Build the package once.
  2. Publish the packed tarball to npm.
  3. Generate `Formula/cx-cli.rb` from the same tarball.
  4. Commit the formula into `wstein/homebrew-tap`.
- Verify the external tap repo `wstein/homebrew-tap` accepts direct formula updates from the single release workflow, and remember that the tap repo owns formula validation on push.

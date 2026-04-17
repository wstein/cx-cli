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
- Add `NPM_TOKEN` to repository secrets for npm publish automation.
- Add `HOMEBREW_TAP_TOKEN` to repository secrets for automated Homebrew tap updates.
- Verify the external tap repo `wstein/homebrew-tap` accepts direct formula updates from the combined release workflow.

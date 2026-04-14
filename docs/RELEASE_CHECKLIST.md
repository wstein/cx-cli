# Release Checklist

Use this short checklist when cutting a release.

- If schema files change, update the published Pages site and verify the `schemas/` index still lists the current versions.
- If a new schema version is added, refresh the public `$id` values in the JSON Schema files and keep the docs pointing at the GitHub Pages host.
- Mirror the same schema files into the GitHub Release assets for the tagged release.

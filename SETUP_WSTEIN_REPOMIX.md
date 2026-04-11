# Setup Guide for @wstein/repomix Dependency

This project uses `@wstein/repomix@1.13.1-cx.1`, a scoped package published to GitHub Packages.

## Prerequisites

1. **GitHub Personal Access Token (PAT)** with `read:packages` scope
   - Create at: https://github.com/settings/tokens/new
   - Check `read:packages` scope

2. **Environment Setup**
   - Export your token: `export GITHUB_PACKAGES_TOKEN=ghp_xxxxxxxxxxxx`
   - Or add to `~/.zshrc` or `~/.bashrc` for persistence

## Installation

```bash
# Set your GitHub token
export GITHUB_PACKAGES_TOKEN=your_token_here

# Install dependencies
bun install
# or
npm install
# or
yarn install
```

## Configuration

- `.npmrc` is already configured to:
  - Map `@wstein` scope to GitHub Packages registry
  - Use `GITHUB_PACKAGES_TOKEN` environment variable for authentication
  - Not committed to version control (add to `.gitignore` if using tokens)

## Why GitHub Packages?

Using a scoped GitHub Packages dependency provides:

- **Package identity is explicit**: `@wstein/repomix` clearly indicates a fork/variant
- **Deterministic versions**: Published versions (e.g., `1.13.1-cx.1`) are more reproducible than git branches
- **CI/CD integration**: GitHub Actions can authenticate automatically with `${{ secrets.GITHUB_TOKEN }}`
- **Version isolation**: Separate from official `repomix` package on npm

## Troubleshooting

### "Cannot find module '@wstein/repomix'"

1. Verify token is exported: `echo $GITHUB_PACKAGES_TOKEN`
2. Check `.npmrc` configuration: `cat .npmrc`
3. Clear cache: `bun pm cache`
4. Reinstall: `rm -rf node_modules bun.lockb && bun install`

### "401 Unauthorized"

- Token is missing or expired
- Verify token has `read:packages` scope
- Check token is properly exported as `GITHUB_PACKAGES_TOKEN`

### Package Not Found

- Package `@wstein/repomix@1.13.1-cx.1` must be published to GitHub Packages first
- Verify publishing from the repomix fork repository

## For CI/CD (GitHub Actions)

Add to your workflow:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: |
          bun install
        env:
          GITHUB_PACKAGES_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

GitHub automatically provides a token with packages scope in workflows.

## Capability Detection

This project uses runtime capability detection rather than exact version matching:

```typescript
interface RepomixCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  hasPackStructured: boolean;
  supportsStructuredRenderPlan: boolean;
}
```

If installed package doesn't provide required capabilities, cx-cli will fail with a clear error message explaining which exports are missing.

This approach is more flexible than semver-based gating and aligns with the project's goals around deterministic tooling.

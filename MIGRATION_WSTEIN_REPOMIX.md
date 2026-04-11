# @wstein/repomix Dependency Migration

Completed implementation of switching from hardcoded `repomix@^1.13.1` to `@wstein/repomix@1.13.1-cx.1` with capability-based detection instead of semver gating.

## Changes Made

### 1. Package Configuration

**package.json**
- Replaced: `"repomix": "^1.13.1"`
- With: `"@wstein/repomix": "1.13.1-cx.1"`
- Updated to use scoped package from GitHub Packages

**.npmrc** (new file)
```ini
@wstein:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
auth-type=legacy
```

### 2. New Capability Detection Module

**src/repomix/capabilities.ts** (new file)

Implements runtime capability detection instead of exact version matching:

```typescript
interface RepomixCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  hasPackStructured: boolean;
  supportsStructuredRenderPlan: boolean;
}

export async function getAdapterRuntimeInfo(): Promise<AdapterRuntimeInfo>
export function detectRepomixCapabilities(): RepomixCapabilities
export function validateRepomixContract(): { valid: true } | { valid: false; errors: string[] }
export async function getRepomixCapabilities()
export async function requireRepomixContract(): Promise<void>
```

**Key features:**
- `getAdapterRuntimeInfo()`: Reads installed package name and version at runtime
- `detectRepomixCapabilities()`: Checks which exports are available
- `validateRepomixContract()`: Ensures minimum contract is met (hasMergeConfigs && hasPack && hasPackStructured)
- `getRepomixCapabilities()`: Combined method returning full capabilities info
- `requireRepomixContract()`: Throws CxError if contract validation fails

### 3. Updated Import Statements

Changed all imports from:
```typescript
import { mergeConfigs, pack } from "repomix";
```

To:
```typescript
import { mergeConfigs, pack } from "@wstein/repomix";
```

Updated files:
- `src/repomix/render.ts`
- `src/cli/commands/adapter.ts` 
- `tests/repomix/adapter.test.ts`

### 4. Removed Hardcoded Version Constants

**Removed from src/repomix/render.ts:**
- `SUPPORTED_REPOMIX_VERSION = "1.13.1"`
- `REPOMIX_VERSION = "unknown"`

**Replaced with dynamic detection via `getAdapterRuntimeInfo()`**

### 5. Updated getRepomixCapabilities() for Async Operation

All calls to `getRepomixCapabilities()` now use `await`:

```typescript
const capabilities = await getRepomixCapabilities();
```

Updated files:
- `src/cli/commands/bundle.ts` (2 locations)
- `src/cli/commands/adapter.ts` (2 locations)
- `src/cli/commands/list.ts`
- `src/cli/commands/inspect.ts`
- `src/cli/commands/validate.ts`
- `src/cli/commands/verify.ts` (2 locations)
- `tests/repomix/adapter.test.ts`
- `scripts/repomix-version-smoke.ts`

### 6. Bundle Command - Dynamic Version

**Before:**
```typescript
const manifest = buildManifest({
  // ...
  repomixVersion: REPOMIX_VERSION,
});
```

**After:**
```typescript
const manifest = buildManifest({
  // ...
  repomixVersion: (await getRepomixCapabilities()).packageVersion,
});
```

## Capability Detection Strategy

### Step A: Runtime Identification (Informational)
Detects and reports:
- Package name (should be `@wstein/repomix`)
- Package version (from package.json)

### Step B: Feature Detection
Checks for required exports:
- `mergeConfigs` function
- `pack` function  
- `packStructured` function

### Step C: Gating by Capability
- **Required contract:** ALL THREE exports must be present
- **Error message:** Clear explanation of which exports are missing
- **Exit code:** 5 (adapter compatibility error)

Example error:
```
Incompatible @wstein/repomix adapter contract:
Installed @wstein/repomix does not export packStructured(); structured render plan support is required by this cx-cli version.
```

### Step D: Adapter Report
`cx adapter capabilities` now shows:

```
cx version:                0.1.0
Repomix package:           @wstein/repomix
Repomix version:           1.13.1-cx.1
adapter contract:          repomix-pack-v1
compatibility strategy:    runtime-capability detection
contract valid:            YES

Detected capabilities:
  mergeConfigs:            YES
  pack:                    YES
  packStructured:          YES
```

## Installation & Authentication

### For Local Development

1. Create GitHub Personal Access Token (PAT):
   - Go to https://github.com/settings/tokens/new
   - Check `read:packages` scope
   - Copy the token

2. Set environment variable:
   ```bash
   export GITHUB_PACKAGES_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

3. Install dependencies:
   ```bash
   bun install
   # or npm install  
   # or yarn install
   ```

### For GitHub Actions CI/CD

The workflow automatically has access via `${{ secrets.GITHUB_TOKEN }}`:

```yaml
- run: bun install
  env:
    GITHUB_PACKAGES_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Benefits of This Approach

1. **Package Identity is Honest**
   - Clear that this is a variant via `@wstein` scope
   - Not masquerading as official `repomix`

2. **Deterministic Versions**
   - Pinned to `1.13.1-cx.1` (not a git branch)
   - Reproducible builds
   - Better for CI/CD

3. **Capability-Based Gating**
   - More flexible than semver string matching
   - Future-proof for version changes
   - Clear error messages when capabilities missing

4. **Single Version Install**
   - No conflicts with official `repomix` npm package
   - Can coexist in same monorepo if needed

5. **CI Integration Ready**
   - GitHub Actions automatic auth
   - Works with scoped packages via .npmrc
   - Environment variable injection for local dev

## Testing

All existing tests have been updated to work with async `getRepomixCapabilities()`:

```bash
bun run build    # Compile TypeScript
bun run lint     # Check formatting/linting
bun run test     # Run test suite
bun run verify   # Full verification
```

## Configuration Files

Created/updated:
- `.npmrc` - GitHub Packages registry mapping
- `SETUP_WSTEIN_REPOMIX.md` - User setup guide
- `package.json` - Dependency updated

## Migration Path

To move existing cx-cli installations to use this:

1. **Publish @wstein/repomix@1.13.1-cx.1 to GitHub Packages**
   - Tag the fork with `v1.13.1-cx.1`
   - Follow GitHub Publishing docs
   - Verify with `npm view @wstein/repomix`

2. **Users update their environment**
   - `export GITHUB_PACKAGES_TOKEN=...`
   - `bun install` (or npm/yarn equivalent)

3. **Verify  with adapter command**
   - `cx adapter capabilities`
   - Check that all capabilities show YES

## Rollback

If you need to revert to official `repomix`:

In `package.json`:
```json
"repomix": "^1.13.1"
```

Remove `.npmrc` or reset it:
```ini
# (leave empty or delete file)
```

Then:
```bash
rm -rf node_modules bun.lockb && bun install
```

# Makefile for TypeScript/Node.js workspaces.
#
# Provides a normalized interface for package manager commands and native
# workspace tasks.
#
# Package manager selection is lockfile-first:
#   bun.lock*                -> bun
#   pnpm-lock.yaml           -> pnpm
#   yarn.lock                -> yarn
#   package-lock.json / npm-shrinkwrap.json -> npm
#   no lockfile              -> npm
#
# Usage:
#   make install  # install dependencies using the detected package manager
#   make build    # run the package manager build command
#   make test     # run the package manager test command
#   make check    # run typecheck/check when configured; otherwise skip
#   make lint     # run lint when configured; otherwise skip
#   make verify   # run lint + check + test + build
#   make certify  # run certify if configured; otherwise fall back to verify
#   make clean    # remove generated output
#   make notes    # show the notes directory path
#
BUN ?= bun
PNPM ?= pnpm
NPM ?= npm
YARN ?= yarn
NODE ?= node
CLEAN_DIR ?= dist

.PHONY: all install build test check lint verify certify clean notes help
all: build

install: ## Install dependencies using the detected package manager.
	@if [ -f bun.lockb ] || [ -f bun.lock ]; then \
		$(BUN) install; \
	elif [ -f pnpm-lock.yaml ]; then \
		$(PNPM) install; \
	elif [ -f yarn.lock ]; then \
		$(YARN) install; \
	elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
		$(NPM) install; \
	else \
		$(NPM) install; \
	fi

build: ## Build the project using the detected package manager.
	@if [ -f bun.lockb ] || [ -f bun.lock ]; then \
		$(BUN) run build; \
	elif [ -f pnpm-lock.yaml ]; then \
		$(PNPM) run build; \
	elif [ -f yarn.lock ]; then \
		$(YARN) run build; \
	elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
		$(NPM) run build; \
	else \
		$(NPM) run build; \
	fi

test: ## Run tests using the detected package manager.
	@if [ -f bun.lockb ] || [ -f bun.lock ]; then \
		$(BUN) test; \
	elif [ -f pnpm-lock.yaml ]; then \
		$(PNPM) test; \
	elif [ -f yarn.lock ]; then \
		$(YARN) test; \
	else \
		$(NPM) test; \
	fi

check: ## Run typecheck/check when configured in package.json; otherwise skip.
	@if $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'typecheck') ? 0 : 1)"; then \
		if [ -f bun.lockb ] || [ -f bun.lock ]; then \
			$(BUN) run typecheck; \
		elif [ -f pnpm-lock.yaml ]; then \
			$(PNPM) run typecheck; \
		elif [ -f yarn.lock ]; then \
			$(YARN) typecheck; \
		else \
			$(NPM) run typecheck; \
		fi; \
	elif $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'check') ? 0 : 1)"; then \
		if [ -f bun.lockb ] || [ -f bun.lock ]; then \
			$(BUN) run check; \
		elif [ -f pnpm-lock.yaml ]; then \
			$(PNPM) run check; \
		elif [ -f yarn.lock ]; then \
			$(YARN) check; \
		else \
			$(NPM) run check; \
		fi; \
	else \
		printf "Skipping check: no typecheck or check script defined in package.json\n"; \
	fi

lint: ## Run lint when configured in package.json; otherwise skip.
	@if $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'lint') ? 0 : 1)"; then \
		if [ -f bun.lockb ] || [ -f bun.lock ]; then \
			$(BUN) run lint; \
		elif [ -f pnpm-lock.yaml ]; then \
			$(PNPM) run lint; \
		elif [ -f yarn.lock ]; then \
			$(YARN) lint; \
		else \
			$(NPM) run lint; \
		fi; \
	else \
		printf "Skipping lint: no lint script defined in package.json\n"; \
	fi

verify: ## Run the standard local quality gate.
	@$(MAKE) lint && $(MAKE) check && $(MAKE) test && $(MAKE) build

certify: ## Run certify when configured in package.json; otherwise fall back to verify.
	@if $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'certify') ? 0 : 1)"; then \
		if [ -f bun.lockb ] || [ -f bun.lock ]; then \
			$(BUN) run certify; \
		elif [ -f pnpm-lock.yaml ]; then \
			$(PNPM) run certify; \
		elif [ -f yarn.lock ]; then \
			$(YARN) certify; \
		else \
			$(NPM) run certify; \
		fi; \
	else \
		printf "No certify script defined in package.json; falling back to make verify\n"; \
		$(MAKE) verify; \
	fi

clean: ## Remove generated output files.
	rm -rf node_modules dist "$(CLEAN_DIR)"

notes: ## Print the notes directory path.
	@printf "Notes directory: notes\n"

help: ## Show available targets.
	@printf "Available targets:\n  install build test check lint verify certify clean notes\n"

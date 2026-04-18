# Makefile for CX.
#
# A slim shim for the workspace build and test commands.
# It intentionally delegates to Bun and avoids package-manager detection logic.
#
BUN ?= bun

.PHONY: all build test coverage verify format fix lint release clean notes smoke help
all: build

build: ## Build the project.
	$(BUN) run build

format: ## Format the project source.
	$(BUN) run format

lint: ## Run lint checks and boundary validation.
	$(BUN) run lint

test: ## Run unit tests with coverage.
	$(BUN) run coverage

coverage: ## Run tests with coverage.
	$(BUN) run coverage

verify: ## Run lint, typecheck, build, and the full test suite with coverage.
	$(BUN) run verify

fix: ## Correct fixable formatting and lint issues.
	$(BUN) run fix

release: ## Release a new version (VERSION=x.y.z required).
	$(BUN) run release

clean: ## Remove generated output files.
	$(BUN) run clean

notes: ## List available notes in the repository.
	cx notes list
	cx notes orphans

smoke: ## Run repomix version smoke test.
	$(BUN) run smoke:repomix-version

help: ## Show available targets.
	@printf "Available targets:\n"
	@printf "  build     Build the project.\n"
	@printf "  test      Run unit tests with coverage.\n"
	@printf "  coverage  Run tests with coverage.\n"
	@printf "  verify    Run lint, typecheck, build, and the full test suite with coverage.\n"
	@printf "  release   Release a new version (VERSION=x.y.z required).\n"
	@printf "  clean     Remove generated output files.\n"
	@printf "  notes     List available notes in the repository.\n"
	@printf "  smoke     Run repomix version smoke test.\n"

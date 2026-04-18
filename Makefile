# Makefile for CX.
#
# A slim shim for the workspace build and test commands.
# It intentionally delegates to Bun and avoids package-manager detection logic.
#
BUN ?= bun

.PHONY: all build test verify certify check format fix lint release clean notes smoke help
all: build

build: ## Build the project.
	$(BUN) run build

format: ## Format the project source.
	$(BUN) run format

lint: ## Run lint checks and boundary validation.
	$(BUN) run lint

test: ## Run the default unit test suite via package.json, with coverage.
	$(BUN) run test

verify: ## Run lint, typecheck, build, and the full test suite with coverage.
	$(BUN) run verify

certify: ## Run verify plus a reproducibility check (CI-grade local gate).
	$(BUN) run certify

check: verify ## Alias for verify.

fix: ## Correct fixable formatting and lint issues.
	$(BUN) run fix

release: ## Release a new version (VERSION=x.y.z required).
	$(BUN) run release

clean: ## Remove generated output files.
	$(BUN) run clean

notes: ## List available notes in the repository.
	$(BUN) run notes

smoke: ## Run repomix version smoke test.
	$(BUN) run smoke

help: ## Show available targets.
	@printf "Available targets:\n"
	@printf "  build     Build the project.\n"
	@printf "  test      Run unit tests with coverage.\n"
	@printf "  verify    Run lint, typecheck, build, and the full test suite with coverage.\n"
	@printf "  certify   Run verify plus a reproducibility check (CI-grade local gate).\n"
	@printf "  check     Alias for verify.\n"
	@printf "  release   Release a new version (VERSION=x.y.z required).\n"
	@printf "  clean     Remove generated output files.\n"
	@printf "  notes     List available notes in the repository.\n"
	@printf "  smoke     Run repomix version smoke test.\n"

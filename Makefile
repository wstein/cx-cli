# Makefile for CX.
#
# A slim shim for the workspace build and test commands.
# It intentionally delegates to Bun and avoids package-manager detection logic.
#
BUN ?= bun

.PHONY: all build test coverage verify release clean notes help
all: build

build: ## Build the project.
	$(BUN) run build

test: ## Run unit tests.
	$(BUN) run test:unit

coverage: ## Run tests with coverage.
	$(BUN) run coverage

verify: ## Run lint, typecheck, build, and the full test suite.
	$(BUN) run verify

release: ## Release a new version (VERSION=x.y.z required).
	$(BUN) run release

clean: ## Remove generated output files.
	$(BUN) run clean

notes: ## List available notes in the repository.
	cx notes list
	cx notes orphans

help: ## Show available targets.
	@printf "Available targets:\n  build test coverage verify release clean notes\n"

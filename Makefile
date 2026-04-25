# Makefile for CX.
#
# A slim shim for the workspace build and test commands.
# It intentionally delegates to Bun and avoids package-manager detection logic.
#
BUN ?= bun

.PHONY: all build test unit verify certify check format fix lint release clean notes notes-check notes-graph notes-drift docs-compile docs-drift smoke help
all: build

build: ## Build the project.
	$(BUN) run build

format: ## Format the project source.
	$(BUN) run format

lint: ## Run lint checks and boundary validation.
	$(BUN) run lint

test: ## Run the fast unit test suite via package.json.
	$(BUN) run test

unit: ## Run the unit-only test suite via package.json.
	$(BUN) run test:unit

verify: ## Run lint, typecheck, build, Vitest coverage, and Bun compatibility smoke.
	$(BUN) run verify

certify: ## Run verify plus contracts, smoke lanes, release integrity smoke, and reproducibility.
	$(BUN) run certify

check: ## Run typecheck only using the package.json check script.
	$(BUN) run check

fix: ## Correct fixable formatting and lint issues.
	$(BUN) run fix

release: ## Run the two-phase release wizard (VERSION=vX.Y.Z optional).
	$(BUN) run release

clean: ## Remove generated output files.
	$(BUN) run clean

notes: ## List available notes in the repository.
	$(BUN) run notes

notes-check: ## Validate repository notes and graph references.
	$(BUN) ./bin/cx notes check

notes-graph: ## Emit the unified notes graph as JSON.
	$(BUN) ./bin/cx notes graph --format json

notes-drift: ## Check note-to-code/spec/doc drift through notes validation.
	$(BUN) ./bin/cx notes check

docs-compile: ## Compile generated architecture docs from notes.
	$(BUN) ./bin/cx docs compile --profile architecture

docs-drift: ## Check generated docs for drift from notes.
	$(BUN) ./bin/cx docs drift

smoke: ## Run repomix version smoke test.
	$(BUN) run smoke

help: ## Show available targets.
	@printf "Available targets:\n"
	@printf "  build     Build the project.\n"
	@printf "  test      Run the fast unit test suite via package.json.\n"
	@printf "  unit      Run the unit-only test suite via package.json.\n"
	@printf "  verify    Run lint, typecheck, build, Vitest coverage, and Bun compatibility smoke.\n"
	@printf "  certify   Run verify plus contracts, smoke lanes, release integrity smoke, and reproducibility.\n"
	@printf "  check     Run typecheck only using the package.json check script.\n"
	@printf "  release   Run the two-phase release wizard (VERSION=vX.Y.Z optional).\n"
	@printf "  clean     Remove generated output files.\n"
	@printf "  notes     List available notes in the repository.\n"
	@printf "  notes-check Validate repository notes and graph references.\n"
	@printf "  notes-graph Emit the unified notes graph as JSON.\n"
	@printf "  notes-drift Check note-to-code/spec/doc drift through notes validation.\n"
	@printf "  docs-compile Compile generated architecture docs from notes.\n"
	@printf "  docs-drift Check generated docs for drift from notes.\n"
	@printf "  smoke     Run repomix version smoke test.\n"

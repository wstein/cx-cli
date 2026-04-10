# Makefile for cx-cli
# Inspired by Go project-style workflows: simple targets, a default help target,
# and a shared toolchain for install/build/test/lint.

SHELL := /bin/bash
BUN := bun

.DEFAULT_GOAL := help

.PHONY: help install build rebuild dev format test lint ci clean

help:
	@echo "Usage: make <target>"
	@echo
	@echo "Available targets:"
	@echo "  install      Install project dependencies"
	@echo "  build        Compile TypeScript sources"
	@echo "  rebuild      Rebuild dist from scratch"
	@echo "  dev          Run TypeScript in watch mode"
	@echo "  test         Run the test suite"
	@echo "  lint         Run type-check linting"
	@echo "  ci           Run install, build, test, lint"
	@echo "  format       Format source files with Oxfmt"
	@echo "  clean        Remove generated artifacts"

install:
	$(BUN) install

build:
	$(BUN) run build

rebuild:
	rm -rf dist
	$(BUN) run build

dev:
	$(BUN) run dev

format:
	$(BUN) x oxfmt --write .

test:
	$(BUN) run test

lint:
	$(BUN) run lint

ci: install build test lint

clean:
	rm -rf dist

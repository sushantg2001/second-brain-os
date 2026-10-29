# Second Brain OS: one entry point for local work and CI. `make help` lists targets.
# CI calls these same targets, so a green `make ci` locally means a green pipeline.

SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

BUN ?= bun
VAULT ?=
PLUGIN_ID := $(shell sed -n 's/.*"id": "\(.*\)".*/\1/p' manifest.json)
VERSION := $(shell sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)

.PHONY: help
help: ## List targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ---- Setup
.PHONY: install
install: ## Install dependencies exactly as locked
	$(BUN) install --frozen-lockfile

node_modules: package.json bun.lock
	$(BUN) install --frozen-lockfile
	@touch node_modules

## ---- Develop
.PHONY: dev
dev: node_modules ## Watch build into dist/ (unminified, source maps, hot reload marker)
	$(BUN) run dev

.PHONY: link
link: ## Symlink dist/ into a vault: make link VAULT=/path/to/vault
	@test -n "$(VAULT)" || { echo "Set VAULT=/path/to/vault"; exit 1; }
	mkdir -p "$(VAULT)/.obsidian/plugins"
	ln -sfn "$(CURDIR)/dist" "$(VAULT)/.obsidian/plugins/$(PLUGIN_ID)"

## ---- Quality gates
.PHONY: format
format: node_modules ## Format every file
	$(BUN) run format

.PHONY: format-check
format-check: node_modules ## Fail on unformatted files
	$(BUN) run format:check

.PHONY: lint
lint: node_modules ## ESLint, including architecture boundaries, zero warnings
	$(BUN) run lint

.PHONY: typecheck
typecheck: node_modules ## TypeScript strict typecheck
	$(BUN) run typecheck

.PHONY: test
test: node_modules ## All test suites
	$(BUN) run test

.PHONY: test-unit
test-unit: node_modules ## Unit tests only (pure domain and kernel)
	$(BUN) run test:unit

.PHONY: test-component
test-component: node_modules ## React component tests only
	$(BUN) run test:component

.PHONY: coverage
coverage: node_modules ## Tests with coverage thresholds from bunfig.toml
	$(BUN) run test:coverage

.PHONY: build
build: node_modules ## Production build into dist/
	$(BUN) run build

.PHONY: check-bundle
check-bundle: build ## Size budget and load smoke test of dist/main.js
	$(BUN) run check:bundle

.PHONY: check
check: format-check lint typecheck coverage check-bundle ## Every gate in the Definition of Done

.PHONY: ci
ci: install check ## What the CI pipeline runs

## ---- Release
.PHONY: version
version: ## Bump version files: make version BUMP=patch|minor|major|x.y.z[-pre.N]
	@test -n "$(BUMP)" || { echo "Set BUMP=patch|minor|major|x.y.z"; exit 1; }
	$(BUN) run version:bump $(BUMP)

.PHONY: release-plan
release-plan: ## Show the version the release pipeline would publish from commits since the last tag
	$(BUN) scripts/release-plan.ts
	@rm -f RELEASE_NOTES.md

.PHONY: package
package: check-bundle ## Zip dist/ for a manual install
	cd dist && zip -q "../$(PLUGIN_ID)-$(VERSION).zip" main.js manifest.json styles.css

## ---- Housekeeping
.PHONY: clean
clean: ## Remove build and test output
	rm -rf dist coverage *.zip

.PHONY: distclean
distclean: clean ## Also remove node_modules
	rm -rf node_modules

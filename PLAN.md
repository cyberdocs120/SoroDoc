# SoroDoc — 10-Day Development Sprint Plan

## Goal

Simulate **10 days of intensive development** to bring SoroDoc to **~65% completion**, delivering a robust, contributor-ready foundation with working core infrastructure, CLI, SDK, AI engine integration, and CI/CD pipelines — all aligned with the existing README vision.

## Completion targets by area

| Area | Target | Key deliverables |
|------|--------|------------------|
| Monorepo scaffolding | 100% | Turborepo, workspaces, tsconfig, build pipeline |
| `@sorodoc/core` | 80% | ABI/Source/Event/Error parsers, AI engine wiring, Markdown + OpenAPI renderers |
| `@sorodoc/cli` | 90% | All commands scaffolded, `generate` + `sdk` + `serve` working |
| `@sorodoc/sdk` | 80% | `SoroDoc` class, `SDKGenerator`, `generateFromDeployed` |
| Codegen | 60% | TypeScript SDK generator working; Python + Rust stubbed |
| `@sorodoc/api` | 40% | Fastify server, auth middleware, `POST /generate` routes |
| `@sorodoc/studio` | 20% | React skeleton with upload panel and preview pane |
| Templates | 70% | Docusaurus base, TS SDK template, OpenAPI base |
| Docker / infra | 60% | Dockerfiles, docker-compose, Helm chart |
| CI/CD | 80% | GitHub Actions for CI, release, docs generation |
| Examples | 50% | Token contract example with generated output |
| Documentation | 50% | CONTRIBUTING.md, setup guide, config reference |

---

## Day 1 — Monorepo foundation & core architecture

**Goal:** Scaffold the entire monorepo, establish build pipelines, and implement the core data model and ABI parser.

**Prompt:**
Initialize the SoroDoc monorepo using Turborepo with npm workspaces. Create the root `package.json` with workspaces pointing to `packages/*`, install TypeScript across all packages, create shared `tsconfig.json` bases, and set up Turbo pipeline config. Scaffold the full directory structure matching the README. Then implement `packages/core/src/index.ts` with the shared types (`ContractABI`, `FunctionSpec`, `EventSpec`, `ErrorSpec`, `DocOutput`, `SDKOutput`). Build the `ABIParser` class that reads a Soroban WASM buffer via `soroban-spec` and outputs the core ABI types. The parser must handle function signatures, custom types, error enums, and event topics. Write unit tests with a mock WASM fixture.

---

## Day 2 — Source parser, event parser & error parser

**Goal:** Complete the remaining three parsers in `@sorodoc/core` so the full extraction pipeline works end-to-end.

**Prompt:**
Implement `SourceParser` to extract Rust doc comments (`///`), `@sorodoc` custom tags (`@sorodoc:category`, `@sorodoc:since`, `@sorodoc:example-highlight`), and inline struct/enum comments from `.rs` source files. Implement `EventParser` that scans the ABI for event topic schemas and maps them to structured `EventSpec` objects. Implement `ErrorParser` that extracts error enum variants from contract metadata and produces `ErrorSpec` entries with codes and messages. Wire all four parsers into a single `parseContract(options)` orchestrator in `core/src/index.ts`. Add integration tests that verify the combined output against a known Soroban contract spec.

---

## Day 3 — AI documentation engine

**Goal:** Build the AI layer that calls Anthropic Claude to generate human-readable docs from parsed contract data.

**Prompt:**
Implement `DocEngine` in `packages/core/src/ai/DocEngine.ts`. It sends the structured ABI (function signatures, types, error codes, events) to the Anthropic Claude API (`claude-sonnet-4`) and receives back JSON with descriptions for each function, parameter, return value, error code, and event. Implement `FunctionDocWriter` for per-function AI passes with retry logic. Implement `ErrorDocWriter` for the error catalogue. Implement `ExampleGenerator` that requests runnable code examples in TypeScript, Python, and Rust from the AI. Implement `ValidationPass` that does a second AI call to check consistency and correctness. Support configurable tone modes (`technical`, `friendly`, `enterprise`, `educational`) and custom AI instructions per the README config schema. All AI calls must include proper error handling, rate limiting, and token budgeting.

---

## Day 4 — CLI scaffold & generate command

**Goal:** Build the CLI entry point and the primary `sorodoc generate` command with full option parsing.

**Prompt:**
Scaffold `packages/cli/src/index.ts` using `commander` or `yargs` with commands: `generate`, `sdk`, `serve`, `studio`, `version`, `portal`. Implement `generate.ts` — the flagship command. It must accept `--wasm`, `--source`, `--contract`, `--network`, `--name`, `--out`, `--config`, `--watch` flags. Wire it to the core pipeline: parse WASM → extract ABI → optionally enrich with source → run AI doc engine → render outputs. Implement the full output pipeline that writes Markdown files (with frontmatter), docusaurus site scaffold, and OpenAPI spec. Show a rich terminal progress display (parsing, AI generation, SDK generation, rendering phases) matching the example output in the README. The `--watch` flag must use `chokidar` to re-trigger generation on file changes.

---

## Day 5 — SDK generator (TypeScript) & CLI sdk command

**Goal:** Generate fully typed TypeScript SDKs from contract ABI, and expose via `sorodoc sdk`.

**Prompt:**
Implement `TypeScriptSDK.ts` in `packages/core/src/codegen/`. It must produce a complete TypeScript SDK file including: typed interfaces for each function's parameters, a union type for all contract errors with code+message pairs, a main contract class with typed methods for every ABI function, JSDoc comments on every method (pulled from AI doc output), constructor accepting `contractId`, `networkPassphrase`, and `rpcUrl`, and realistic example code in JSDoc `@example` tags. The generated SDK must match the look and structure shown in the README. Then implement `sdk.ts` CLI command that accepts `--wasm`, `--lang` (ts/rs/py), `--out`, `--package-name`. Implement `SDKGenerator` in the SDK package that exposes `generate({ abi, packageName, version, network, contractId })`.

---

## Day 6 — Markdown & OpenAPI renderers, API server scaffold

**Goal:** Complete the rendering layer and begin the REST API.

**Prompt:**
Finalize `MarkdownRenderer.ts` — it must produce the full directory structure shown in the README (`functions/*.md`, `events/*.md`, `errors/error-reference.md`, `sdk/quickstart.md`) with proper frontmatter, cross-linking between pages, and AI-generated prose. Finalize `OpenAPIRenderer.ts` — generate an OpenAPI 3.1 spec mapping every Soroban function to a `POST /invoke/{functionName}` path with typed request bodies, response schemas, and error responses matching the error catalogue. Then scaffold `packages/api/src/server.ts` with Fastify, implementing `POST /generate` that accepts WASM upload or contract ID, runs the full pipeline, and returns generated docs/SDKs. Implement JWT auth middleware (stubbed for now) and the workspace CRUD routes.

---

## Day 7 — Templates, docusaurus renderer & docker setup

**Goal:** Create output templates, finish the Docusaurus site generator, and containerize everything.

**Prompt:**
Create `templates/docusaurus/` with `docusaurus.config.js`, `sidebars.js`, custom CSS, and base MDX pages. Implement `DocusaurusRenderer.ts` that copies templates and injects generated content. Create `templates/sdk/typescript/` and `templates/sdk/python/` with `package.json`, `tsconfig.json`, and README scaffolding. Create `templates/openapi/base.yaml`. Set up Docker: `docker/Dockerfile` (multi-stage, prod), `Dockerfile.dev` (hot-reload), `docker-compose.yml` (API + Postgres + Redis). Ensure docker-compose supports the full stack from the README. Create `.env.example` with all required variables (Anthropic API key, JWT secret, Postgres/Redis URLs, portal config).

---

## Day 8 — Python & Rust codegen stubs, studio skeleton, examples

**Goal:** Stub remaining SDK generators, create the Web Studio skeleton, and write example contracts.

**Prompt:**
Implement `PythonSDK.ts` — generate idiomatic Python SDK with `@dataclass` param classes, typed methods, docstrings, and `stellar_sdk` imports matching the README example. Implement `RustClient.ts` — generate async tokio-based Rust client. Both should handle at least 80% of common Soroban types (address, i128, u32, symbol, bytes, vec, map, option). Then scaffold `packages/studio/` as a Vite + React 18 + Tailwind CSS app with placeholder pages: `UploadPanel` (drag-and-drop WASM + contract ID input), `PreviewPane` (placeholder split view). Create `examples/token-contract/src/lib.rs` — a full Soroban token contract with doc comments, events, error enums, and `@sorodoc` tags. Generate sample output into `examples/token-contract/generated/`.

---

## Day 9 — CI/CD pipelines, versioning, portal deployment & Helm

**Goal:** Production CI/CD, contract versioning feature, portal deploy command, and Kubernetes support.

**Prompt:**
Create `.github/workflows/ci.yml` — lint, typecheck, test on PR across Node 18/20/22. Create `.github/workflows/release.yml` — publish `@sorodoc/cli`, `@sorodoc/sdk`, `@sorodoc/core` to npm on version tag. Create `.github/workflows/sorodoc.yml` — example consumer workflow matching the README. Implement `version.ts` CLI command: `sorodoc version tag`, `sorodoc version list`, `sorodoc version diff` that compares two contract specs and produces the diff output shown in the README. Implement `portal.ts` CLI: `sorodoc portal deploy` that packages and uploads docs. Create `helm/sorodoc/` with Chart.yaml, values.yaml, and templates (deployment, service, ingress, configmap, secrets) for Kubernetes deployment.

---

## Day 10 — Polish, CONTRIBUTING guide, error handling & final audit

**Goal:** Hardening, documentation for contributors, and comprehensive edge-case handling.

**Prompt:**
Write `CONTRIBUTING.md` with setup instructions, PR流程, coding conventions, and testing guidelines. Add robust error handling across all packages: graceful AI API failures with fallback descriptions, WASM parse errors with clear messages, file system error handling, and config validation with Zod or Joi. Audit every CLI command for consistent exit codes, `--help` output, and edge cases (missing files, invalid WASM, network timeouts). Ensure all packages export proper TypeScript types and have public API documentation. Run the full lint/typecheck/test suite across the monorepo and fix all issues. Add a `turbo.json` pipeline with `lint`, `typecheck`, `test`, `build` tasks configured for dependency-aware caching. Tag the repository as `v0.1.0` to mark the foundation complete.

---

## Post-sprint summary

After 10 days the repository should contain:

- **6 packages** (`cli`, `sdk`, `core`, `api`, `studio`, `codegen`) with working builds
- **4 parsers** (ABI, Source, Event, Error) extracting full contract specs
- **AI engine** driving doc generation via Anthropic Claude
- **3 renderers** (Markdown, Docusaurus, OpenAPI) producing polished output
- **3 SDK generators** (TypeScript functional, Python/Rust working for common types)
- **CLI** with all commands operational (`generate`, `sdk`, `serve`, `studio`, `version`, `portal`)
- **REST API** with auth middleware and generation endpoint
- **Web Studio** React skeleton
- **Docker Compose** full-stack development environment
- **Helm chart** for Kubernetes deployment
- **4 CI/CD workflows** (CI, release, docs generation, PR diff)
- **Example contract** with verified generated output
- **Contributor documentation** and polished error handling

**Remaining 35%** (post-sprint):
- Python/Rust SDK generators full feature parity
- Web Studio complete with live generation streaming, SDK playground, team workspaces
- React hooks library generation
- Enterprise portal analytics dashboard
- SAML/OIDC auth providers
- PDF export
- Translations / i18n
- Performance optimization for large contracts
- Extensive test coverage (unit + integration + e2e)

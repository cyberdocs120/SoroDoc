# Contributing to SoroDoc

Thank you for your interest in contributing to SoroDoc! This guide will help you get started with our monorepo and understand our development process.

## Architecture Overview

SoroDoc is a monorepo managed with [Turborepo](https://turbo.build/) and `npm` workspaces.

- **`packages/core`**: The heart of SoroDoc. Contains parsers (ABI, Source, Event, Error), the AI documentation engine, and renderers (Markdown, Docusaurus, OpenAPI).
- **`packages/cli`**: The command-line interface.
- **`packages/sdk`**: The client-side SDK for programmatic use.
- **`packages/api`**: Fastify-based REST API for the SoroDoc backend.
- **`packages/studio`**: React-based web dashboard (WIP).
- **`packages/codegen`**: Shared logic for generating SDKs in various languages.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- [Rust & Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup) (for testing with actual contracts)

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/sorodoc/sorodoc.git
   cd sorodoc
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and add your API keys:
   ```bash
   cp .env.example .env
   ```
   _Required:_ `ANTHROPIC_API_KEY` is needed for the AI documentation engine.

### Development Workflow

Start all packages in development mode (with watch scripts):

```bash
npm run dev
```

Build all packages:

```bash
npm run build
```

## Coding Conventions

### TypeScript

- Use **TypeScript** for all new code.
- Prefer **interfaces** over types for public APIs.
- Export all public types from `index.ts` of each package.
- All files should use **ES Modules** (`.ts` with `.js` imports).

### Error Handling

- Use descriptive error messages.
- In `core`, use the `DocEngine` fallbacks for AI failures to ensure documentation can still be generated even without an API key or on rate limits.
- Validate configuration and user input using **Zod** (see `packages/core/src/types.ts`).

### Testing

We use [Vitest](https://vitest.dev/) for testing.

- **Unit tests**: Place in `test/` folder within each package (e.g., `packages/core/test/ABIParser.test.ts`).
- **Integration tests**: Place in `packages/core/test/Integration.test.ts`.

Run all tests:

```bash
npm test
```

## Pull Request Process

1. Create a new branch: `git checkout -b feat/your-feature-name`.
2. Ensure all tests pass: `npm test`.
3. Ensure the project builds: `npm run build`.
4. Ensure linting passes: `npm run lint`.
5. Submit a PR against the `main` branch.
6. Provide a clear description of the changes and link any relevant issues.

## Release Process

We use semantic versioning. Releases are automated via GitHub Actions when a new version tag (e.g., `v0.1.0`) is pushed.

---

_Found a bug? Open an issue! Have a question? Join our Discord (link in README)._

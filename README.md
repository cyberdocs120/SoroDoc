# 📚 SoroDoc

### AI-Powered Documentation, SDK & API Reference Generator for Stellar / Soroban Smart Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-7C3AED?logo=stellar)](https://soroban.stellar.org)
[![Built with Claude](https://img.shields.io/badge/AI-Claude%20Sonnet-FF6B35)](https://anthropic.com)
[![Status: Beta](https://img.shields.io/badge/Status-Beta-yellow)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![npm version](https://img.shields.io/npm/v/@sorodoc/cli)](https://www.npmjs.com/package/@sorodoc/cli)

---

> **SoroDoc** is an enterprise-grade, AI-powered developer toolchain that automatically generates rich documentation, typed SDKs, and interactive API references directly from your Soroban smart contract ABI, WASM binary, and Rust source. Stop writing docs by hand — SoroDoc reads your contracts, understands your intent, and produces developer-ready output in seconds.

---

## 📑 Table of Contents

- [Why SoroDoc?](#-why-sorodoc)
- [Key Features](#-key-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#-usage)
  - [CLI](#cli-usage)
  - [SDK / API](#sdk--api-usage)
  - [Web Studio](#web-studio)
- [Output Formats](#-output-formats)
- [AI Documentation Engine](#-ai-documentation-engine)
- [Generated SDK Reference](#-generated-sdk-reference)
- [Enterprise Features](#-enterprise-features)
- [Soroban Contract Integration](#-soroban-contract-integration)
- [CI/CD Integration](#-cicd-integration)
- [Security Model](#-security-model)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Why SoroDoc?

Soroban contracts expose a rich ABI — function signatures, argument types, return values, error codes, events — but turning that into developer-friendly documentation has always been a manual, painful, and perpetually out-of-date process.

| Problem | Without SoroDoc | With SoroDoc |
|---|---|---|
| Writing docs | Manual, hours per contract | Auto-generated in < 30 seconds |
| SDK generation | Custom per-project boilerplate | Typed TypeScript/Python SDKs on demand |
| Docs staying current | Drift between code and docs | Regenerated on every contract change |
| Onboarding new devs | Read the Rust source or pray | Interactive API explorer with examples |
| Multi-language support | Re-document per language | One source, many language outputs |
| Error code documentation | Scattered or missing | AI-explained error catalogue auto-built |
| Enterprise doc portals | Manual HTML/PDF effort | Branded, hosted doc sites out of the box |

SoroDoc treats your **contract as the source of truth** and derives everything else from it — docs, SDKs, type definitions, error references, usage examples, and interactive playgrounds.

---

## ✨ Key Features

### 📖 AI-Powered Documentation Generation
- **Natural language function descriptions** — AI reads your Rust source and doc comments to write clear, accurate prose explanations
- **Argument & return value documentation** — every parameter explained with type info, constraints, and examples
- **Error catalogue** — full mapping of error codes to human-readable descriptions with common causes and fixes
- **Event documentation** — auto-documents every `env.events().publish()` call with payload schema
- **Usage examples** — AI generates realistic, runnable code examples for every function in TypeScript, Python, and Rust

### 🧰 SDK Generation
- **TypeScript/JavaScript SDK** — fully typed, promise-based, tree-shakeable
- **Python SDK** — idiomatic, type-annotated, pip-installable
- **Rust client library** — async/tokio, ready to publish to crates.io
- **React hooks library** — `useContractCall`, `useContractEvent`, and more for dApp frontends
- **SDK versioning** — SDKs are versioned alongside your contract deployments

### 🗺 Interactive API Reference
- **Swagger/OpenAPI-style explorer** — try any function directly in the browser
- **Live testnet execution** — connect a wallet and call functions against testnet from the docs
- **XDR inspector** — decode raw XDR responses inline
- **Call trace viewer** — inspect the full execution trace of any example call

### 🏢 Enterprise-Grade Features
- **Branded doc portals** — white-label hosted documentation with custom domain support
- **Multi-contract workspaces** — document an entire protocol suite in one portal
- **Versioned docs** — maintain docs for multiple deployed contract versions simultaneously
- **Access control** — private/internal docs for unreleased contracts
- **Analytics** — see which functions developers actually use and where they get stuck

---

## 🏗 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          SoroDoc Platform                            │
│                                                                      │
│  Input Sources                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  WASM Binary │  │  Rust Source │  │  Deployed Contract ID    │  │
│  │  (.wasm)     │  │  (.rs files) │  │  (live ABI fetch)        │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         └─────────────────┼──────────────────────--┘                │
│                           ▼                                          │
│              ┌────────────────────────┐                              │
│              │     ABI Parser &       │                              │
│              │   Metadata Extractor   │                              │
│              │  (soroban-spec, XDR)   │                              │
│              └────────────┬───────────┘                              │
│                           │                                          │
│            ┌──────────────┼──────────────┐                           │
│            ▼              ▼              ▼                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  │  AI Doc      │ │  SDK         │ │  API Ref     │                 │
│  │  Engine      │ │  Generator   │ │  Builder     │                 │
│  │  (Claude)    │ │  (Codegen)   │ │  (OpenAPI)   │                 │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                 │
│         └────────────────┼────────────────┘                         │
│                          ▼                                           │
│              ┌────────────────────────┐                              │
│              │    Output Renderer     │                              │
│              │  Markdown / HTML /     │                              │
│              │  Docusaurus / GitBook  │                              │
│              └────────────┬───────────┘                              │
│                           │                                          │
│     ┌─────────────────────┼─────────────────────┐                   │
│     ▼                     ▼                     ▼                   │
│  ┌──────────┐       ┌──────────┐         ┌──────────────┐           │
│  │ npm pkg  │       │  Hosted  │         │  CI/CD       │           │
│  │ (SDK)    │       │  Portal  │         │  Artifacts   │           │
│  └──────────┘       └──────────┘         └──────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| ABI Parsing | `soroban-spec`, Stellar XDR, `stellar-contract-bindings` |
| AI Engine | Anthropic Claude API (`claude-sonnet-4`) |
| SDK Codegen | Custom AST-based code generator (TypeScript, Python, Rust) |
| Doc Rendering | Docusaurus 3, MDX, OpenAPI/Swagger UI |
| Backend API | Node.js, Fastify, TypeScript |
| Frontend Studio | React 18, Tailwind CSS, Monaco Editor |
| Database | PostgreSQL (workspaces, versions), Redis (cache) |
| Auth | JWT, SAML 2.0, OIDC |
| Deployment | Docker, Kubernetes, Helm |
| CI/CD | GitHub Actions, GitLab CI |
| Package Publishing | npm, PyPI, crates.io (automated) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Rust** >= 1.74 (for WASM compilation)
- **Stellar CLI** >= 0.9.x — [Install guide](https://soroban.stellar.org/docs/getting-started/setup)
- An **Anthropic API key** — [Get one here](https://console.anthropic.com)

### Installation

#### Global CLI

```bash
npm install -g @sorodoc/cli
```

#### Project Dev Dependency

```bash
npm install --save-dev @sorodoc/cli
# or
yarn add -D @sorodoc/cli
```

#### Self-hosted (Docker Compose)

```bash
git clone https://github.com/your-org/sorodoc.git
cd sorodoc
cp .env.example .env
# Edit .env with your credentials
docker compose up -d
```

### Configuration

Create a `sorodoc.config.json` in your project root:

```json
{
  "project": {
    "name": "My Token Protocol",
    "version": "1.0.0",
    "description": "A fungible token implementation on Soroban",
    "logo": "./assets/logo.png",
    "primaryColor": "#7C3AED"
  },
  "contracts": [
    {
      "name": "Token",
      "source": "./contracts/token/src/lib.rs",
      "wasm": "./target/wasm32-unknown-unknown/release/token.wasm",
      "deployedId": {
        "testnet": "CXXX...",
        "mainnet": "CYYY..."
      }
    },
    {
      "name": "Governance",
      "source": "./contracts/governance/src/lib.rs",
      "wasm": "./target/wasm32-unknown-unknown/release/governance.wasm"
    }
  ],
  "ai": {
    "enabled": true,
    "model": "claude-sonnet-4",
    "tone": "technical",
    "generateExamples": true,
    "exampleLanguages": ["typescript", "python", "rust"]
  },
  "output": {
    "formats": ["markdown", "docusaurus", "html"],
    "sdks": ["typescript", "python"],
    "outputDir": "./docs-generated",
    "openapi": true
  },
  "portal": {
    "theme": "dark",
    "customDomain": "docs.myprotocol.io",
    "analytics": true
  }
}
```

---

## 📖 Usage

### CLI Usage

#### Generate docs from a WASM binary

```bash
# From compiled WASM
sorodoc generate \
  --wasm ./target/wasm32-unknown-unknown/release/token.wasm \
  --name "Token Contract" \
  --out ./docs

# From a deployed contract ID (live ABI fetch)
sorodoc generate \
  --contract CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --network testnet \
  --name "Token Contract" \
  --out ./docs

# From Rust source + WASM (richest output)
sorodoc generate \
  --source ./contracts/token/src/lib.rs \
  --wasm ./target/wasm32-unknown-unknown/release/token.wasm \
  --name "Token Contract" \
  --out ./docs
```

**Example Output:**

```
🔍 Parsing contract ABI...
   ✅ Found 12 functions, 4 events, 8 error codes

🤖 Running AI documentation engine...
   ✅ Generated descriptions for 12/12 functions
   ✅ Generated 36 code examples (TypeScript, Python, Rust)
   ✅ Built error catalogue (8 entries)
   ✅ Documented 4 contract events

🧰 Generating SDKs...
   ✅ TypeScript SDK  →  ./docs/sdk/typescript/
   ✅ Python SDK      →  ./docs/sdk/python/

📄 Rendering documentation...
   ✅ Markdown        →  ./docs/markdown/
   ✅ Docusaurus site →  ./docs/docusaurus/
   ✅ OpenAPI spec    →  ./docs/openapi.yaml

⏱  Completed in 18.4s
📁 Output: ./docs  (47 files, 2.3 MB)
```

#### Generate SDK only

```bash
sorodoc sdk \
  --wasm ./target/wasm32-unknown-unknown/release/token.wasm \
  --lang typescript \
  --out ./src/sdk \
  --package-name "@myprotocol/token-sdk"
```

#### Watch mode (regenerate on contract change)

```bash
sorodoc generate --watch \
  --source ./contracts/token/src/ \
  --wasm ./target/wasm32-unknown-unknown/release/token.wasm \
  --out ./docs
```

#### Serve docs locally

```bash
sorodoc serve --dir ./docs/docusaurus
# Opens at http://localhost:3000
```

### SDK / API Usage

```typescript
import { SoroDoc } from '@sorodoc/sdk';

const sorodoc = new SoroDoc({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
});

// Generate docs from WASM buffer
const result = await sorodoc.generate({
  wasm: fs.readFileSync('./token.wasm'),
  source: fs.readFileSync('./lib.rs', 'utf-8'),
  contractName: 'Token',
  options: {
    generateExamples: true,
    exampleLanguages: ['typescript', 'python'],
    sdks: ['typescript'],
  },
});

// Access generated outputs
console.log(result.docs.markdown);        // Markdown string
console.log(result.sdk.typescript);       // Generated TS SDK
console.log(result.openapi);             // OpenAPI 3.1 spec object
console.log(result.functions);           // Structured function metadata

// Write outputs to disk
await result.writeTo('./docs-output');
```

#### Fetch ABI from deployed contract

```typescript
const result = await sorodoc.generateFromDeployed({
  contractId: 'CXXX...',
  network: 'mainnet',
  contractName: 'Token',
});
```

#### Programmatic SDK generation

```typescript
import { SDKGenerator } from '@sorodoc/sdk';

const generator = new SDKGenerator({ language: 'typescript' });

const sdk = await generator.generate({
  abi: contractAbi,          // parsed ABI object
  packageName: '@myorg/token-sdk',
  version: '1.0.0',
  network: 'mainnet',
  contractId: 'CXXX...',
});

console.log(sdk.files);       // Map<filename, content>
console.log(sdk.packageJson); // Generated package.json
```

### Web Studio

Start the interactive studio:

```bash
sorodoc studio
# Opens at http://localhost:3141
```

Or access the hosted version at `https://studio.sorodoc.io`.

Studio features:
- **Drag-and-drop WASM upload** — paste a contract ID or upload a `.wasm` file
- **Live AI generation** — watch docs and SDK generate in real time
- **Preview pane** — side-by-side source and rendered output
- **SDK playground** — run generated SDK code against testnet in-browser
- **Export panel** — download docs as ZIP, push to GitHub, or publish to portal
- **Team workspace** — share and collaborate on doc projects

---

## 📦 Output Formats

### Markdown

Clean, portable markdown with frontmatter — compatible with any static site generator.

```
./docs/markdown/
├── README.md                  # Overview and quick start
├── functions/
│   ├── transfer.md
│   ├── mint.md
│   ├── burn.md
│   └── ...
├── events/
│   ├── Transfer.md
│   └── Approval.md
├── errors/
│   └── error-reference.md
└── sdk/
    └── quickstart.md
```

### Docusaurus Site

A fully configured [Docusaurus 3](https://docusaurus.io) project, ready to deploy to GitHub Pages, Vercel, or Netlify.

```bash
cd ./docs/docusaurus
npm install
npm run start    # local preview
npm run build    # production build
```

### OpenAPI / Swagger

An OpenAPI 3.1 spec that maps Soroban functions to REST-style paths for tooling compatibility:

```yaml
# openapi.yaml (excerpt)
paths:
  /invoke/transfer:
    post:
      summary: Transfer tokens between accounts
      description: |
        Transfers `amount` tokens from the `from` account to the `to` account.
        Requires authorization from the `from` account. Emits a `Transfer` event
        on success.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                from:
                  type: string
                  description: Stellar account address of the sender
                  example: "GABC..."
                to:
                  type: string
                  description: Stellar account address of the recipient
                  example: "GXYZ..."
                amount:
                  type: integer
                  format: int128
                  description: Amount to transfer in stroops
                  example: 1000000
```

### TypeScript SDK (Generated)

```typescript
// Generated: @myprotocol/token-sdk/index.ts

import { Contract, Networks, rpc } from '@stellar/stellar-sdk';

export interface TransferParams {
  /** Stellar account address of the sender */
  from: string;
  /** Stellar account address of the recipient */
  to: string;
  /** Amount to transfer (in stroops, 1 XLM = 10,000,000 stroops) */
  amount: bigint;
}

export interface MintParams {
  /** Address to mint tokens to */
  to: string;
  /** Amount of tokens to mint */
  amount: bigint;
}

export type ContractError =
  | { code: 1; message: 'InsufficientBalance' }
  | { code: 2; message: 'Unauthorized' }
  | { code: 3; message: 'AmountMustBePositive' };

export class TokenContract {
  private contract: Contract;
  private server: rpc.Server;

  constructor(contractId: string, networkPassphrase: string, rpcUrl: string) {
    this.contract = new Contract(contractId);
    this.server = new rpc.Server(rpcUrl);
  }

  /**
   * Transfer tokens between accounts.
   *
   * Requires authorization from the `from` account.
   * Emits a `Transfer` event on success.
   *
   * @param params - Transfer parameters
   * @throws {ContractError} code 1 if sender has insufficient balance
   * @throws {ContractError} code 2 if caller is not authorized
   *
   * @example
   * const sdk = new TokenContract('CXXX...', Networks.TESTNET, RPC_URL);
   * await sdk.transfer({
   *   from: 'GABC...',
   *   to: 'GXYZ...',
   *   amount: BigInt(1_000_000),
   * });
   */
  async transfer(params: TransferParams): Promise<void> {
    // ... generated implementation
  }

  /**
   * Mint new tokens to an account.
   * Only callable by the contract admin.
   */
  async mint(params: MintParams): Promise<void> {
    // ... generated implementation
  }

  /**
   * Returns the token balance of an account.
   *
   * @param account - The account address to query
   * @returns Token balance in stroops
   */
  async balance(account: string): Promise<bigint> {
    // ... generated implementation
  }
}
```

### Python SDK (Generated)

```python
# Generated: myprotocol-token-sdk/token_contract.py

from dataclasses import dataclass
from typing import Optional
from stellar_sdk import Keypair, Network
from stellar_sdk.soroban_server import SorobanServer

@dataclass
class TransferParams:
    """Parameters for the transfer function."""
    from_address: str
    """Stellar account address of the sender."""
    to_address: str
    """Stellar account address of the recipient."""
    amount: int
    """Amount to transfer in stroops (1 XLM = 10,000,000 stroops)."""

class TokenContract:
    """
    Client for the Token Soroban smart contract.

    Auto-generated by SoroDoc from contract ABI.
    Contract ID: CXXX...
    Network: Mainnet
    """

    def __init__(
        self,
        contract_id: str,
        rpc_url: str,
        network_passphrase: str,
    ):
        self.contract_id = contract_id
        self.server = SorobanServer(rpc_url)
        self.network_passphrase = network_passphrase

    def transfer(self, params: TransferParams, source_keypair: Keypair) -> None:
        """
        Transfer tokens between accounts.

        Requires authorization from the sender account.
        Emits a Transfer event on success.

        Args:
            params: Transfer parameters including from, to, and amount.
            source_keypair: Keypair of the transaction source account.

        Raises:
            ContractError: code=1 if sender has insufficient balance.
            ContractError: code=2 if caller is not authorized.

        Example:
            contract = TokenContract("CXXX...", RPC_URL, Network.PUBLIC_NETWORK_PASSPHRASE)
            contract.transfer(
                TransferParams(
                    from_address="GABC...",
                    to_address="GXYZ...",
                    amount=1_000_000,
                ),
                source_keypair=keypair,
            )
        """
        # ... generated implementation
```

---

## 🤖 AI Documentation Engine

SoroDoc's AI layer uses **Anthropic Claude** to produce documentation that reads like it was written by a senior developer — not a machine.

### How it works

**Step 1 — ABI Extraction**
SoroDoc parses the contract WASM using `soroban-spec` to extract the full contract specification: function signatures, argument types, return types, custom types, error enums, and events.

**Step 2 — Source Enrichment (optional)**
If Rust source is provided, SoroDoc extracts doc comments (`///`), inline comments, and structural context to give Claude a richer understanding of intent.

**Step 3 — AI Documentation Pass**
Claude receives the structured ABI + source context and generates:
- A plain-English overview of each function
- Parameter documentation with type constraints and business-logic context
- Return value explanations
- Error code descriptions with common causes and remediation steps
- Event payload documentation
- Realistic usage examples in each requested language

**Step 4 — Validation & Consistency Pass**
A second AI pass checks all generated docs for:
- Consistency between functions that share types
- Accuracy of type information against the ABI
- Example code correctness (syntactically and semantically)
- Completeness — no undocumented parameters

### AI Tone Modes

Configure the tone in `sorodoc.config.json`:

| Mode | Best For | Style |
|---|---|---|
| `technical` | Dev tools, infrastructure | Precise, terse, no hand-holding |
| `friendly` | Consumer dApps, SDKs | Approachable, explains concepts |
| `enterprise` | B2B protocols, compliance | Formal, thorough, structured |
| `educational` | Open-source, learning | Tutorial-style with deep explanations |

### Custom AI Instructions

Add project-specific instructions to guide the AI:

```json
{
  "ai": {
    "customInstructions": "This is a DeFi protocol. Assume readers are familiar with AMMs and liquidity pools. Always mention slippage tolerance when documenting swap functions. Never suggest using secret keys in example code.",
    "glossary": {
      "lp_shares": "Liquidity provider shares representing proportional ownership of a pool",
      "basis_points": "One hundredth of a percent (0.01%). 100 basis points = 1%."
    }
  }
}
```

---

## 🏢 Enterprise Features

### Multi-Contract Protocol Portals

Document an entire protocol suite — token, governance, staking, oracle — in a single unified portal with cross-linking between contracts.

```bash
sorodoc generate --config ./sorodoc.config.json
# Generates unified portal for all contracts defined in config
```

### Versioned Documentation

```bash
# Tag a doc version when you deploy a new contract version
sorodoc version tag --name "v2.0.0" --contract-id CXXX...

# List versions
sorodoc version list

# Generate diff between versions
sorodoc version diff v1.0.0 v2.0.0
```

Version diff output:

```
📋 API Changes: v1.0.0 → v2.0.0

  ✅ Added:    swap_exact_out(pool, token_in, amount_out, max_in) → i128
  ✅ Added:    get_reserves(pool) → (i128, i128)
  ⚠️  Changed:  swap() — parameter `slippage` renamed to `slippage_bps`
  ❌ Removed:  swap_legacy() — deprecated in v1.5, now removed

  ⚠️  Breaking changes detected. Consider a migration guide.
```

### Private / Internal Docs

```json
{
  "contracts": [
    {
      "name": "AdminControls",
      "source": "./contracts/admin/src/lib.rs",
      "visibility": "internal",
      "allowedRoles": ["admin", "senior-engineer"]
    }
  ]
}
```

### Hosted Portal with Custom Domain

```bash
# Deploy to SoroDoc hosted infrastructure
sorodoc portal deploy \
  --workspace acme-defi \
  --domain docs.acmedefi.io \
  --dir ./docs/docusaurus

# Configure custom domain DNS
# CNAME docs.acmedefi.io → portal.sorodoc.io
```

### Doc Analytics Dashboard

Track developer engagement with your documentation:
- Most-viewed functions
- Time spent per page
- Copy-to-clipboard events (signals active usage)
- Search queries with no results (gaps in docs)
- SDK installation counts (npm download tracking)

---

## 🔗 Soroban Contract Integration

### Doc Comment Conventions

SoroDoc reads standard Rust doc comments and extends them with optional `@sorodoc` tags for richer output:

```rust
/// Transfers `amount` tokens from `from` to `to`.
///
/// # Arguments
/// * `from` - The sender's address. Must authorize this call.
/// * `to` - The recipient's address.
/// * `amount` - Token amount in stroops. Must be > 0.
///
/// # Errors
/// * `ContractError::InsufficientBalance` - Sender balance < amount
/// * `ContractError::Unauthorized` - Caller ≠ from
///
/// @sorodoc:category Transfers
/// @sorodoc:example-highlight This is the most commonly used function.
/// @sorodoc:since v1.0.0
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), ContractError> {
    from.require_auth();
    // ...
}
```

### Contract Events

SoroDoc auto-documents events published via `env.events().publish()`:

```rust
/// @sorodoc:event Transfer
/// @sorodoc:event-description Emitted when tokens are transferred between accounts.
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    // ...
    env.events().publish(
        (symbol_short!("transfer"), from.clone()),
        (to.clone(), amount),
    );
}
```

Generated event doc:

```markdown
## Event: Transfer

Emitted when tokens are successfully transferred between accounts.

**Topics:**
| Index | Name | Type | Description |
|---|---|---|---|
| 0 | `name` | `Symbol` | Always `"transfer"` |
| 1 | `from` | `Address` | The sender account |

**Data:**
| Field | Type | Description |
|---|---|---|
| `to` | `Address` | The recipient account |
| `amount` | `i128` | The transferred amount in stroops |

**Listening Example (TypeScript):**
```typescript
server.getEvents({
  filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }]
});
```
```

---

## ⚙️ CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/sorodoc.yml
name: Generate & Deploy Docs

on:
  push:
    branches: [main]
    paths:
      - 'contracts/**'
      - 'sorodoc.config.json'

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build contracts
        run: cargo build --target wasm32-unknown-unknown --release

      - name: Generate documentation
        uses: sorodoc/github-action@v1
        with:
          config: ./sorodoc.config.json
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          output-dir: ./docs-generated

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs-generated/docusaurus/build

      - name: Publish TypeScript SDK
        run: |
          cd docs-generated/sdk/typescript
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitLab CI

```yaml
generate-docs:
  image: node:18
  stage: docs
  script:
    - cargo build --target wasm32-unknown-unknown --release
    - npm install -g @sorodoc/cli
    - sorodoc generate --config ./sorodoc.config.json --out ./docs-generated
  artifacts:
    paths:
      - docs-generated/
  only:
    changes:
      - contracts/**/*
      - sorodoc.config.json
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

### PR Documentation Diff

SoroDoc can post a documentation diff as a PR comment whenever contracts change:

```yaml
- name: Post doc diff to PR
  uses: sorodoc/pr-diff-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    base-ref: ${{ github.base_ref }}
    head-ref: ${{ github.head_ref }}
```

PR comment example:

```
📚 SoroDoc — API Changes Detected

  ✅ transfer() — docs updated (parameter description improved)
  ✅ swap()     — new function, docs generated
  ⚠️  burn()    — return type changed from void to i128. Docs updated.
                   ⚡ Breaking change — SDK re-generated automatically.

  View full diff → https://sorodoc.io/diff/pr-142
```

---

## 🔒 Security Model

- **No contract source leaves your environment without consent.** Source enrichment is strictly opt-in; WASM-only mode sends only ABI metadata to the AI engine.
- **Generated SDKs never embed secret keys** — all examples use placeholder variables with explicit warnings.
- **Private doc portals** are access-controlled and never indexed by search engines.
- **WASM binaries are not stored** — they are processed in memory and discarded after ABI extraction.

### Data sent to Anthropic API

| Data | Sent? | Notes |
|---|---|---|
| Contract ABI (decoded) | ✅ Yes | Always (core functionality) |
| Rust source / doc comments | ✅ Opt-in | Only with `--source` flag |
| Contract WASM binary | ❌ Never | Parsed locally, ABI extracted |
| Account keys | ❌ Never | |
| Ledger / on-chain state | ❌ Never | |

---

## 🗂 Project Structure

```
sorodoc/
│
├── packages/
│   ├── cli/                              # @sorodoc/cli — global CLI tool
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── generate.ts           # `sorodoc generate` command
│   │   │   │   ├── sdk.ts                # `sorodoc sdk` command
│   │   │   │   ├── serve.ts              # `sorodoc serve` command
│   │   │   │   ├── studio.ts             # `sorodoc studio` command
│   │   │   │   ├── version.ts            # `sorodoc version` commands
│   │   │   │   └── portal.ts             # `sorodoc portal deploy` command
│   │   │   └── index.ts                  # CLI entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk/                              # @sorodoc/sdk — programmatic API
│   │   ├── src/
│   │   │   ├── SoroDoc.ts                # Main SDK class
│   │   │   ├── SDKGenerator.ts           # SDK generation API
│   │   │   ├── types.ts                  # Shared TypeScript types
│   │   │   └── index.ts                  # Public exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core/                             # @sorodoc/core — shared engine
│   │   ├── src/
│   │   │   ├── parser/
│   │   │   │   ├── ABIParser.ts          # Soroban WASM ABI extraction
│   │   │   │   ├── SourceParser.ts       # Rust doc comment extractor
│   │   │   │   ├── EventParser.ts        # Contract event schema parser
│   │   │   │   └── ErrorParser.ts        # Error enum extractor
│   │   │   ├── ai/
│   │   │   │   ├── DocEngine.ts          # Claude doc generation orchestrator
│   │   │   │   ├── FunctionDocWriter.ts  # Per-function AI doc pass
│   │   │   │   ├── ExampleGenerator.ts   # AI code example generation
│   │   │   │   ├── ErrorDocWriter.ts     # AI error catalogue writer
│   │   │   │   └── ValidationPass.ts     # AI consistency & accuracy check
│   │   │   ├── codegen/
│   │   │   │   ├── TypeScriptSDK.ts      # TypeScript/JS SDK generator
│   │   │   │   ├── PythonSDK.ts          # Python SDK generator
│   │   │   │   ├── RustClient.ts         # Rust async client generator
│   │   │   │   └── ReactHooks.ts         # React hooks library generator
│   │   │   ├── renderers/
│   │   │   │   ├── MarkdownRenderer.ts   # Markdown output
│   │   │   │   ├── DocusaurusRenderer.ts # Docusaurus site scaffolder
│   │   │   │   └── OpenAPIRenderer.ts    # OpenAPI 3.1 spec generator
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/                              # REST API server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── generate.ts           # POST /generate
│   │   │   │   ├── sdk.ts                # POST /sdk
│   │   │   │   ├── portal.ts             # CRUD /portal
│   │   │   │   └── workspace.ts          # CRUD /workspace
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts               # JWT / SAML middleware
│   │   │   │   └── rbac.ts               # Role-based access control
│   │   │   ├── db/
│   │   │   │   ├── schema.sql            # PostgreSQL schema
│   │   │   │   └── migrations/           # Database migrations
│   │   │   └── server.ts                 # Fastify entry point
│   │   └── package.json
│   │
│   └── studio/                           # Web Studio (React)
│       ├── src/
│       │   ├── components/
│       │   │   ├── UploadPanel/          # WASM / contract ID input
│       │   │   ├── GenerationStream/     # Live AI generation preview
│       │   │   ├── PreviewPane/          # Rendered docs preview
│       │   │   ├── SDKPlayground/        # In-browser SDK test runner
│       │   │   └── ExportPanel/          # Download / publish output
│       │   ├── pages/
│       │   │   ├── Studio.tsx
│       │   │   ├── Workspace.tsx
│       │   │   └── Portal.tsx
│       │   └── main.tsx
│       └── package.json
│
├── templates/                            # Output templates
│   ├── docusaurus/                       # Base Docusaurus config
│   │   ├── docusaurus.config.js
│   │   ├── sidebars.js
│   │   └── src/css/custom.css
│   ├── sdk/
│   │   ├── typescript/                   # TS SDK scaffolding templates
│   │   └── python/                       # Python SDK scaffolding templates
│   └── openapi/
│       └── base.yaml                     # OpenAPI spec base template
│
├── examples/                             # Example contracts & generated output
│   ├── token-contract/
│   │   ├── src/lib.rs                    # Sample Soroban token contract
│   │   └── generated/                    # Pre-generated docs & SDK output
│   └── defi-protocol/
│       ├── contracts/
│       └── generated/
│
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── docker-compose.yml
│
├── helm/                                 # Kubernetes Helm chart
│   └── sorodoc/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Test & lint on PR
│       ├── release.yml                   # Publish packages on tag
│       └── sorodoc.yml                   # Example consumer workflow
│
├── sorodoc.config.json                   # Example project config
├── .env.example                          # Environment variable template
├── package.json                          # Monorepo root (npm workspaces)
├── turbo.json                            # Turborepo build pipeline
└── README.md
```

---

## 🤝 Contributing

```bash
git clone https://github.com/your-org/sorodoc.git
cd sorodoc
npm install
npm run dev
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. We especially welcome:
- New SDK language targets (Go, Java, Swift)
- Docusaurus theme contributions
- ABI parser improvements for edge-case contract patterns
- Translations of the doc UI

---



---

## 📄 License

SoroDoc is released under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org) for Soroban, `soroban-spec`, and `stellar-contract-bindings`
- [Anthropic](https://anthropic.com) for the Claude API
- [Docusaurus](https://docusaurus.io) for the documentation framework
- The Stellar developer community for feedback and early testing

---

<p align="center">
  Built with ❤️ for the Stellar ecosystem<br/>
  <a href="https://soroban.stellar.org">Soroban Docs</a> ·
  <a href="https://discord.gg/stellar">Stellar Discord</a> ·
  <a href="https://github.com/your-org/sorodoc/issues">Report an Issue</a> ·
  <a href="https://studio.sorodoc.io">Try the Studio</a>
</p>

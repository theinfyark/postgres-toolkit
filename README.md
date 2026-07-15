# postgres-toolkit

Practical **PostgreSQL helper** for Node.js — pool, retry, transactions, health checks, query logging, and connection stats.

```bash
npm install postgres-toolkit
```

## Quick start

```js
import { Postgres } from "postgres-toolkit";

const db = new Postgres({
  connectionString: process.env.DATABASE_URL,
  queryLogging: true,
});

const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [1]);
```

## Features

| Feature | Method / option |
|---------|-----------------|
| Connection pool | built on `pg.Pool` |
| Retry | automatic on transient errors |
| Transactions | `db.transaction(async tx => …)` |
| Health check | `db.healthCheck()` |
| Query logging | `queryLogging: true` |
| Active connections | `db.activeConnections()` |
| Ideal pool size | `Postgres.idealPoolSize()` |
| Helpers | `queryOne`, `queryMany` |

## Connection pool

```js
const db = new Postgres({
  connectionString: process.env.DATABASE_URL,
  pool: {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
});
```

### Ideal pool sizing

```js
const ideal = Postgres.idealPoolSize({
  cpuCores: 4,
  maxConnectionsOnServer: 100,
  appInstances: 2,
});

console.log(ideal);
// { min, max, idleTimeoutMillis, connectionTimeoutMillis, recommendation }
```

## Retry

Transient network / Postgres codes are retried automatically (`ECONNREFUSED`, deadlocks, too many connections, etc.).

```js
const db = new Postgres({
  connectionString: process.env.DATABASE_URL,
  retry: true,
  retries: 3,
});
```

## Transactions

```js
await db.transaction(async (tx) => {
  await tx.query("UPDATE accounts SET balance = balance - 10 WHERE id = $1", [1]);
  await tx.query("UPDATE accounts SET balance = balance + 10 WHERE id = $1", [2]);
});
```

On error → `ROLLBACK`. On success → `COMMIT`.

## Health check

```js
const health = await db.healthCheck();
// { ok: true, ms: 4 }
```

## Query logging

```js
const db = new Postgres({
  connectionString: process.env.DATABASE_URL,
  queryLogging: true,
  logger: (entry) => console.log(entry),
});
```

Or set `PG_QUERY_LOG=1`.

## Active connections

```js
db.activeConnections();
// { total, idle, waiting, active }
```

## Helpers

```js
const user = await db.queryOne("SELECT * FROM users WHERE id = $1", [1]);
const users = await db.queryMany("SELECT * FROM users LIMIT 10");
```

## Shutdown

```js
await db.end();
```

## Requirements

- Node.js 18+
- PostgreSQL server
- Uses the official [`pg`](https://www.npmjs.com/package/pg) driver

## License

MIT

## Introduction

**postgres-toolkit** helps you ship reliable Node.js / TypeScript applications with a small, focused API.

## Why this package exists

Popular stacks need small, trustworthy utilities with excellent DX. **postgres-toolkit** exists to solve one problem well: clear APIs, strong typing, minimal dependencies, and production-ready defaults — without the overhead of larger frameworks.

## Installation

```bash
npm install postgres-toolkit
# or
pnpm add postgres-toolkit
yarn add postgres-toolkit
```

Requires Node.js 18+.

## API Reference

See the exports from `postgres-toolkit` and the inline TypeScript types for the full surface area. Primary entry points are documented in **Quick Start** and **Examples** above.

## Examples

Minimal usage is shown in **Quick Start**. Prefer copying those snippets first, then expand into your app’s error handling and configuration patterns.

## Advanced Examples

- Combine with environment validation, logging, and health checks in production services
- Prefer dependency injection / custom `fetch` / client injection in tests
- Keep configuration explicit; avoid hidden global state

## Framework Integration

Works with Express, Fastify, Hono, NestJS, and plain Node HTTP servers. Import ESM (or CJS where published) and call the documented APIs from route handlers, middleware, or background jobs.

## TypeScript Usage

```ts
import { /* symbols */ } from "postgres-toolkit";
```

Types ship with the package (`types` / `exports.types`). Enable `strict` in your `tsconfig` for the best DX.

## Error Handling

- Fail fast with typed / named errors where provided
- Never swallow errors silently in production paths
- Prefer returning structured error payloads in HTTP layers
- Surface actionable messages (what failed + how to fix)

## Performance

- Minimal runtime work on the hot path
- Avoid unnecessary allocations and dependencies
- Tree-shakeable ESM entry points
- Prefer streaming / lazy work when dealing with large payloads

## Best Practices

- Pin major versions with SemVer ranges you trust
- Validate configuration at process startup
- Add health checks and observability around I/O
- Write tests for failure modes (timeouts, bad input, missing credentials)

## FAQ

**Does it work with ESM and CommonJS?**  
Yes where the package publishes dual exports. Prefer ESM for new projects.

**Is it production-ready?**  
Yes — tests, types, and SemVer releases are part of the maintenance model.

**How do I report a bug?**  
Open a GitHub issue using the bug template.

## Migration Guide

### From 0.x / early drafts
This package follows SemVer. Breaking changes land in major releases and are called out in `CHANGELOG.md`.

### Upgrading patch/minor
Patch and minor releases are backward compatible. Run your test suite after upgrading.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `ERR_MODULE_NOT_FOUND` | Wrong Node version / bad import path | Use Node 18+ and package `exports` |
| Types not resolving | Old moduleResolution | Use `bundler` or `node16`+ |
| Auth / network failures | Missing env or blocked egress | Check credentials and firewall |
| Unexpected runtime errors | Invalid input | Validate options; read error message |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs with tests and docs are welcome.


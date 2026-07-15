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

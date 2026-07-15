import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Postgres, withRetry } from "../src/index.js";

function mockPool({
  queryImpl,
  totalCount = 3,
  idleCount = 1,
  waitingCount = 0,
} = {}) {
  let inTransaction = false;
  const clients = {
    async query(text) {
      if (text === "BEGIN") {
        inTransaction = true;
        return { rows: [] };
      }
      if (text === "COMMIT") {
        inTransaction = false;
        return { rows: [] };
      }
      if (text === "ROLLBACK") {
        inTransaction = false;
        return { rows: [] };
      }
      return queryImpl ? queryImpl(text) : { rows: [], rowCount: 0 };
    },
    release() {},
  };

  return {
    totalCount,
    idleCount,
    waitingCount,
    async query(text, params) {
      if (queryImpl) return queryImpl(text, params, { inTransaction });
      return { rows: [{ ok: 1 }], rowCount: 1 };
    },
    async connect() {
      return clients;
    },
    async end() {},
  };
}

describe("postgres-toolkit", () => {
  it("queries through the pool with logging", async () => {
    /** @type {object[]} */
    const logs = [];
    const db = new Postgres({
      clientPool: mockPool({
        queryImpl: async () => ({ rows: [{ id: 1 }], rowCount: 1 }),
      }),
      queryLogging: true,
      logger: (e) => logs.push(e),
      retry: false,
    });

    const result = await db.query("select 1");
    assert.equal(result.rows[0].id, 1);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].ok, true);
    assert.equal(db.stats.ok, 1);
  });

  it("queryOne and queryMany helpers", async () => {
    const db = new Postgres({
      clientPool: mockPool({
        queryImpl: async () => ({
          rows: [{ a: 1 }, { a: 2 }],
          rowCount: 2,
        }),
      }),
      retry: false,
    });

    assert.deepEqual(await db.queryOne("x"), { a: 1 });
    assert.equal((await db.queryMany("x")).length, 2);
  });

  it("runs transactions with commit", async () => {
    /** @type {string[]} */
    const steps = [];
    const db = new Postgres({
      clientPool: mockPool({
        queryImpl: async (text) => {
          steps.push(text);
          return { rows: [], rowCount: 0 };
        },
      }),
      retry: false,
    });

    // Override connect path with tracking
    const pool = db.pool;
    pool.connect = async () => ({
      async query(text) {
        steps.push(text);
        return { rows: [{ n: 1 }], rowCount: 1 };
      },
      release() {
        steps.push("RELEASE");
      },
    });

    const value = await db.transaction(async (tx) => {
      const r = await tx.query("INSERT INTO t VALUES (1)");
      return r.rows[0].n;
    });

    assert.equal(value, 1);
    assert.deepEqual(steps, ["BEGIN", "INSERT INTO t VALUES (1)", "COMMIT", "RELEASE"]);
  });

  it("rolls back transactions on error", async () => {
    /** @type {string[]} */
    const steps = [];
    const db = new Postgres({
      clientPool: mockPool(),
      retry: false,
    });

    db.pool.connect = async () => ({
      async query(text) {
        steps.push(text);
        return { rows: [] };
      },
      release() {
        steps.push("RELEASE");
      },
    });

    await assert.rejects(() =>
      db.transaction(async () => {
        throw new Error("boom");
      }),
    );

    assert.ok(steps.includes("BEGIN"));
    assert.ok(steps.includes("ROLLBACK"));
    assert.ok(steps.includes("RELEASE"));
  });

  it("healthCheck returns ok", async () => {
    const db = new Postgres({
      clientPool: mockPool({
        queryImpl: async () => ({ rows: [{ ok: 1 }], rowCount: 1 }),
      }),
      retry: false,
    });
    const health = await db.healthCheck();
    assert.equal(health.ok, true);
    assert.ok(typeof health.ms === "number");
  });

  it("activeConnections reports pool stats", () => {
    const db = new Postgres({
      clientPool: mockPool({ totalCount: 5, idleCount: 2, waitingCount: 1 }),
      retry: false,
    });
    assert.deepEqual(db.activeConnections(), {
      total: 5,
      idle: 2,
      waiting: 1,
      active: 3,
    });
  });

  it("idealPoolSize returns reasonable defaults", () => {
    const ideal = Postgres.idealPoolSize({
      cpuCores: 4,
      maxConnectionsOnServer: 100,
      appInstances: 2,
    });
    assert.ok(ideal.max >= ideal.min);
    assert.ok(ideal.max <= 50);
  });

  it("withRetry retries transient failures", async () => {
    let n = 0;
    const value = await withRetry(
      async () => {
        n += 1;
        if (n < 3) {
          const err = new Error("refused");
          err.code = "ECONNREFUSED";
          throw err;
        }
        return "ok";
      },
      { retries: 5, minDelayMs: 1, maxDelayMs: 5 },
    );
    assert.equal(value, "ok");
    assert.equal(n, 3);
  });
});

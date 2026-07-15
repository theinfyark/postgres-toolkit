import { Pool } from "pg";
import { withRetry } from "./retry.js";

/**
 * @typedef {object} PostgresToolkitOptions
 * @property {string} [connectionString]
 * @property {import('pg').PoolConfig} [pool]
 * @property {boolean} [queryLogging]
 * @property {(entry: object) => void} [logger]
 * @property {number} [retries]
 * @property {boolean} [retry]
 * @property {import('pg').Pool} [clientPool] Inject a pool (tests)
 */

/**
 * PostgreSQL helper with pool, retry, transactions, health, and logging.
 *
 * @example
 * ```js
 * import { Postgres } from "postgres-toolkit";
 *
 * const db = new Postgres({ connectionString: process.env.DATABASE_URL });
 * const { rows } = await db.query("select now()");
 * ```
 */
export class Postgres {
  /**
   * @param {PostgresToolkitOptions} [options]
   */
  constructor(options = {}) {
    this.queryLogging = options.queryLogging ?? process.env.PG_QUERY_LOG === "1";
    this.logger = options.logger ?? ((entry) => console.log("[postgres]", entry));
    this.retryEnabled = options.retry !== false;
    this.retries = options.retries ?? 3;

    /** @type {{ total: number, ok: number, failed: number, lastMs: number | null }} */
    this.stats = {
      total: 0,
      ok: 0,
      failed: 0,
      lastMs: null,
    };

    if (options.clientPool) {
      this.pool = options.clientPool;
    } else {
      /** @type {import('pg').PoolConfig} */
      const config = {
        ...(options.pool || {}),
      };
      if (options.connectionString) {
        config.connectionString = options.connectionString;
      } else if (process.env.DATABASE_URL) {
        config.connectionString = process.env.DATABASE_URL;
      }
      this.pool = new Pool(config);
    }
  }

  /**
   * Run a SQL query (with optional retry + logging).
   *
   * @param {string} text
   * @param {unknown[]} [params]
   * @param {{ retry?: boolean }} [opts]
   */
  async query(text, params = [], opts = {}) {
    const run = async () => {
      const started = Date.now();
      this.stats.total += 1;
      try {
        const result = await this.pool.query(text, params);
        const ms = Date.now() - started;
        this.stats.ok += 1;
        this.stats.lastMs = ms;
        if (this.queryLogging) {
          this.logger({
            sql: text,
            params,
            rowCount: result.rowCount,
            ms,
            ok: true,
          });
        }
        return result;
      } catch (err) {
        const ms = Date.now() - started;
        this.stats.failed += 1;
        this.stats.lastMs = ms;
        if (this.queryLogging) {
          this.logger({
            sql: text,
            params,
            ms,
            ok: false,
            error: /** @type {Error} */ (err)?.message,
          });
        }
        throw err;
      }
    };

    const useRetry = opts.retry ?? this.retryEnabled;
    return useRetry ? withRetry(run, { retries: this.retries }) : run();
  }

  /**
   * Return the first row or `null`.
   * @param {string} text
   * @param {unknown[]} [params]
   */
  async queryOne(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows[0] ?? null;
  }

  /**
   * Return all rows.
   * @param {string} text
   * @param {unknown[]} [params]
   */
  async queryMany(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows;
  }

  /**
   * Run work inside a transaction (BEGIN / COMMIT / ROLLBACK).
   *
   * @template T
   * @param {(client: { query: Function }) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx = {
        /**
         * @param {string} text
         * @param {unknown[]} [params]
         */
        query: (text, params = []) => client.query(text, params),
      };
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Health check — runs `SELECT 1`.
   * @returns {Promise<{ ok: boolean, ms: number, error?: string }>}
   */
  async healthCheck() {
    const started = Date.now();
    try {
      await this.query("SELECT 1 AS ok", [], { retry: false });
      return { ok: true, ms: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        ms: Date.now() - started,
        error: /** @type {Error} */ (err)?.message || String(err),
      };
    }
  }

  /**
   * Active / idle / waiting connection counts from the pool.
   */
  activeConnections() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      active: Math.max(this.pool.totalCount - this.pool.idleCount, 0),
    };
  }

  /**
   * Ideal pool settings helper based on workload hints.
   *
   * @param {{
   *   cpuCores?: number,
   *   maxConnectionsOnServer?: number,
   *   appInstances?: number
   * }} [hints]
   */
  static idealPoolSize(hints = {}) {
    const cores = hints.cpuCores ?? 2;
    const serverMax = hints.maxConnectionsOnServer ?? 100;
    const instances = Math.max(hints.appInstances ?? 1, 1);

    // Common rule of thumb: (cores * 2) + 1, capped by fair share of server max
    const ruleOfThumb = cores * 2 + 1;
    const fairShare = Math.max(Math.floor(serverMax / instances) - 2, 1);
    const max = Math.min(ruleOfThumb, fairShare, 50);
    const min = Math.min(2, max);

    return {
      min,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      recommendation: `Use max=${max} for ~${instances} instance(s) against server max=${serverMax}`,
    };
  }

  /** End the pool. */
  async end() {
    await this.pool.end();
  }
}

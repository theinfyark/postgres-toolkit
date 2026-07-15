import type { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

export function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T>;

export interface QueryLogEntry {
  sql: string;
  params: unknown[];
  rowCount?: number | null;
  ms: number;
  ok: boolean;
  error?: string;
}

export interface PostgresToolkitOptions {
  connectionString?: string;
  pool?: PoolConfig;
  queryLogging?: boolean;
  logger?: (entry: QueryLogEntry) => void;
  retries?: number;
  retry?: boolean;
  /** Inject a pool (tests) */
  clientPool?: Pool;
}

export interface QueryOptions {
  retry?: boolean;
}

export interface TransactionClient {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
}

export interface HealthCheckResult {
  ok: boolean;
  ms: number;
  error?: string;
}

export interface ConnectionStats {
  total: number;
  idle: number;
  waiting: number;
  active: number;
}

export interface IdealPoolSizeHints {
  cpuCores?: number;
  maxConnectionsOnServer?: number;
  appInstances?: number;
}

export interface IdealPoolSize {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  recommendation: string;
}

export declare class Postgres {
  queryLogging: boolean;
  logger: (entry: QueryLogEntry) => void;
  retryEnabled: boolean;
  retries: number;
  stats: {
    total: number;
    ok: number;
    failed: number;
    lastMs: number | null;
  };
  pool: Pool;

  constructor(options?: PostgresToolkitOptions);

  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
    opts?: QueryOptions,
  ): Promise<QueryResult<R>>;

  queryOne<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<R | null>;

  queryMany<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<R[]>;

  transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T>;

  healthCheck(): Promise<HealthCheckResult>;

  activeConnections(): ConnectionStats;

  static idealPoolSize(hints?: IdealPoolSizeHints): IdealPoolSize;

  end(): Promise<void>;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type TransportMode = 'stdio' | 'http';

export interface RuntimeConfig {
  apiBaseUrl: string;
  apiToken: string;       // LBM_API_KEY (stdio) or empty (http, JWT per-request)
  transportMode: TransportMode;
  logLevel: LogLevel;
  http: HttpConfig | null;
}

export interface HttpConfig {
  port: number;
  serverBaseUrl: string;
  oryApiUrl: string;
  testMode: boolean;
  maxSessions: number;
}

/** Validate that a required string arg is present and non-empty. Throws a user-facing error string on failure. */
export function requireString(args: Record<string, unknown>, field: string): string {
  const val = args[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`Missing required parameter: "${field}"`);
  }
  return val;
}

// API error codes returned by LBM REST API
export type LbmErrorCode =
  | 'INSUFFICIENT_CREDITS'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export interface LbmApiError {
  code: LbmErrorCode;
  message: string;
  hint?: string;
}

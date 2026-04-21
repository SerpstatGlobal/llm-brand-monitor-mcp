import axios, {AxiosError, AxiosInstance} from 'axios';
import {Logger} from './logger.js';
import {LbmApiError, LbmErrorCode} from './types.js';

const ERROR_HINTS: Record<LbmErrorCode, string> = {
  INSUFFICIENT_CREDITS: 'Not enough credits. Call lbm_get_usage to check balance. User needs to top up at llmbrandmonitor.com/pricing.',
  RATE_LIMITED: 'Rate limit exceeded. Wait a few seconds and retry.',
  NOT_FOUND: 'Resource not found. Call lbm_list_projects to verify the project ID exists.',
  UNAUTHORIZED: 'Token is invalid or expired. The user needs to reconnect the integration.',
  VALIDATION_ERROR: 'Invalid parameters. Check the required fields and try again.',
  UNKNOWN: 'Unexpected error from LBM API.',
};

export class LbmApiClient {
  private http: AxiosInstance;
  private logger: Logger;

  constructor(baseUrl: string, token: string, logger: Logger) {
    this.logger = logger;
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  /** Create a new client instance with a different token (HTTP mode: per-request JWT) */
  withToken(token: string): LbmApiClient {
    const client = new LbmApiClient('', '', this.logger);
    client.http = axios.create({
      baseURL: this.http.defaults.baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
    return client;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    this.logger.debug(`GET ${path}`, params);
    return await this.request<T>(() => this.http.get(path, {params}));
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.logger.debug(`POST ${path}`);
    return this.request<T>(() => this.http.post(path, body));
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    this.logger.debug(`PATCH ${path}`);
    return this.request<T>(() => this.http.patch(path, body));
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    this.logger.debug(`DELETE ${path}`, params);
    return this.request<T>(() => this.http.delete(path, { params }));
  }

  private async request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await fn();
      return response.data;
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  private normalizeError(err: unknown): LbmApiError {
    if (axios.isAxiosError(err)) {
      return this.fromAxiosError(err);
    }
    const message = err instanceof Error ? err.message : String(err);
    return { code: 'UNKNOWN', message, hint: ERROR_HINTS.UNKNOWN };
  }

  private fromAxiosError(err: AxiosError): LbmApiError {
    const status = err.response?.status;
    const data = err.response?.data as Record<string, unknown> | undefined;

    // Try to extract code from API response body
    const apiCode = (data?.code || data?.error) as string | undefined;
    const apiMessage = (data?.message || data?.error_description) as string | undefined;

    const code = this.mapCode(status, apiCode);
    const message = apiMessage || err.message;
    const hint = ERROR_HINTS[code];

    this.logger.debug(`API error ${status} ${code}: ${message}`);

    return { code, message, hint };
  }

  private mapCode(status: number | undefined, apiCode?: string): LbmErrorCode {
    if (apiCode === 'INSUFFICIENT_CREDITS') return 'INSUFFICIENT_CREDITS';
    if (apiCode === 'RATE_LIMITED') return 'RATE_LIMITED';

    switch (status) {
      case 401: return 'UNAUTHORIZED';
      case 402: return 'INSUFFICIENT_CREDITS';
      case 404: return 'NOT_FOUND';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMITED';
      default:  return 'UNKNOWN';
    }
  }
}

/** Format an LbmApiError into the MCP tool error response text */
export function formatApiError(err: LbmApiError): string {
  const hint = err.hint ? ` ${err.hint}` : '';
  return `API Error [${err.code}]: ${err.message}.${hint}`;
}

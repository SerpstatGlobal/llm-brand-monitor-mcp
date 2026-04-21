import * as path from 'path';
import * as fs from 'fs';
import { RuntimeConfig, LogLevel, TransportMode } from './types.js';

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

export const SERVER_NAME = 'lbm-mcp-server';
export const SERVER_VERSION: string = pkg.version;

const VALID_LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];
const VALID_TRANSPORT_MODES: TransportMode[] = ['stdio', 'http'];

export function loadConfig(): RuntimeConfig {
  // Transport mode
  const transportRaw = (process.env.TRANSPORT_MODE || 'stdio').toLowerCase();
  const transportMode: TransportMode = VALID_TRANSPORT_MODES.includes(transportRaw as TransportMode)
    ? (transportRaw as TransportMode)
    : 'stdio';

  // LBM API base URL
  const apiBaseUrl = process.env.LBM_API_BASE_URL || 'https://llmbrandmonitor.com/api/v1';

  // API token: required for stdio, optional for http (comes from JWT per-request)
  const apiToken = process.env.LBM_API_KEY || '';
  if (transportMode === 'stdio' && !apiToken) {
    console.error('Fatal: LBM_API_KEY environment variable is required for stdio mode');
    process.exit(1);
  }

  // Log level
  const logLevelRaw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const logLevel: LogLevel = VALID_LOG_LEVELS.includes(logLevelRaw as LogLevel)
    ? (logLevelRaw as LogLevel)
    : 'info';

  // HTTP config (only when transport = http)
  const parsedPort = parseInt(process.env.HTTP_PORT || '8083', 10);
  const parsedMaxSessions = parseInt(process.env.MAX_SESSIONS || '200', 10);
  const http = transportMode === 'http' ? {
    port: isNaN(parsedPort) ? 8083 : parsedPort,
    serverBaseUrl: process.env.SERVER_BASE_URL || '',
    oryApiUrl: process.env.OAUTH_ORY_API_URL || 'https://auth.llmbrandmonitor.com',
    testMode: process.env.OAUTH_TEST_MODE === 'true',
    maxSessions: isNaN(parsedMaxSessions) ? 200 : parsedMaxSessions,
  } : null;

  if (transportMode === 'http' && http && !http.serverBaseUrl) {
    console.error('Fatal: SERVER_BASE_URL environment variable is required for http mode');
    process.exit(1);
  }

  return {
    apiBaseUrl,
    apiToken,
    transportMode,
    logLevel,
    http,
  };
}

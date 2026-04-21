#!/usr/bin/env node

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { LbmApiClient } from './api-client.js';
import { ToolCallCache } from './cache.js';
import { LbmMCPServer } from './server.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info(`LBM MCP Server starting (${config.transportMode} mode)`);
  logger.info(`API base URL: ${config.apiBaseUrl}`);

  const api = new LbmApiClient(config.apiBaseUrl, config.apiToken, logger);
  const cache = new ToolCallCache({ logger });

  if (config.transportMode === 'http') {
    // HTTP mode implemented in Phase 6
    logger.error('HTTP transport mode is not yet implemented. Use TRANSPORT_MODE=stdio.');
    process.exit(1);
  } else {
    const server = new LbmMCPServer(api, logger, cache);

    const shutdown = async () => {
      logger.info('Shutting down...');
      await server.close();
      cache.destroy();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await server.startStdio();
  }
}

main().catch((error) => {
  console.error('Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});

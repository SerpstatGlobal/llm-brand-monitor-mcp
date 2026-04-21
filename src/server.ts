import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { LbmApiClient } from './api-client.js';
import { ToolCallCache } from './cache.js';
import { Logger } from './logger.js';
import { SERVER_NAME, SERVER_VERSION } from './config.js';

import { projectToolDefinitions, handleListProjects, handleGetProject, handleCreateProject, handleUpdateProject, handleArchiveProject, handleAddPrompts, handleDeletePrompt } from './tools/projects.js';
import { scanToolDefinitions, handleRunScan, handleGetScanStatus, handleListScans } from './tools/scans.js';
import { resultToolDefinitions, handleListResults, handleGetTranscript, handleListCompetitors, handleListLinks, handleGetHistory } from './tools/results.js';
import { modelToolDefinitions, handleListModels, handleGetUsage } from './tools/models.js';

const ALL_TOOL_DEFINITIONS = [
  ...projectToolDefinitions,
  ...scanToolDefinitions,
  ...resultToolDefinitions,
  ...modelToolDefinitions,
];

export class LbmMCPServer {
  private server: Server;
  private api: LbmApiClient;
  private cache: ToolCallCache | null;
  private logger: Logger;

  constructor(api: LbmApiClient, logger: Logger, cache?: ToolCallCache) {
    this.api = api;
    this.logger = logger;
    this.cache = cache ?? null;

    this.server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } },
    );

    this.setupHandlers();
  }

  getServer(): Server {
    return this.server;
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_TOOL_DEFINITIONS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args = {} } = request.params;
      const a = args as Record<string, unknown>;

      // In HTTP mode token comes from JWT authInfo; in stdio mode use 'stdio' as cache key
      const authInfo = extra?.authInfo as { token?: string } | undefined;
      const token = authInfo?.token ?? 'stdio';

      switch (name) {
        // Projects
        case 'lbm_list_projects':    return handleListProjects(a, this.api, this.cache, token);
        case 'lbm_get_project':      return handleGetProject(a, this.api, this.cache, token);
        case 'lbm_create_project':   return handleCreateProject(a, this.api);
        case 'lbm_update_project':   return handleUpdateProject(a, this.api);
        case 'lbm_archive_project':  return handleArchiveProject(a, this.api);
        case 'lbm_add_prompts':      return handleAddPrompts(a, this.api);
        case 'lbm_delete_prompt':    return handleDeletePrompt(a, this.api);
        // Scans
        case 'lbm_run_scan':         return handleRunScan(a, this.api);
        case 'lbm_get_scan_status':  return handleGetScanStatus(a, this.api, this.cache, token);
        case 'lbm_list_scans':       return handleListScans(a, this.api, this.cache, token);
        // Results
        case 'lbm_list_results':     return handleListResults(a, this.api, this.cache, token);
        case 'lbm_get_transcript':   return handleGetTranscript(a, this.api, this.cache, token);
        case 'lbm_list_competitors': return handleListCompetitors(a, this.api, this.cache, token);
        case 'lbm_list_links':       return handleListLinks(a, this.api, this.cache, token);
        case 'lbm_get_history':      return handleGetHistory(a, this.api, this.cache, token);
        // Models
        case 'lbm_list_models':      return handleListModels(a, this.api, this.cache, token);
        case 'lbm_get_usage':        return handleGetUsage(a, this.api, this.cache, token);

        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    });
  }

  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('LBM MCP Server started (stdio)');
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

/** Factory for per-request server instances (HTTP mode) */
export function createMCPServer(
  api: LbmApiClient,
  logger: Logger,
  cache?: ToolCallCache,
): LbmMCPServer {
  return new LbmMCPServer(api, logger, cache);
}

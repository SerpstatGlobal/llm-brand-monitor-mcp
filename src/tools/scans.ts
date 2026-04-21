import { LbmApiClient, formatApiError } from '../api-client.js';
import { ToolCallCache, hashToken } from '../cache.js';
import { requireString } from '../types.js';
import { formatResponse, FormatConfig } from '../format.js';

const LIST_SCANS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'scan_id', alias: 'scan_id' },
    { source: 'status', alias: 'status' },
    { source: 'created_at', alias: 'created_at' },
    { source: 'results_count', alias: 'results_count' },
  ],
};

type ToolResult = { content: [{ type: 'text'; text: string }]; isError?: true };

function ok(data: unknown): ToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}

function err(e: unknown): ToolResult {
  const text = e && typeof e === 'object' && 'code' in e
    ? formatApiError(e as Parameters<typeof formatApiError>[0])
    : `Error: ${String(e)}`;
  return { content: [{ type: 'text', text }], isError: true };
}

// ─── Tool definitions ────────────────────────────────────────────────────────

export const scanToolDefinitions = [
  {
    name: 'lbm_run_scan',
    description:
      'WHEN TO USE: To start a new monitoring scan for a project — sends prompts to all configured LLMs and collects responses. ' +
      'REQUIRES: project_id from lbm_list_projects. Project must have at least one prompt (use lbm_add_prompts if needed). ' +
      'RETURNS: Created scan object with scan_id and status="pending". ' +
      'NEXT STEP: Poll lbm_get_scan_status with scan_id until status="completed". ' +
      'CAUTION: This SPENDS user credits. Always confirm with the user before running.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID to scan' },
        prompt_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific prompt IDs to scan. Default: all project prompts.',
        },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: override which LLM models to use for this scan. Defaults to project models.',
        },
        use_web_search: { type: 'boolean', description: 'Optional: enable web search for this scan' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'Run Scan', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lbm_get_scan_status',
    description:
      'WHEN TO USE: To check the status of a running or completed scan. ' +
      'REQUIRES: project_id and scan_id from lbm_run_scan or lbm_list_scans. ' +
      'RETURNS: Scan object with status (pending/running/completed/failed), progress, start/end times, and result count. ' +
      'NEXT STEP: When status="completed", call lbm_list_results to see monitoring results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        scan_id: { type: 'string', description: 'Scan ID from lbm_run_scan' },
      },
      required: ['project_id', 'scan_id'],
    },
    annotations: { title: 'Get Scan Status', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_list_scans',
    description:
      'WHEN TO USE: To see the scan history for a project — all past and current scans with their statuses. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Compact CSV with scan_id, status, created_at, results_count (default). Set include_all_fields=true for full JSON.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        status: { type: 'string', description: 'Optional: filter by status (queued, running, completed, partial, failed)' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'List Scans', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

export async function handleRunScan(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const body: Record<string, unknown> = {};
    if (args.prompt_ids) body.prompt_ids = args.prompt_ids;
    if (args.models) body.models = args.models;
    if (args.use_web_search != null) body.use_web_search = args.use_web_search;
    const data = await api.post(`/projects/${project_id}/scans`, body);
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleGetScanStatus(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const scan_id = requireString(args, 'scan_id');
    const fn = () => api.get(`/projects/${project_id}/scans/${scan_id}`);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_get_scan_status', { project_id, scan_id }, fn)
      : await fn();
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleListScans(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const allFields = args.include_all_fields === true;
    const { project_id: _, include_all_fields: __, ...params } = args;
    if (params.limit == null) params.limit = 20;
    if (params.offset == null) params.offset = 0;
    const fn = () => api.get(`/projects/${project_id}/scans`, params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_scans', { project_id, ...params }, fn)
      : await fn();
    return ok(formatResponse(data, LIST_SCANS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

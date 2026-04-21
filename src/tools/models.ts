import { LbmApiClient, formatApiError } from '../api-client.js';
import { ToolCallCache, hashToken } from '../cache.js';
import { formatResponse, FormatConfig } from '../format.js';

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

const LIST_MODELS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'model_id', alias: 'model_id' },
    { source: 'name', alias: 'name' },
    { source: 'provider', alias: 'provider' },
    { source: 'supports_web_search', alias: 'web_search' },
  ],
};

// ─── Tool definitions ────────────────────────────────────────────────────────

export const modelToolDefinitions = [
  {
    name: 'lbm_list_models',
    description:
      'WHEN TO USE: To discover which LLM models are available for brand monitoring scans. ' +
      'Call this before creating a project or running a scan if the user wants to choose specific models. ' +
      'RETURNS: Compact CSV with model_id, name, provider, web_search (default). Set include_all_fields=true for full JSON with pricing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
    },
    annotations: { title: 'List Models', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_get_usage',
    description:
      'WHEN TO USE: To check credit balance and usage statistics. Call this before lbm_run_scan to confirm the user has enough credits. ' +
      'RETURNS: Current credit balance, credits used this period, credits per scan estimate, and usage breakdown by model and project.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'Start date ISO 8601 for usage period (optional, default: current month start)' },
        end_date: { type: 'string', description: 'End date ISO 8601 for usage period (required if start_date provided)' },
      },
    },
    annotations: { title: 'Get Usage', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

export async function handleListModels(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const allFields = args.include_all_fields === true;
    const params = { offset: args.offset ?? 0, limit: args.limit ?? 20 };
    const fn = () => api.get('/models', params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_models', params, fn)
      : await fn();
    return ok(formatResponse(data, LIST_MODELS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

export async function handleGetUsage(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  const params = { start_date: args.start_date, end_date: args.end_date };
  try {
    const fn = () => api.get('/usage', params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_get_usage', params, fn)
      : await fn();
    return ok(data);
  } catch (e) { return err(e); }
}

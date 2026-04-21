import { LbmApiClient, formatApiError } from '../api-client.js';
import { ToolCallCache, hashToken } from '../cache.js';
import { requireString } from '../types.js';
import { formatResponse, FormatConfig } from '../format.js';

const LIST_RESULTS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'result_id', alias: 'result_id' },
    { source: 'prompt_text', alias: 'prompt' },
    { source: 'model_name', alias: 'model' },
    { source: 'brand_mentioned', alias: 'brand_mentioned' },
    { source: 'status', alias: 'status' },
  ],
};

const LIST_COMPETITORS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'competitor_name', alias: 'competitor' },
    { source: 'mention_frequency', alias: 'mentions' },
    { source: 'visibility_percent', alias: 'visibility_pct' },
  ],
};

const LIST_LINKS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'domain', alias: 'domain' },
    { source: 'frequency', alias: 'mentions' },
    { source: 'unique_urls', alias: 'unique_urls' },
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

export const resultToolDefinitions = [
  {
    name: 'lbm_list_results',
    description:
      'WHEN TO USE: To get monitoring results for a project — how LLMs responded to brand monitoring prompts. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Compact CSV with result_id, prompt, model, brand_mentioned, status (default limit: 20). Set include_all_fields=true for full JSON. ' +
      'NEXT STEP: Use lbm_get_transcript with a result_id to read the full LLM response text.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        scan_id: { type: 'string', description: 'Optional: filter by specific scan' },
        status: { type: 'string', description: 'Optional: filter by status (success, failure, pending, queued)' },
        tags: { type: 'string', description: 'Optional: filter by comma-separated prompt tags (OR logic)' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'List Results', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_get_transcript',
    description:
      'WHEN TO USE: To read the full verbatim LLM response for a specific monitoring result. ' +
      'Use when the user wants to see exactly what an LLM said about their brand. ' +
      'REQUIRES: project_id and result_id from lbm_list_results. ' +
      'RETURNS: Full transcript text, model name, prompt text, and metadata (brand_mentioned, sentiment, links found).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        result_id: { type: 'string', description: 'Result ID from lbm_list_results' },
      },
      required: ['project_id', 'result_id'],
    },
    annotations: { title: 'Get Transcript', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_list_competitors',
    description:
      'WHEN TO USE: To see which competitor brands were mentioned by LLMs in responses to this project\'s prompts. ' +
      'Shows competitive landscape as seen by AI models. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Compact CSV with competitor name, mention count, frequency % (default limit: 20). Set include_all_fields=true for full JSON. Pass higher limit only if user explicitly asks for more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        tags: { type: 'string', description: 'Optional: filter by comma-separated prompt tags' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Max competitors to return (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'List Competitors', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_list_links',
    description:
      'WHEN TO USE: To see which URLs and domains LLMs cited in their responses — useful for understanding what sources AI models trust for this topic. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Compact CSV with domain, mentions, unique_urls (default limit: 20). Set include_all_fields=true for full JSON with individual URLs. Pass higher limit only if user explicitly asks for more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        domain: { type: 'string', description: 'Optional: filter by exact domain' },
        min_frequency: { type: 'number', description: 'Optional: minimum result mentions' },
        tags: { type: 'string', description: 'Optional: filter by comma-separated prompt tags' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Max links to return (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'List Links', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_get_history',
    description:
      'WHEN TO USE: To see competitor mention trends over time — which competitors were mentioned by LLMs across multiple scans and how their visibility changed. ' +
      'Use for competitive trend analysis and reporting. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Historical competitor mention statistics per date, with per-model breakdowns. ' +
      'NOTE: Response structure may differ between time_range and start_date/end_date params.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        time_range: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Time range shortcut (default: 30d). Overridden by start_date/end_date.',
        },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD (overrides time_range)' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD (required with start_date)' },
        model_filter: { type: 'string', description: 'Optional: comma-separated model IDs' },
        prompt_filter: { type: 'string', description: 'Optional: comma-separated prompt texts' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'Get History', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

export async function handleListResults(
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
    const fn = () => api.get(`/projects/${project_id}/results`, params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_results', args, fn)
      : await fn();
    return ok(formatResponse(data, LIST_RESULTS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

export async function handleGetTranscript(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const result_id = requireString(args, 'result_id');
    const fn = () => api.get(`/projects/${project_id}/results/${result_id}/transcript`);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_get_transcript', { project_id, result_id }, fn)
      : await fn();
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleListCompetitors(
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
    const fn = () => api.get(`/projects/${project_id}/competitors`, params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_competitors', args, fn)
      : await fn();
    return ok(formatResponse(data, LIST_COMPETITORS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

export async function handleListLinks(
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
    const fn = () => api.get(`/projects/${project_id}/links`, params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_links', args, fn)
      : await fn();
    return ok(formatResponse(data, LIST_LINKS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

export async function handleGetHistory(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const { project_id: _, ...params } = args;
    if (params.limit == null) params.limit = 20;
    if (params.offset == null) params.offset = 0;
    const fn = () => api.get(`/projects/${project_id}/history`, params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_get_history', args, fn)
      : await fn();
    return ok(data);
  } catch (e) { return err(e); }
}

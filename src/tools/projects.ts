import { LbmApiClient, formatApiError } from '../api-client.js';
import { ToolCallCache, hashToken } from '../cache.js';
import { requireString } from '../types.js';
import { formatResponse, FormatConfig } from '../format.js';

const LIST_PROJECTS_FORMAT: FormatConfig = {
  arrayPath: 'data',
  fields: [
    { source: 'project_id', alias: 'id' },
    { source: 'brand_name', alias: 'brand_name' },
    { source: 'status', alias: 'status' },
    { source: 'visibility_percent', alias: 'visibility_pct' },
    { alias: 'models_count', compute: item => Array.isArray(item.models) ? item.models.length : 0 },
    { alias: 'prompts_count', compute: item => Array.isArray(item.prompts) ? item.prompts.length : 0 },
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

export const projectToolDefinitions = [
  {
    name: 'lbm_list_projects',
    description:
      'WHEN TO USE: To get a list of all brand monitoring projects for the current user. ' +
      'Use as the FIRST step to discover available projects before working with scans or results. ' +
      'RETURNS: Compact CSV with id, brand_name, status, visibility_pct, models_count, prompts_count (default). Set include_all_fields=true for full JSON. ' +
      'NEXT STEP: Use lbm_get_project with a specific project id for full details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Optional: filter by status (active, inactive, pending)' },
        offset: { type: 'number', description: 'Items to skip (default: 0)' },
        limit: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        include_all_fields: { type: 'boolean', description: 'Set true for full JSON response. Default: false (compact CSV — recommended).' },
      },
    },
    annotations: { title: 'List Projects', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_get_project',
    description:
      'WHEN TO USE: To get full details of a specific brand monitoring project including all prompts. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Project object with id, name, description, status, models, prompts array, schedule, and stats.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'Get Project', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_create_project',
    description:
      'WHEN TO USE: To create a new brand monitoring project. ' +
      'RETURNS: Created project object with generated id. ' +
      'NEXT STEP: Call lbm_run_scan to start monitoring.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name (required)' },
        brand_name: { type: 'string', description: 'Brand name to monitor (required)' },
        domain: { type: 'string', description: 'Brand domain (required, e.g. "example.com")' },
        language: { type: 'string', description: '2-letter ISO language code (required, e.g. "en", "uk")' },
        location: { type: 'string', description: 'Country name, 2-letter ISO code, or "auto" (required)' },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'LLM model IDs to monitor (required). Call lbm_list_models to get available IDs.',
        },
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The prompt text' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
            },
            required: ['text'],
          },
          description: 'Array of monitoring prompts (required)',
        },
        auto_monitoring: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Enable auto monitoring' },
          },
          description: 'Optional auto monitoring config',
        },
      },
      required: ['project_name', 'brand_name', 'domain', 'language', 'location', 'models', 'prompts'],
    },
    annotations: { title: 'Create Project', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'lbm_update_project',
    description:
      'WHEN TO USE: To update project name, models, or auto monitoring settings. Only provided fields are updated. ' +
      'NOTE: brand_name and prompts cannot be modified via this endpoint. Use lbm_add_prompts/lbm_delete_prompt for prompt changes. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Updated project object.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        project_name: { type: 'string', description: 'New project name' },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'New list of LLM model IDs to monitor',
        },
        auto_monitoring: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Enable/disable auto monitoring' },
            frequency: { type: 'string', description: 'Monitoring frequency' },
          },
          description: 'Auto monitoring settings',
        },
      },
      required: ['project_id'],
    },
    annotations: { title: 'Update Project', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_archive_project',
    description:
      'WHEN TO USE: To archive a project that is no longer needed. Archived projects are hidden but not deleted. ' +
      'REQUIRES: project_id from lbm_list_projects. Confirm with user before archiving.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID to archive' },
      },
      required: ['project_id'],
    },
    annotations: { title: 'Archive Project', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'lbm_add_prompts',
    description:
      'WHEN TO USE: To add one or more monitoring prompts to a project. Prompts are the questions asked to LLMs (e.g. "What are the best tools for X?"). ' +
      'Max 50 per request, 100 per project total. ' +
      'REQUIRES: project_id from lbm_list_projects. ' +
      'RETURNS: Array of created prompts with prompt_id. ' +
      'NEXT STEP: Call lbm_run_scan to run a scan with the new prompts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The prompt text' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
            },
            required: ['text'],
          },
          description: 'Array of prompts to add (max 50)',
        },
      },
      required: ['project_id', 'prompts'],
    },
    annotations: { title: 'Add Prompts', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'lbm_delete_prompt',
    description:
      'WHEN TO USE: To remove a specific prompt from a project. ' +
      'REQUIRES: project_id and prompt_id. Get prompt_id from lbm_get_project (prompts array). ' +
      'NOTE: Project must have at least 2 prompts; cannot delete from archived project. ' +
      'Confirm with user before deleting.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        prompt_id: { type: 'string', description: 'Prompt ID to delete (from lbm_get_project)' },
      },
      required: ['project_id', 'prompt_id'],
    },
    annotations: { title: 'Delete Prompt', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

export async function handleListProjects(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  const allFields = args.include_all_fields === true;
  const params: Record<string, unknown> = {
    offset: args.offset ?? 0,
    limit: args.limit ?? 20,
  };
  if (args.status) params.status = args.status;
  try {
    const fn = () => api.get('/projects', params);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_list_projects', params, fn)
      : await fn();
    return ok(formatResponse(data, LIST_PROJECTS_FORMAT, allFields));
  } catch (e) { return err(e); }
}

export async function handleGetProject(
  args: Record<string, unknown>,
  api: LbmApiClient,
  cache: ToolCallCache | null,
  token: string,
): Promise<ToolResult> {
  try {
    const id = requireString(args, 'project_id');
    const fn = () => api.get(`/projects/${id}`);
    const data = cache
      ? await cache.executeWithCache(hashToken(token), 'lbm_get_project', { id }, fn)
      : await fn();
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleCreateProject(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    requireString(args, 'project_name');
    requireString(args, 'brand_name');
    requireString(args, 'domain');
    requireString(args, 'language');
    requireString(args, 'location');
    const data = await api.post('/projects', {
      project_name: args.project_name,
      brand_name: args.brand_name,
      domain: args.domain,
      language: args.language,
      location: args.location,
      models: args.models,
      prompts: args.prompts,
      auto_monitoring: args.auto_monitoring,
    });
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleUpdateProject(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const { project_id: _, ...fields } = args;
    const data = await api.patch(`/projects/${project_id}`, fields);
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleArchiveProject(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const data = await api.delete(`/projects/${project_id}`, { mode: 'archive' });
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleAddPrompts(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    if (!Array.isArray(args.prompts) || args.prompts.length === 0) {
      return err(new Error('Missing required parameter: "prompts" must be a non-empty array'));
    }
    const data = await api.post(`/projects/${project_id}/prompts`, { prompts: args.prompts });
    return ok(data);
  } catch (e) { return err(e); }
}

export async function handleDeletePrompt(
  args: Record<string, unknown>,
  api: LbmApiClient,
): Promise<ToolResult> {
  try {
    const project_id = requireString(args, 'project_id');
    const prompt_id = requireString(args, 'prompt_id');
    const data = await api.delete(`/projects/${project_id}/prompts/${prompt_id}`);
    return ok(data);
  } catch (e) { return err(e); }
}

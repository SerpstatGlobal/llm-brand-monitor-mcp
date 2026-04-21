import { LbmMCPServer } from '../server.js';
import { LbmApiClient } from '../api-client.js';
import { Logger } from '../logger.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

jest.mock('../api-client.js');

const logger: Logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

function makeApi(): jest.Mocked<LbmApiClient> {
  return new (LbmApiClient as any)() as jest.Mocked<LbmApiClient>;
}

function getHandler(server: LbmMCPServer, method: string) {
  const internal: Server = (server as any).server;
  return (internal as any)._requestHandlers.get(method);
}

describe('LbmMCPServer — tools/list', () => {
  test('returns 17 tools', async () => {
    const server = new LbmMCPServer(makeApi(), logger);
    const handler = getHandler(server, 'tools/list');
    const result = await handler({ method: 'tools/list' });
    expect(result.tools).toHaveLength(17);
  });

  test('all tool names are present', async () => {
    const server = new LbmMCPServer(makeApi(), logger);
    const handler = getHandler(server, 'tools/list');
    const result = await handler({ method: 'tools/list' });
    const names = result.tools.map((t: any) => t.name);

    const expected = [
      'lbm_list_projects', 'lbm_get_project', 'lbm_create_project',
      'lbm_update_project', 'lbm_archive_project', 'lbm_add_prompts', 'lbm_delete_prompt',
      'lbm_run_scan', 'lbm_get_scan_status', 'lbm_list_scans',
      'lbm_list_results', 'lbm_get_transcript', 'lbm_list_competitors',
      'lbm_list_links', 'lbm_get_history',
      'lbm_list_models', 'lbm_get_usage',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  test('lbm_run_scan has destructiveHint: true', async () => {
    const server = new LbmMCPServer(makeApi(), logger);
    const handler = getHandler(server, 'tools/list');
    const result = await handler({ method: 'tools/list' });
    const runScan = result.tools.find((t: any) => t.name === 'lbm_run_scan');
    expect(runScan.annotations.destructiveHint).toBe(true);
  });

  test('lbm_run_scan description contains CAUTION', async () => {
    const server = new LbmMCPServer(makeApi(), logger);
    const handler = getHandler(server, 'tools/list');
    const result = await handler({ method: 'tools/list' });
    const runScan = result.tools.find((t: any) => t.name === 'lbm_run_scan');
    expect(runScan.description).toContain('CAUTION');
    expect(runScan.description).toContain('credits');
  });
});

describe('LbmMCPServer — tools/call dispatch', () => {
  let api: jest.Mocked<LbmApiClient>;
  let server: LbmMCPServer;
  let callHandler: (req: any, extra?: any) => Promise<any>;

  beforeEach(() => {
    api = makeApi();
    api.get = jest.fn().mockResolvedValue({ data: [] });
    api.post = jest.fn().mockResolvedValue({ id: 'new' });
    api.patch = jest.fn().mockResolvedValue({ id: '1' });
    api.delete = jest.fn().mockResolvedValue({ success: true });
    server = new LbmMCPServer(api, logger);
    callHandler = getHandler(server, 'tools/call');
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    return callHandler({ method: 'tools/call', params: { name, arguments: args } });
  }

  test('lbm_list_projects calls GET /projects', async () => {
    await call('lbm_list_projects');
    expect(api.get).toHaveBeenCalledWith('/projects', expect.any(Object));
  });

  test('lbm_get_project calls GET /projects/:id', async () => {
    await call('lbm_get_project', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1');
  });

  test('lbm_get_project errors on missing project_id', async () => {
    const result = await call('lbm_get_project', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('project_id');
  });

  test('lbm_create_project calls POST /projects', async () => {
    await call('lbm_create_project', {
      project_name: 'My Brand', brand_name: 'Brand', domain: 'brand.com',
      language: 'en', location: 'US', models: ['gpt-4'], prompts: [{ text: 'Test?' }],
    });
    expect(api.post).toHaveBeenCalledWith('/projects', expect.objectContaining({ project_name: 'My Brand' }));
  });

  test('lbm_create_project errors on missing project_name', async () => {
    const result = await call('lbm_create_project', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('project_name');
  });

  test('lbm_update_project calls PATCH /projects/:id', async () => {
    await call('lbm_update_project', { project_id: 'proj-1', project_name: 'New Name' });
    expect(api.patch).toHaveBeenCalledWith('/projects/proj-1', expect.objectContaining({ project_name: 'New Name' }));
  });

  test('lbm_archive_project calls DELETE /projects/:id', async () => {
    await call('lbm_archive_project', { project_id: 'proj-1' });
    expect(api.delete).toHaveBeenCalledWith('/projects/proj-1', { mode: 'archive' });
  });

  test('lbm_add_prompts calls POST /projects/:id/prompts', async () => {
    await call('lbm_add_prompts', { project_id: 'proj-1', prompts: [{ text: 'Test?' }] });
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/prompts', expect.any(Object));
  });

  test('lbm_add_prompts errors on empty prompts array', async () => {
    const result = await call('lbm_add_prompts', { project_id: 'proj-1', prompts: [] });
    expect(result.isError).toBe(true);
  });

  test('lbm_delete_prompt calls DELETE /projects/:id/prompts/:promptId', async () => {
    await call('lbm_delete_prompt', { project_id: 'proj-1', prompt_id: 'p-1' });
    expect(api.delete).toHaveBeenCalledWith('/projects/proj-1/prompts/p-1');
  });

  test('lbm_run_scan calls POST /projects/:id/scans', async () => {
    await call('lbm_run_scan', { project_id: 'proj-1' });
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/scans', expect.any(Object));
  });

  test('lbm_get_scan_status calls GET /projects/:id/scans/:scanId', async () => {
    await call('lbm_get_scan_status', { project_id: 'proj-1', scan_id: 'scan-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/scans/scan-1');
  });

  test('lbm_list_scans calls GET /projects/:id/scans', async () => {
    await call('lbm_list_scans', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/scans', expect.any(Object));
  });

  test('lbm_list_results calls GET /projects/:id/results', async () => {
    await call('lbm_list_results', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/results', expect.any(Object));
  });

  test('lbm_get_transcript calls GET /projects/:id/results/:resultId/transcript', async () => {
    await call('lbm_get_transcript', { project_id: 'proj-1', result_id: 'res-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/results/res-1/transcript');
  });

  test('lbm_list_competitors calls GET /projects/:id/competitors', async () => {
    await call('lbm_list_competitors', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/competitors', expect.any(Object));
  });

  test('lbm_list_links calls GET /projects/:id/links', async () => {
    await call('lbm_list_links', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/links', expect.any(Object));
  });

  test('lbm_get_history calls GET /projects/:id/history', async () => {
    await call('lbm_get_history', { project_id: 'proj-1' });
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/history', expect.any(Object));
  });

  test('lbm_list_models calls GET /models', async () => {
    await call('lbm_list_models');
    expect(api.get).toHaveBeenCalledWith('/models', expect.any(Object));
  });

  test('lbm_get_usage calls GET /usage', async () => {
    await call('lbm_get_usage');
    expect(api.get).toHaveBeenCalledWith('/usage', expect.any(Object));
  });

  test('unknown tool returns isError', async () => {
    const result = await call('lbm_nonexistent');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  test('API error is returned as isError result', async () => {
    // Simulate an LbmApiError — the handler catches it and returns isError: true
    // We mock get to reject with a plain Error so the MCP SDK doesn't intercept it,
    // and verify the isError flag and error text are present
    api.get = jest.fn().mockRejectedValue(new Error('NOT_FOUND: Project not found'));
    const result = await call('lbm_list_projects');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('NOT_FOUND');
  });
});

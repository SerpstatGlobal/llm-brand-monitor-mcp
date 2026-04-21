import { LbmApiClient } from '../../api-client.js';
import {
  handleListProjects, handleGetProject, handleCreateProject,
  handleUpdateProject, handleArchiveProject, handleAddPrompts, handleDeletePrompt,
} from '../../tools/projects.js';

jest.mock('../../api-client.js', () => ({
  LbmApiClient: jest.fn(),
  formatApiError: jest.requireActual('../../api-client.js').formatApiError,
}));

function makeApi(): jest.Mocked<LbmApiClient> {
  const api = new (LbmApiClient as any)() as jest.Mocked<LbmApiClient>;
  api.get    = jest.fn().mockResolvedValue({ data: [] });
  api.post   = jest.fn().mockResolvedValue({ id: 'new' });
  api.patch  = jest.fn().mockResolvedValue({ id: '1' });
  api.delete = jest.fn().mockResolvedValue({ success: true });
  return api;
}

const TOKEN = 'lbm_test';

describe('handleListProjects', () => {
  test('calls GET /projects with default offset and limit', async () => {
    const api = makeApi();
    await handleListProjects({}, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects', { offset: 0, limit: 20 });
  });

  test('passes offset, limit, and status', async () => {
    const api = makeApi();
    await handleListProjects({ offset: 20, limit: 10, status: 'active' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects', { offset: 20, limit: 10, status: 'active' });
  });

  test('returns ok result with data', async () => {
    const api = makeApi();
    api.get.mockResolvedValue({ data: [{ project_id: 'p1', brand_name: 'Test', status: 'active' }] });
    const result = await handleListProjects({}, api, null, TOKEN);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('p1');
  });

  test('returns error on API failure', async () => {
    const api = makeApi();
    api.get.mockRejectedValue({ code: 'UNAUTHORIZED', message: 'Forbidden', hint: 'Reconnect.' });
    const result = await handleListProjects({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('UNAUTHORIZED');
  });
});

describe('handleGetProject', () => {
  test('calls GET /projects/:id', async () => {
    const api = makeApi();
    await handleGetProject({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleGetProject({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('project_id');
  });

  test('errors on empty project_id', async () => {
    const api = makeApi();
    const result = await handleGetProject({ project_id: '' }, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

describe('handleCreateProject', () => {
  test('calls POST /projects with required fields', async () => {
    const api = makeApi();
    await handleCreateProject({
      project_name: 'My Brand', brand_name: 'Brand', domain: 'brand.com',
      language: 'en', location: 'US', models: ['gpt-4'], prompts: [{ text: 'Test?' }],
    }, api);
    expect(api.post).toHaveBeenCalledWith('/projects', expect.objectContaining({
      project_name: 'My Brand', brand_name: 'Brand', domain: 'brand.com',
    }));
  });

  test('errors on missing project_name', async () => {
    const api = makeApi();
    const result = await handleCreateProject({}, api);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('project_name');
  });

  test('passes auto_monitoring', async () => {
    const api = makeApi();
    await handleCreateProject({
      project_name: 'B', brand_name: 'B', domain: 'b.com',
      language: 'en', location: 'US', models: ['gpt-4'], prompts: [{ text: 'Q?' }],
      auto_monitoring: { enabled: true },
    }, api);
    expect(api.post).toHaveBeenCalledWith('/projects', expect.objectContaining({
      auto_monitoring: { enabled: true },
    }));
  });
});

describe('handleUpdateProject', () => {
  test('calls PATCH /projects/:id', async () => {
    const api = makeApi();
    await handleUpdateProject({ project_id: 'proj-1', project_name: 'New' }, api);
    expect(api.patch).toHaveBeenCalledWith('/projects/proj-1', expect.objectContaining({ project_name: 'New' }));
  });

  test('does not send project_id in body', async () => {
    const api = makeApi();
    await handleUpdateProject({ project_id: 'proj-1', project_name: 'New' }, api);
    const body = (api.patch as jest.Mock).mock.calls[0][1];
    expect(body).not.toHaveProperty('project_id');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleUpdateProject({ project_name: 'X' }, api);
    expect(result.isError).toBe(true);
  });
});

describe('handleArchiveProject', () => {
  test('calls DELETE /projects/:id with mode=archive', async () => {
    const api = makeApi();
    await handleArchiveProject({ project_id: 'proj-1' }, api);
    expect(api.delete).toHaveBeenCalledWith('/projects/proj-1', { mode: 'archive' });
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleArchiveProject({}, api);
    expect(result.isError).toBe(true);
  });
});

describe('handleAddPrompts', () => {
  test('calls POST /projects/:id/prompts', async () => {
    const api = makeApi();
    await handleAddPrompts({ project_id: 'proj-1', prompts: [{ text: 'Test?' }] }, api);
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/prompts', { prompts: [{ text: 'Test?' }] });
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleAddPrompts({ prompts: [{ text: 'X' }] }, api);
    expect(result.isError).toBe(true);
  });

  test('errors on empty prompts array', async () => {
    const api = makeApi();
    const result = await handleAddPrompts({ project_id: 'proj-1', prompts: [] }, api);
    expect(result.isError).toBe(true);
  });

  test('errors on missing prompts', async () => {
    const api = makeApi();
    const result = await handleAddPrompts({ project_id: 'proj-1' }, api);
    expect(result.isError).toBe(true);
  });
});

describe('handleDeletePrompt', () => {
  test('calls DELETE /projects/:id/prompts/:promptId', async () => {
    const api = makeApi();
    await handleDeletePrompt({ project_id: 'proj-1', prompt_id: 'p-42' }, api);
    expect(api.delete).toHaveBeenCalledWith('/projects/proj-1/prompts/p-42');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleDeletePrompt({ prompt_id: 'p-42' }, api);
    expect(result.isError).toBe(true);
  });

  test('errors on missing prompt_id', async () => {
    const api = makeApi();
    const result = await handleDeletePrompt({ project_id: 'proj-1' }, api);
    expect(result.isError).toBe(true);
  });
});

import { LbmApiClient } from '../../api-client.js';
import { handleRunScan, handleGetScanStatus, handleListScans } from '../../tools/scans.js';

jest.mock('../../api-client.js', () => ({
  LbmApiClient: jest.fn(),
  formatApiError: jest.requireActual('../../api-client.js').formatApiError,
}));

function makeApi(): jest.Mocked<LbmApiClient> {
  const api = new (LbmApiClient as any)() as jest.Mocked<LbmApiClient>;
  api.get  = jest.fn().mockResolvedValue({ status: 'completed' });
  api.post = jest.fn().mockResolvedValue({ scan_id: 'scan-1', status: 'pending' });
  return api;
}

const TOKEN = 'lbm_test';

describe('handleRunScan', () => {
  test('calls POST /projects/:id/scans', async () => {
    const api = makeApi();
    await handleRunScan({ project_id: 'proj-1' }, api);
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/scans', {});
  });

  test('passes models override when provided', async () => {
    const api = makeApi();
    await handleRunScan({ project_id: 'proj-1', models: ['gpt-4'] }, api);
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/scans', { models: ['gpt-4'] });
  });

  test('passes prompt_ids and use_web_search', async () => {
    const api = makeApi();
    await handleRunScan({ project_id: 'proj-1', prompt_ids: ['p1'], use_web_search: true }, api);
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/scans', { prompt_ids: ['p1'], use_web_search: true });
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleRunScan({}, api);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('project_id');
  });

  test('returns scan_id in response', async () => {
    const api = makeApi();
    const result = await handleRunScan({ project_id: 'proj-1' }, api);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('scan-1');
  });

  test('returns error on INSUFFICIENT_CREDITS', async () => {
    const api = makeApi();
    api.post.mockRejectedValue({ code: 'INSUFFICIENT_CREDITS', message: 'No credits', hint: 'Top up.' });
    const result = await handleRunScan({ project_id: 'proj-1' }, api);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('INSUFFICIENT_CREDITS');
  });
});

describe('handleGetScanStatus', () => {
  test('calls GET /projects/:id/scans/:scanId', async () => {
    const api = makeApi();
    await handleGetScanStatus({ project_id: 'proj-1', scan_id: 'scan-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/scans/scan-1');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleGetScanStatus({ scan_id: 'scan-1' }, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });

  test('errors on missing scan_id', async () => {
    const api = makeApi();
    const result = await handleGetScanStatus({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scan_id');
  });
});

describe('handleListScans', () => {
  test('calls GET /projects/:id/scans with defaults', async () => {
    const api = makeApi();
    api.get.mockResolvedValue([{ scan_id: 'scan-1' }]);
    await handleListScans({ project_id: 'proj-1' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.offset).toBe(0);
    expect(params.limit).toBe(20);
  });

  test('passes offset, limit, and status filter', async () => {
    const api = makeApi();
    api.get.mockResolvedValue([]);
    await handleListScans({ project_id: 'proj-1', offset: 20, limit: 5, status: 'completed' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).toMatchObject({ offset: 20, limit: 5, status: 'completed' });
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleListScans({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

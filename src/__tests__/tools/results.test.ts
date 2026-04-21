import { LbmApiClient } from '../../api-client.js';
import {
  handleListResults, handleGetTranscript, handleListCompetitors,
  handleListLinks, handleGetHistory,
} from '../../tools/results.js';

jest.mock('../../api-client.js');

function makeApi(): jest.Mocked<LbmApiClient> {
  const api = new (LbmApiClient as any)() as jest.Mocked<LbmApiClient>;
  api.get = jest.fn().mockResolvedValue({ data: [] });
  return api;
}

const TOKEN = 'lbm_test';

describe('handleListResults', () => {
  test('calls GET /projects/:id/results', async () => {
    const api = makeApi();
    await handleListResults({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/results', expect.any(Object));
  });

  test('passes filters (scan_id, status, tags)', async () => {
    const api = makeApi();
    await handleListResults(
      { project_id: 'proj-1', scan_id: 'scan-1', status: 'success', tags: 'brand,seo' },
      api, null, TOKEN,
    );
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).toMatchObject({ scan_id: 'scan-1', status: 'success', tags: 'brand,seo' });
  });

  test('sets default offset and limit', async () => {
    const api = makeApi();
    await handleListResults({ project_id: 'proj-1' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.offset).toBe(0);
    expect(params.limit).toBe(20);
  });

  test('does not pass project_id in params', async () => {
    const api = makeApi();
    await handleListResults({ project_id: 'proj-1', offset: 20 }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).not.toHaveProperty('project_id');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleListResults({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

describe('handleGetTranscript', () => {
  test('calls GET /projects/:id/results/:resultId/transcript', async () => {
    const api = makeApi();
    await handleGetTranscript({ project_id: 'proj-1', result_id: 'res-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/results/res-1/transcript');
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleGetTranscript({ result_id: 'res-1' }, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });

  test('errors on missing result_id', async () => {
    const api = makeApi();
    const result = await handleGetTranscript({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('result_id');
  });
});

describe('handleListCompetitors', () => {
  test('calls GET /projects/:id/competitors', async () => {
    const api = makeApi();
    await handleListCompetitors({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/competitors', expect.any(Object));
  });

  test('passes optional params', async () => {
    const api = makeApi();
    await handleListCompetitors({ project_id: 'proj-1', tags: 'brand', limit: 10 }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).toMatchObject({ tags: 'brand', limit: 10 });
    expect(params).not.toHaveProperty('project_id');
  });

  test('sets default offset and limit', async () => {
    const api = makeApi();
    await handleListCompetitors({ project_id: 'proj-1' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.offset).toBe(0);
    expect(params.limit).toBe(20);
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleListCompetitors({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

describe('handleListLinks', () => {
  test('calls GET /projects/:id/links', async () => {
    const api = makeApi();
    await handleListLinks({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/links', expect.any(Object));
  });

  test('passes domain and min_frequency filters', async () => {
    const api = makeApi();
    await handleListLinks({ project_id: 'proj-1', domain: 'example.com', min_frequency: 5 }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).toMatchObject({ domain: 'example.com', min_frequency: 5 });
  });

  test('sets default offset and limit', async () => {
    const api = makeApi();
    await handleListLinks({ project_id: 'proj-1' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.offset).toBe(0);
    expect(params.limit).toBe(20);
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleListLinks({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

describe('handleGetHistory', () => {
  test('calls GET /projects/:id/history', async () => {
    const api = makeApi();
    await handleGetHistory({ project_id: 'proj-1' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/history', expect.any(Object));
  });

  test('passes date range and filters', async () => {
    const api = makeApi();
    await handleGetHistory(
      { project_id: 'proj-1', start_date: '2025-01-01', end_date: '2025-12-31', model_filter: 'gpt-4' },
      api, null, TOKEN,
    );
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params).toMatchObject({ start_date: '2025-01-01', end_date: '2025-12-31', model_filter: 'gpt-4' });
    expect(params).not.toHaveProperty('project_id');
  });

  test('passes time_range shortcut', async () => {
    const api = makeApi();
    await handleGetHistory({ project_id: 'proj-1', time_range: '7d' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.time_range).toBe('7d');
  });

  test('sets default offset and limit', async () => {
    const api = makeApi();
    await handleGetHistory({ project_id: 'proj-1' }, api, null, TOKEN);
    const params = (api.get as jest.Mock).mock.calls[0][1];
    expect(params.offset).toBe(0);
    expect(params.limit).toBe(20);
  });

  test('errors on missing project_id', async () => {
    const api = makeApi();
    const result = await handleGetHistory({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

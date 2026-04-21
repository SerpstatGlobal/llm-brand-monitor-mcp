import { LbmApiClient } from '../../api-client.js';
import { handleListModels, handleGetUsage } from '../../tools/models.js';

jest.mock('../../api-client.js', () => ({
  LbmApiClient: jest.fn(),
  formatApiError: jest.requireActual('../../api-client.js').formatApiError,
}));

function makeApi(): jest.Mocked<LbmApiClient> {
  const api = new (LbmApiClient as any)() as jest.Mocked<LbmApiClient>;
  api.get = jest.fn().mockResolvedValue({ data: [] });
  return api;
}

const TOKEN = 'lbm_test';

describe('handleListModels', () => {
  test('calls GET /models with default offset and limit', async () => {
    const api = makeApi();
    await handleListModels({}, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/models', { offset: 0, limit: 20 });
  });

  test('passes custom offset and limit', async () => {
    const api = makeApi();
    await handleListModels({ offset: 40, limit: 10 }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/models', { offset: 40, limit: 10 });
  });

  test('returns model list', async () => {
    const api = makeApi();
    api.get.mockResolvedValue({ data: [{ model_id: 'gpt-4', name: 'GPT-4', provider: 'openai', supports_web_search: false }] });
    const result = await handleListModels({}, api, null, TOKEN);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('gpt-4');
  });

  test('returns error on API failure', async () => {
    const api = makeApi();
    api.get.mockRejectedValue({ code: 'UNKNOWN', message: 'Server error' });
    const result = await handleListModels({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
  });
});

describe('handleGetUsage', () => {
  test('calls GET /usage with default params', async () => {
    const api = makeApi();
    await handleGetUsage({}, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/usage', { start_date: undefined, end_date: undefined });
  });

  test('passes start_date/end_date', async () => {
    const api = makeApi();
    await handleGetUsage({ start_date: '2025-01-01T00:00:00.000Z', end_date: '2025-12-31T00:00:00.000Z' }, api, null, TOKEN);
    expect(api.get).toHaveBeenCalledWith('/usage', { start_date: '2025-01-01T00:00:00.000Z', end_date: '2025-12-31T00:00:00.000Z' });
  });

  test('returns credit balance data', async () => {
    const api = makeApi();
    api.get.mockResolvedValue({ credits_balance: 100, credits_used: 50 });
    const result = await handleGetUsage({}, api, null, TOKEN);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('credits_balance');
  });

  test('returns error on UNAUTHORIZED', async () => {
    const api = makeApi();
    api.get.mockRejectedValue({ code: 'UNAUTHORIZED', message: 'Forbidden', hint: 'Reconnect.' });
    const result = await handleGetUsage({}, api, null, TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('UNAUTHORIZED');
  });
});

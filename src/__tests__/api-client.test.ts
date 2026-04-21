import axios from 'axios';
import { LbmApiClient, formatApiError } from '../api-client.js';
import { Logger } from '../logger.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const logger: Logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

let mockGet: jest.Mock;
let mockPost: jest.Mock;
let mockPatch: jest.Mock;
let mockDelete: jest.Mock;
let client: LbmApiClient;

beforeEach(() => {
  mockGet    = jest.fn();
  mockPost   = jest.fn();
  mockPatch  = jest.fn();
  mockDelete = jest.fn();
  mockedAxios.create.mockReturnValue({
    get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete,
    defaults: { baseURL: 'https://llmbrandmonitor.com/api/v1', headers: { Authorization: 'Bearer lbm_test' } },
  } as any);
  client = new LbmApiClient('https://llmbrandmonitor.com/api/v1', 'lbm_test', logger);
});

describe('LbmApiClient — success paths', () => {
  test('GET returns data', async () => {
    mockGet.mockResolvedValue({ data: { items: [{ id: '1' }] } });
    const result = await client.get('/projects');
    expect(result).toEqual({ items: [{ id: '1' }] });
    expect(mockGet).toHaveBeenCalledWith('/projects', { params: undefined });
  });

  test('GET passes params', async () => {
    mockGet.mockResolvedValue({ data: [] });
    await client.get('/projects', { page: 2, limit: 10 });
    expect(mockGet).toHaveBeenCalledWith('/projects', { params: { page: 2, limit: 10 } });
  });

  test('POST returns data', async () => {
    mockPost.mockResolvedValue({ data: { id: 'new-id' } });
    const result = await client.post('/projects', { name: 'Test' });
    expect(result).toEqual({ id: 'new-id' });
    expect(mockPost).toHaveBeenCalledWith('/projects', { name: 'Test' });
  });

  test('PATCH returns data', async () => {
    mockPatch.mockResolvedValue({ data: { id: '1', name: 'Updated' } });
    const result = await client.patch('/projects/1', { name: 'Updated' });
    expect(result).toEqual({ id: '1', name: 'Updated' });
  });

  test('DELETE returns data', async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });
    const result = await client.delete('/projects/1', { mode: 'archive' });
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith('/projects/1', { params: { mode: 'archive' } });
  });
});

describe('LbmApiClient — error mapping', () => {
  function makeAxiosError(status: number, data?: Record<string, unknown>) {
    const err = new Error('Request failed') as any;
    err.isAxiosError = true;
    err.response = { status, data: data ?? {} };
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);
    return err;
  }

  test('401 → UNAUTHORIZED', async () => {
    mockGet.mockRejectedValue(makeAxiosError(401));
    await expect(client.get('/projects')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('404 → NOT_FOUND', async () => {
    mockGet.mockRejectedValue(makeAxiosError(404));
    await expect(client.get('/projects/bad')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('402 → INSUFFICIENT_CREDITS', async () => {
    mockPost.mockRejectedValue(makeAxiosError(402));
    await expect(client.post('/scans')).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });

  test('429 → RATE_LIMITED', async () => {
    mockGet.mockRejectedValue(makeAxiosError(429));
    await expect(client.get('/projects')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  test('422 → VALIDATION_ERROR', async () => {
    mockPost.mockRejectedValue(makeAxiosError(422, { message: 'name is required' }));
    await expect(client.post('/projects', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'name is required',
    });
  });

  test('API body code INSUFFICIENT_CREDITS overrides status', async () => {
    mockPost.mockRejectedValue(makeAxiosError(400, { code: 'INSUFFICIENT_CREDITS', message: 'No credits' }));
    await expect(client.post('/scans')).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });

  test('unknown status → UNKNOWN', async () => {
    mockGet.mockRejectedValue(makeAxiosError(503));
    await expect(client.get('/projects')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  test('non-axios error → UNKNOWN', async () => {
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);
    mockGet.mockRejectedValue(new Error('Network error'));
    await expect(client.get('/projects')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  test('error includes hint', async () => {
    mockGet.mockRejectedValue(makeAxiosError(404));
    await expect(client.get('/projects/bad')).rejects.toMatchObject({
      hint: expect.stringContaining('lbm_list_projects'),
    });
  });
});

describe('formatApiError', () => {
  test('formats with hint', () => {
    const text = formatApiError({ code: 'NOT_FOUND', message: 'Project not found', hint: 'Check the ID.' });
    expect(text).toBe('API Error [NOT_FOUND]: Project not found. Check the ID.');
  });

  test('formats without hint', () => {
    const text = formatApiError({ code: 'UNKNOWN', message: 'Oops' });
    expect(text).toBe('API Error [UNKNOWN]: Oops.');
  });
});

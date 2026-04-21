import { csvEscape, formatResponse, FormatConfig } from '../format.js';

describe('csvEscape', () => {
  test('plain string unchanged', () => {
    expect(csvEscape('hello')).toBe('hello');
  });

  test('null/undefined → empty string', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  test('number → string', () => {
    expect(csvEscape(42)).toBe('42');
  });

  test('wraps commas in quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  test('escapes internal quotes', () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  test('wraps newlines in quotes', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  test('prefixes = with single quote', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)");
  });

  test('prefixes @ with single quote', () => {
    expect(csvEscape('@mention')).toBe("'@mention");
  });

  test('cyrillic text unchanged', () => {
    expect(csvEscape('Музей сучасного мистецтва')).toBe('Музей сучасного мистецтва');
  });

  test('cyrillic with comma gets quoted', () => {
    expect(csvEscape('Одеса, Україна')).toBe('"Одеса, Україна"');
  });
});

describe('formatResponse', () => {
  const config: FormatConfig = {
    arrayPath: 'data',
    fields: [
      { source: 'id', alias: 'id' },
      { source: 'name', alias: 'name' },
      { source: 'status', alias: 'status' },
    ],
  };

  test('returns full JSON when allFields=true', () => {
    const data = { success: true, data: [{ id: '1', name: 'Test', status: 'active', extra: 'field' }] };
    const result = formatResponse(data, config, true);
    expect(result).toContain('"extra": "field"');
    expect(result).toContain('"success": true');
  });

  test('returns CSV with header and rows', () => {
    const data = { data: [{ id: '1', name: 'Brand A', status: 'active' }] };
    const result = formatResponse(data, config, false);
    const lines = result.split('\n');
    expect(lines[0]).toBe('id,name,status');
    expect(lines[1]).toBe('1,Brand A,active');
  });

  test('filters out extra fields in CSV', () => {
    const data = { data: [{ id: '1', name: 'B', status: 'active', models: ['a', 'b'], prompts: [] }] };
    const result = formatResponse(data, config, false);
    expect(result).not.toContain('models');
    expect(result).not.toContain('prompts');
  });

  test('multiple rows', () => {
    const data = { data: [
      { id: '1', name: 'A', status: 'active' },
      { id: '2', name: 'B', status: 'archived' },
    ]};
    const result = formatResponse(data, config, false);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[2]).toBe('2,B,archived');
  });

  test('empty array returns "No data found."', () => {
    const data = { data: [] };
    expect(formatResponse(data, config, false)).toBe('No data found.');
  });

  test('missing arrayPath returns "No data found."', () => {
    const data = { items: [{ id: '1' }] };
    expect(formatResponse(data, config, false)).toBe('No data found.');
  });

  test('computed fields', () => {
    const configWithCompute: FormatConfig = {
      arrayPath: 'data',
      fields: [
        { source: 'name', alias: 'name' },
        { alias: 'count', compute: (item) => Array.isArray(item.items) ? item.items.length : 0 },
      ],
    };
    const data = { data: [{ name: 'X', items: ['a', 'b', 'c'] }] };
    const result = formatResponse(data, configWithCompute, false);
    expect(result).toBe('name,count\nX,3');
  });

  test('pagination footer when present', () => {
    const data = {
      data: [{ id: '1', name: 'A', status: 'ok' }],
      pagination: { total: 50, limit: 1, offset: 0, has_more: true },
    };
    const result = formatResponse(data, config, false);
    expect(result).toContain('# Showing 1 of 50');
    expect(result).toContain('next page');
  });

  test('pagination footer without has_more', () => {
    const data = {
      data: [{ id: '1', name: 'A', status: 'ok' }],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    };
    const result = formatResponse(data, config, false);
    expect(result).toContain('# Showing 1 of 1');
    expect(result).not.toContain('next page');
  });

  test('CSV escapes special characters', () => {
    const data = { data: [{ id: '1', name: 'Brand, "Best"', status: 'active' }] };
    const result = formatResponse(data, config, false);
    expect(result).toContain('"Brand, ""Best"""');
  });

  test('handles null/undefined field values', () => {
    const data = { data: [{ id: '1', name: null, status: undefined }] };
    const result = formatResponse(data, config, false);
    const lines = result.split('\n');
    expect(lines[1]).toBe('1,,');
  });
});

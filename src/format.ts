export interface FieldSpec {
  source?: string;
  alias: string;
  compute?: (item: Record<string, unknown>) => unknown;
}

export interface FormatConfig {
  fields: FieldSpec[];
  arrayPath: string;
}

/**
 * Escape a CSV value: wrap in quotes if it contains comma, quote, or newline.
 * Prefix '=' and '@' with single quote to prevent formula injection.
 * Copied from serpstat-mcp-v2 (production-proven).
 */
export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.startsWith('=') || s.startsWith('@')) {
    return "'" + s;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Format API response as compact CSV (default) or full JSON.
 *
 * @param data      Raw API response
 * @param config    Field definitions and array path
 * @param allFields If true, return full JSON; otherwise compact CSV
 * @param maxItems  Client-side truncation (for APIs that ignore limit param)
 */
export function formatResponse(
  data: unknown,
  config: FormatConfig,
  allFields: boolean,
  maxItems?: number,
): string {
  if (allFields) {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }

  const root = data as Record<string, unknown> | undefined;
  if (!root || typeof root !== 'object') {
    return JSON.stringify(data, null, 2);
  }

  // Extract array from response
  const rawItems = root[config.arrayPath];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return 'No data found.';
  }
  const totalCount = rawItems.length;
  const items = maxItems && maxItems < rawItems.length ? rawItems.slice(0, maxItems) : rawItems;

  // Build CSV header
  const header = config.fields.map(f => f.alias).join(',');

  // Build CSV rows
  const rows = items.map((item: unknown) => {
    if (!item || typeof item !== 'object') return '';
    const src = item as Record<string, unknown>;
    return config.fields
      .map(f => {
        const value = f.compute ? f.compute(src) : src[f.source!];
        return csvEscape(value);
      })
      .join(',');
  });

  // Footer: pagination info or truncation notice
  const pagination = root.pagination as Record<string, unknown> | undefined;
  let footer = '';
  if (pagination && typeof pagination.total === 'number') {
    footer = `\n# Showing ${items.length} of ${pagination.total}`;
    if (pagination.has_more) {
      footer += '. Use offset/page for next page.';
    }
  } else if (items.length < totalCount) {
    footer = `\n# Showing top ${items.length} of ${totalCount}. Pass higher limit for more.`;
  }

  return header + '\n' + rows.join('\n') + footer;
}

export interface ImportOptions {
  /** true => INSERT ... ON DUPLICATE KEY UPDATE; false => insert only. */
  upsert: boolean;
}

/**
 * Parse the multipart text fields (`mapping`, `options`) that ride alongside the
 * file. Both are optional JSON strings.
 */
export function parseMapping(raw?: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function parseOptions(raw?: string): ImportOptions {
  const defaults: ImportOptions = { upsert: true };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<ImportOptions>;
    return { upsert: parsed.upsert ?? true };
  } catch {
    return defaults;
  }
}

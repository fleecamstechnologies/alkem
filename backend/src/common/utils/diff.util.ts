export function diffFields<T extends Record<string, any>>(
  before: T,
  after: Partial<T>,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of Object.keys(after)) {
    const oldValue = before[key];
    const newValue = after[key];
    if (newValue !== undefined && oldValue !== newValue) {
      changes[key] = { old: oldValue, new: newValue };
    }
  }
  return changes;
}

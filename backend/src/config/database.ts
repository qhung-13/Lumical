export class DatabaseConfigurationError extends Error {
  constructor() {
    super('A valid PostgreSQL runtime DATABASE_URL is required.');
    this.name = 'DatabaseConfigurationError';
  }
}

export function runtimeDatabaseUrl(value: string | undefined): string {
  try {
    if (!value || value.includes('REPLACE'))
      throw new DatabaseConfigurationError();
    const url = new URL(value);
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      decodeURIComponent(url.username) !== 'lumical_runtime' ||
      !url.password ||
      !url.hostname ||
      !/^\/[^/]+$/.test(url.pathname) ||
      (url.searchParams.get('schema') ?? 'lumical') !== 'lumical'
    )
      throw new DatabaseConfigurationError();
    return value;
  } catch {
    throw new DatabaseConfigurationError();
  }
}

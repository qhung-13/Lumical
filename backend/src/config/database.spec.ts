import { DatabaseConfigurationError, runtimeDatabaseUrl } from './database';

describe('runtime database configuration', () => {
  it.each([
    undefined,
    '',
    'sqlite:test',
    'postgresql://lumical_migration:secret@localhost/db',
    'postgresql://lumical_runtime:REPLACE_PASSWORD@localhost/db',
    'postgresql://lumical_runtime:secret@localhost/db?schema=public',
  ])('rejects unsafe configuration with a redacted error (%s)', (value) => {
    expect(() => runtimeDatabaseUrl(value)).toThrow(
      new DatabaseConfigurationError(),
    );
  });
  it('accepts the dedicated runtime role and schema', () => {
    const value =
      'postgresql://lumical_runtime:local-test-only@localhost/lumical?schema=lumical';
    expect(runtimeDatabaseUrl(value)).toBe(value);
  });
});

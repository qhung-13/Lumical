// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('implements every approved semantic color pair exactly once', () => {
  const authority = readFileSync(new URL('../../../../docs/DESIGN_SYSTEM.md', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const pairs = [...authority.matchAll(/\| `color\.([\w-]+)` \| `(#[A-Fa-f0-9]+)` \| `(#[A-Fa-f0-9]+)`/g)];
  expect(pairs).toHaveLength(28);
  for (const [, role, light, dark] of pairs) {
    expect(css.match(new RegExp(`--color-${role}:`, 'g'))).toHaveLength(1);
    expect(css).toContain(`--color-${role}: light-dark(${light}, ${dark});`);
  }
});

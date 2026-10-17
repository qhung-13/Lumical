import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button } from './button';
import { FormField } from '../composites/form-field';

it('supports native keyboard activation and prevents repeat activation while loading or disabled', async () => {
  const user = userEvent.setup(); const action = vi.fn();
  const { rerender } = render(<Button onClick={action}>Check example</Button>);
  await user.tab(); expect(screen.getByRole('button')).toHaveFocus();
  await user.keyboard('{Enter} '); expect(action).toHaveBeenCalledTimes(2);
  rerender(<Button onClick={action} loading loadingLabel="Checking…">Check example</Button>);
  const busy = screen.getByRole('button', { name: 'Checking…' });
  expect(busy).toBeDisabled(); expect(busy).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Checking…');
  expect(screen.getByRole('status').closest('[aria-busy="true"]')).toBeNull();
  await user.click(busy); expect(action).toHaveBeenCalledTimes(2);
  rerender(<Button onClick={action} disabled>Unavailable</Button>);
  await user.click(screen.getByRole('button')); expect(action).toHaveBeenCalledTimes(2);
});

it('retains a stable label/help/error relationship and accepts typing without transforming text', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<FormField label="Example" requirementLabel="required" description="Use any text" required />);
  const input = screen.getByRole('textbox'); const id = input.id;
  expect(input).toHaveAccessibleName('Example (required)'); expect(input).toBeRequired();
  expect(input).toHaveAccessibleDescription('Use any text');
  await user.type(input, '  Ký ức e\u0301  '); expect(input).toHaveValue('  Ký ức e\u0301  ');
  rerender(<FormField label="Example" requirementLabel="required" description="Use any text" error="Enter example text" required />);
  expect(input.id).toBe(id); expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Use any text Enter example text');
  expect(input).toHaveAttribute('aria-errormessage', `${id}-error`);
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
import { Button } from '../primitives/button';

// JSDOM has no native top-layer/modality. These shims exercise component events;
// Playwright separately verifies real focus containment and inert background.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
function Example({ action, dismissible = true }: { action: () => void; dismissible?: boolean }) {
  return <Dialog triggerLabel="Review clearing" title="Clear example?" description="Only temporary text changes."
    cancelLabel="Cancel" confirmLabel="Clear example" onConfirm={action} destructive dismissible={dismissible}>
    <div style={{ display: 'none' }}><Button>Hidden action</Button></div>
    <Button disabled>Unavailable action</Button><Button tabIndex={-1}>Outside tab order</Button>
    <label>Optional note<input /></label>
  </Dialog>;
}
it('enters on Cancel, cycles focus, ignores unrelated Enter and backdrop clicks, and restores its trigger', async () => {
  const action = vi.fn(); const user = userEvent.setup(); render(<Example action={action} />);
  const trigger = screen.getByRole('button', { name: 'Review clearing' });
  await user.click(trigger); const dialog = screen.getByRole('dialog', { name: 'Clear example?' });
  expect(dialog).toHaveAccessibleDescription('Only temporary text changes.');
  const cancel = screen.getByRole('button', { name: 'Cancel' }); expect(cancel).toHaveFocus();
  await user.tab(); expect(screen.getByRole('button', { name: 'Clear example' })).toHaveFocus();
  await user.tab(); expect(screen.getByRole('textbox')).toHaveFocus();
  await user.keyboard('{Enter}'); fireEvent.click(dialog); expect(action).not.toHaveBeenCalled();
  await user.click(cancel); expect(trigger).toHaveFocus(); expect(dialog).not.toHaveAttribute('open');
  await user.click(trigger); fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(trigger).toHaveFocus(); expect(action).not.toHaveBeenCalled();
  await user.click(trigger); await user.click(screen.getByRole('button', { name: 'Clear example' }));
  expect(action).toHaveBeenCalledTimes(1); expect(trigger).toHaveFocus();
});
it('keeps Escape from dismissing when disabled while retaining an explicit safe Cancel', async () => {
  const user = userEvent.setup(); render(<Example action={vi.fn()} dismissible={false} />);
  await user.click(screen.getByRole('button', { name: 'Review clearing' }));
  const dialog = screen.getByRole('dialog'); fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toHaveAttribute('open'); await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(dialog).not.toHaveAttribute('open');
});

it('preserves multiline editing, link activation and descendant keyboard handling while blocking implicit confirmation', async () => {
  const user = userEvent.setup(); const action = vi.fn(); const link = vi.fn(event => event.preventDefault());
  render(<Dialog triggerLabel="Open" title="Review" description="Temporary text" cancelLabel="Cancel" confirmLabel="Clear" destructive onConfirm={action}>
    <label>Notes<textarea /></label><a href="#help" onClick={link}>Help</a>
    <input aria-label="Single line" />
    <button onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); }}>Local keyboard control</button>
  </Dialog>);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  await user.type(screen.getByLabelText('Notes'), 'First{Enter}Second');
  expect(screen.getByLabelText('Notes')).toHaveValue('First\nSecond');
  screen.getByRole('link').focus(); await user.keyboard('{Enter}'); expect(link).toHaveBeenCalledOnce();
  const single = screen.getByLabelText('Single line'); single.focus();
  expect(fireEvent.keyDown(single, { key: 'Enter' })).toBe(false); expect(action).not.toHaveBeenCalled();
  const local = screen.getByRole('button', { name: 'Local keyboard control' }); local.focus();
  await user.tab(); expect(local).toHaveFocus();
});

it('isolates nested Dialog events and ignores an earlier close event after reopening in Strict Mode', async () => {
  const user = userEvent.setup();
  const example = <StrictMode><Dialog triggerLabel="Open outer" title="Outer" description="Outer content" cancelLabel="Cancel outer">
    <Dialog triggerLabel="Open inner" title="Inner" description="Inner content" cancelLabel="Cancel inner" confirmLabel="Confirm inner" />
  </Dialog></StrictMode>;
  const { rerender, unmount } = render(example);
  const trigger = screen.getByRole('button', { name: 'Open outer' }); await user.click(trigger);
  const outer = screen.getByRole('dialog', { name: 'Outer' });
  await user.click(screen.getByRole('button', { name: 'Open inner' }));
  const inner = screen.getByRole('dialog', { name: 'Inner' });
  await user.tab(); expect(within(inner).getByRole('button', { name: 'Confirm inner' })).toHaveFocus();
  fireEvent(inner, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(inner).not.toHaveAttribute('open'); expect(outer).toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Open inner' })).toHaveFocus();
  rerender(example); fireEvent(outer, new Event('close'));
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Open inner' })).toHaveFocus();
  unmount(); expect(document.querySelector('dialog')).toBeNull();
});

it('keeps a native radio group at one Tab stop and refreshes disabled actions on rerender', async () => {
  const user = userEvent.setup();
  function Example({ disabled }: { disabled: boolean }) {
    return <Dialog triggerLabel="Open" title="Choose" description="Native choices" cancelLabel="Cancel" confirmLabel="Confirm">
      <fieldset><legend>Choice</legend><label><input type="radio" name="choice" defaultChecked />First</label><label><input type="radio" name="choice" />Second</label></fieldset>
      <details><summary tabIndex={-1}>Collapsed help</summary><input aria-label="Hidden detail" /></details>
      <Button disabled={disabled}>Extra</Button>
    </Dialog>;
  }
  const { rerender } = render(<Example disabled={false} />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  await user.tab(); await user.tab(); expect(screen.getByLabelText('First')).toHaveFocus();
  await user.tab(); expect(screen.getByRole('button', { name: 'Extra' })).toHaveFocus();
  rerender(<Example disabled />); screen.getByLabelText('First').focus();
  await user.tab(); expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.tab({ shift: true }); expect(screen.getByLabelText('First')).toHaveFocus();
});

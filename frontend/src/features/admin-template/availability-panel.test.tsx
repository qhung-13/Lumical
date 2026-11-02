import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminTemplateData } from '../../api/admin-templates';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { AvailabilityPanel } from './availability-panel';

// JSDOM has no top-layer modality (same shims as dialog.test.tsx).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

const template: AdminTemplateData = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'GENERAL',
  availability: 'INACTIVE',
  version: 3,
  currentPublishedRevisionId: '22222222-2222-4222-8222-222222222222',
  publishedRevision: 1,
};

function renderPanel(props: Partial<Parameters<typeof AvailabilityPanel>[0]> = {}) {
  const onSetAvailability = props.onSetAvailability ?? vi.fn();
  const onRefreshVersion = props.onRefreshVersion ?? vi.fn();
  const view = render(
    <PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
      <AvailabilityPanel template={template} onSetAvailability={onSetAvailability} onRefreshVersion={onRefreshVersion} {...props} />
    </PreferencesProvider>,
  );
  return { ...view, onSetAvailability, onRefreshVersion };
}

describe('availability control (F4)', () => {
  it('shows the current state and disables the action that is already active', () => {
    renderPanel();
    expect(screen.getByText('Inactive')).toBeVisible();
    expect(screen.getByTestId('availability-inactive')).toBeDisabled();
    expect(screen.getByTestId('availability-active')).toBeEnabled();
    expect(screen.getByTestId('availability-archived')).toBeEnabled();
  });

  it('requires a reason of 1..1000 before sending', async () => {
    const user = userEvent.setup();
    const { onSetAvailability } = renderPanel();
    await user.click(screen.getByTestId('availability-active'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('New projects will be able to start from this template.');
    await user.click(screen.getByTestId('availability-confirm'));
    expect(await screen.findByText(/Enter a reason of 1 to 1000 characters/)).toBeVisible();
    expect(onSetAvailability).not.toHaveBeenCalled();
    const reason = screen.getByLabelText(/Reason/);
    await user.type(reason, 'Checked the public catalog impact');
    await user.click(screen.getByTestId('availability-confirm'));
    expect(onSetAvailability).toHaveBeenCalledWith('ACTIVE', 'Checked the public catalog impact');
  });

  it('keeps the typed reason when a 412 conflict banner appears (F5)', async () => {
    const user = userEvent.setup();
    const { rerender, onRefreshVersion } = renderPanel();
    await user.click(screen.getByTestId('availability-active'));
    await user.type(screen.getByLabelText(/Reason/), 'audit reason');
    rerender(
      <PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
        <AvailabilityPanel template={template} conflictVersion={7} onSetAvailability={vi.fn()} onRefreshVersion={onRefreshVersion} />
      </PreferencesProvider>,
    );
    expect(await screen.findByTestId('conflict-banner')).toBeVisible();
    expect(screen.getByText(/Current version is 7/)).toBeVisible();
    expect(screen.getByLabelText(/Reason/)).toHaveValue('audit reason');
    // Only the two conscious choices — no auto-resend button exists.
    expect(screen.getByTestId('conflict-refresh')).toBeVisible();
    expect(screen.getByTestId('conflict-close')).toBeVisible();
    fireEvent.click(screen.getByTestId('conflict-refresh'));
    expect(onRefreshVersion).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape without sending anything', async () => {
    const user = userEvent.setup();
    const { onSetAvailability } = renderPanel();
    await user.click(screen.getByTestId('availability-active'));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSetAvailability).not.toHaveBeenCalled();
  });

  it('states the ARCHIVED consequence before committing', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByTestId('availability-archived'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('This template leaves the active catalog.');
    expect(dialog).toHaveTextContent('Recorded in the audit trail for this action.');
  });
});

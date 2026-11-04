import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { RevisionForm, parseUsdMinor, toRevisionBody, toRevisionDraft, validateRevision, initialRevisionState } from './revision-form';

// JSDOM has no top-layer modality (same shims as dialog.test.tsx); Playwright
// verifies real focus containment and inert background.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

function renderForm(props: Partial<Parameters<typeof RevisionForm>[0]> = {}, locale: 'en' | 'vi' = 'en') {
  const onSubmit = props.onSubmit ?? vi.fn();
  const view = render(
    <PreferencesProvider initial={{ locale, theme: 'light' }}>
      <RevisionForm mode="create" onSubmit={onSubmit} {...props} />
    </PreferencesProvider>,
  );
  return { ...view, onSubmit };
}

const fillValidDraft = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', { name: 'Birthday' }));
  await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Ngày vui');
  await user.type(screen.getByLabelText(/Name — English/), 'Bright day');
  await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô tả sinh nhật');
  await user.type(screen.getByLabelText(/Description — English/), 'Birthday description');
  await user.click(screen.getByRole('checkbox', { name: 'Classic' }));
  await user.type(screen.getByLabelText(/Base unit price/), '24.00');
};

describe('revision form validation (client mirror of contract §17)', () => {
  it('reports every empty required field and focuses the first invalid control', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Review new template' }));
    expect(await screen.findByTestId('form-error-summary')).toBeVisible();
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Choose at least one preset.').length).toBeGreaterThan(1);
    expect(screen.getAllByText(/Enter a positive USD amount/).length).toBeGreaterThan(1);
    expect(screen.getByRole('radio', { name: 'General' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('accepts a complete draft and shows the review dialog with exactly what will be sent', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fillValidDraft(user);
    await user.click(screen.getByRole('button', { name: 'Review new template' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Birthday');
    expect(dialog).toHaveTextContent('Ngày vui / Bright day');
    expect(dialog).toHaveTextContent('Classic');
    expect(dialog).toHaveTextContent('24.00 USD → 2400');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('review-confirm'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed prices before review', () => {
    const state = { ...initialRevisionState(), price: '12.345' };
    expect(parseUsdMinor('12.345')).toBeNull();
    expect(parseUsdMinor('0.00')).toBeNull();
    expect(parseUsdMinor('24')).toBe(2400);
    expect(parseUsdMinor('24.5')).toBe(2450);
    expect(validateRevision(state, 'en', 'create').price).toMatch(/positive USD amount/);
  });

  it('builds a revision body with only the five accepted keys (no category/reason leakage)', () => {
    const state = { ...initialRevisionState(), category: 'BIRTHDAY' as const, nameVi: ' A ', nameEn: 'B', descVi: 'C', descEn: 'D', presets: ['classic' as const], price: '10.00', reason: 'why' };
    const draft = toRevisionDraft(state);
    expect(Object.keys(toRevisionBody(draft)).sort()).toEqual(['description', 'layout', 'name', 'presets', 'price']);
    expect(draft.layout).toEqual({ version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 });
    expect(draft.price.unitPriceMinor).toBe(1000);
    expect(draft.name.vi).toBe('A');
  });

  it('mirrors the 500-character limit and keeps the optional reason within 1000', () => {
    const long = 'x'.repeat(501);
    const state = { ...initialRevisionState(), nameVi: long, reason: 'y'.repeat(1001) };
    const errors = validateRevision(state, 'en', 'create');
    expect(errors['name.vi']).toMatch(/1 to 500/);
    expect(errors.reason).toMatch(/1 to 1000/);
  });
});

describe('server field errors and data retention (F6/F7)', () => {
  it('renders 422 fieldErrors under the matching field and clears them as the user edits', async () => {
    const user = userEvent.setup();
    const fieldErrors = [{ path: 'price.unitPriceMinor', messageKey: 'validation.price.unitPriceMinor' }];
    renderForm({ fieldErrors });
    expect((await screen.findAllByText(/Enter a positive USD amount/)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('form-error-summary')).toBeVisible();
    const price = screen.getByLabelText(/Base unit price/);
    await user.type(price, '5');
    expect(screen.queryByTestId('form-error-summary')).not.toBeInTheDocument();
  });

  it('keeps every entered value when a submission fails recoverably (F7)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
      <RevisionForm mode="create" onSubmit={onSubmit} />
    </PreferencesProvider>);
    await fillValidDraft(user);
    // Simulate a recoverable failure: parent re-renders with the same form mounted.
    rerender(<PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
      <RevisionForm mode="create" onSubmit={onSubmit} fieldErrors={[{ path: 'name.vi', messageKey: 'validation.name.vi' }]} />
    </PreferencesProvider>);
    expect(screen.getByLabelText(/Name — Vietnamese/)).toHaveValue('Ngày vui');
    expect(screen.getByLabelText(/Base unit price/)).toHaveValue('24.00');
    expect(screen.getByRole('checkbox', { name: 'Classic' })).toBeChecked();
    expect(screen.getAllByText(/Name \(Tiếng Việt\): Use 1 to 500 characters/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Review new template' }));
    await user.click(await screen.findByTestId('review-confirm'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the conflict banner as a notice without resending anything (F5)', () => {
    renderForm({ notice: <div data-testid="conflict-banner" /> });
    expect(screen.getByTestId('conflict-banner')).toBeVisible();
    expect(screen.getByTestId('review-submit')).toBeEnabled();
  });
});

describe('review dialog keyboard behaviour', () => {
  it('closes on Escape without submitting and returns to the form', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fillValidDraft(user);
    await user.click(screen.getByRole('button', { name: 'Review new template' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('review-submit')).toBeInTheDocument();
  });

  it('traps Tab inside the review dialog', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValidDraft(user);
    await user.click(screen.getByRole('button', { name: 'Review new template' }));
    await screen.findByRole('dialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByTestId('review-confirm');
    cancel.focus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });
});

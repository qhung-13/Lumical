import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { PreferencesProvider } from './preferences-provider';
import { presentationPreferences, preferenceCookie } from './preferences';
import { FoundationPage } from '../examples/foundation-page';

afterEach(() => { document.cookie = 'lumical_locale=; Max-Age=0'; document.cookie = 'lumical_theme=; Max-Age=0'; });
it('defaults safely and accepts only presentation enums into preference cookies', () => {
  expect(presentationPreferences('untrusted', 'untrusted')).toEqual({ locale: 'en', theme: 'system' });
  expect(presentationPreferences('vi', 'dark')).toEqual({ locale: 'vi', theme: 'dark' });
  expect(() => preferenceCookie('lumical_theme', 'vi')).toThrow();
});
it('switches language and theme explicitly with the same navigation destinations and no secret storage', () => {
  render(<PreferencesProvider><FoundationPage area="public" /></PreferencesProvider>);
  const destinations = () => [...screen.getByRole('navigation', { name: /navigation|Điều hướng/ }).querySelectorAll('a')].map(link => link.getAttribute('href'));
  const original = destinations();
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
  expect(document.documentElement.lang).toBe('vi'); expect(destinations()).toEqual(original);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dành chỗ cho từng chi tiết ý nghĩa');
  fireEvent.change(screen.getByLabelText('Giao diện'), { target: { value: 'dark' } });
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(document.cookie.split('; ').sort()).toEqual(['lumical_locale=vi', 'lumical_theme=dark']);
  expect(localStorage.length).toBe(0);
});

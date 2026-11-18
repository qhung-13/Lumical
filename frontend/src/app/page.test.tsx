import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import PublicFoundationPage from './foundation/public/page';
import { PreferencesProvider } from '../design-system/foundations/preferences-provider';

test("the foundation page offers a same-origin backend health check", () => {
  render(<PreferencesProvider><PublicFoundationPage /></PreferencesProvider>);

  expect(
    screen.getByRole("heading", { level: 1, name: "Room for meaningful details" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Check backend health" }),
  ).toHaveAttribute("href", "/api/v1/health");
  expect(screen.getByRole("link", { name: "Browse calendar designs" })).toHaveAttribute("href", "/templates");
  expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/foundation/public');
});

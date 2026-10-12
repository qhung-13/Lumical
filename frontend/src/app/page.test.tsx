import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("the foundation page offers a same-origin backend health check", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "LumiCal" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Check backend health" }),
  ).toHaveAttribute("href", "/api/v1/health");
});

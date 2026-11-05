import { test, expect } from "@playwright/test";
test("navigation, appearance, persistent settings, protected administration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Corelum." }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../outputs/Corelum-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "dark", exact: true }).click();
  await page
    .getByRole("switch", { name: "Automatic checks", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Automatic checks", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await page
    .getByRole("button", { name: "Administrator sign-in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administrator sign-in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Connect your deployment service", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("fits the minimum window size", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Corelum." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

import { test, expect, type Page } from "@playwright/test";
const account = {
  id: "test-admin",
  username: "administrator",
  role: "admin",
  maintenance: false,
  update: null,
};
async function session(page: Page, value = account) {
  await page.route("**/me", (r) => r.fulfill({ json: value }));
  await page.route("**/network/status*", (r) => r.fulfill({ json: value }));
  await page.route("**/policy", (r) =>
    r.fulfill({ json: { auto_publish: 0, maintenance: 0 } }),
  );
  for (const path of ["deployments", "releases"])
    await page.route("**/" + path, (r) => r.fulfill({ json: [] }));
  await page.route("**/source*", (r) =>
    r.fulfill({ json: { baseCommit: "a".repeat(40) } }),
  );
}
test("anonymous pages require sign-in", async ({ page }) => {
  await page.route("**/me", (r) =>
    r.fulfill({ status: 401, json: { error: "Sign-in required" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("administrator navigation, accents, appearance and conversations persist", async ({
  page,
}) => {
  await session(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Accent #70cbb2", exact: true })
    .click();
  await page.getByRole("button", { name: "light", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    ),
  ).toBe("#70cbb2");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.route("**/chat", (r) =>
    r.fulfill({ json: { reply: "Here is a practical plan for your day." } }),
  );
  await page
    .getByLabel("Message Corelum AI", { exact: true })
    .fill("Help me plan my day");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Here is a practical plan for your day.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByText("Here is a practical plan for your day.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("regular accounts have no development pages", async ({ page }) => {
  await session(page, { ...account, role: "user", username: "member" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Workspace", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Development Studio", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Workspace", exact: true }),
  ).toHaveCount(1);
});
test("maintenance blocks regular accounts", async ({ page }) => {
  await session(page, { ...account, role: "user", maintenance: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Under maintenance", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("administrators retain access during maintenance", async ({ page }) => {
  await session(page, { ...account, maintenance: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Development Studio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Development Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Maintenance mode", exact: true }),
  ).toBeVisible();
});
test("layout fits the minimum window width", async ({ page }) => {
  await session(page);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

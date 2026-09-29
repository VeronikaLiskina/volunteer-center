import { expect, test } from "@playwright/test";

test("forgot password explains coordinator recovery without sending SMS", async ({ page }) => {
  const recoveryRequests: string[] = [];
  await page.route("**/api/v1/auth/password-reset/**", (route) => {
    recoveryRequests.push(route.request().url());
    return route.fulfill({ status: 404 });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Забыли пароль" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Восстановление пароля" })).toBeVisible();
  await expect(page.getByText("Для восстановления доступа обратитесь к координатору центра.")).toBeVisible();
  await expect(page.locator("input, form")).toHaveCount(0);
  await page.getByRole("link", { name: "Вернуться ко входу" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(recoveryRequests).toEqual([]);
});

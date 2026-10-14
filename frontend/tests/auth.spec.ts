import { expect, test } from "@playwright/test";
import { mockAuth } from "./auth-helper";

test("login protects pages, handles invalid credentials, and logs out", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/login$/);
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({ status: 401, json: { detail: "Неверный номер телефона или пароль" } }));
  await page.getByLabel("Номер телефона", { exact: true }).fill("8 (999) 000-00-01");
  await page.getByLabel("Пароль", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Неверный номер телефона или пароль");
  const user = { id: 1, phone: "+79990000001", full_name: "Лискина Вероника Ивановна", role: "COORDINATOR", is_active: true, volunteer_id: null };
  await page.route("**/api/v1/auth/login", (route) => {
    expect(route.request().postDataJSON()).toEqual({ phone: "+79990000001", password: "invalid-password" });
    return route.fulfill({ json: { access_token: "valid-token", token_type: "bearer", user } });
  });
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/v1/notifications?*", (route) => route.fulfill({ json: { items: [], unread_count: 0 } }));
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".header__full-name")).toHaveText("Лискина Вероника Ивановна");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".header__full-name")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("link", { name: "Аналитика и отчёты", exact: true })).toBeVisible();
  await page.route("**/api/v1/auth/logout", (route) => {
    expect(route.request().headers().authorization).toBe("Bearer valid-token");
    return route.fulfill({ status: 204 });
  });
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("lapka-token"))).toBeNull();
});

test("volunteer sees own work and real notification controls", async ({ page }) => {
  await mockAuth(page, "VOLUNTEER");
  await page.route("**/api/v1/care-procedures**", (route) => route.fulfill({ json: route.request().url().endsWith("summary") ? { today_total: 0, today_completed: 0 } : [] }));
  let read = false;
  await page.route("**/api/v1/notifications?*", (route) => route.fulfill({ json: { unread_count: read ? 0 : 1, items: [{
    id: 1, procedure_id: 1, kind: "assigned", message: "Назначена услуга ухода", is_read: read, created_at: "2026-09-14T10:00:00Z",
  }] } }));
  await page.route("**/api/v1/notifications/1/read", (route) => { read = true; return route.fulfill({ status: 204 }); });
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByRole("heading", { name: "Мои услуги" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Назначить услугу", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Волонтёры", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Уведомления/ }).click();
  await expect(page.getByText("Назначена услуга ухода")).toBeVisible();
  await page.getByRole("button", { name: "Прочитано", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Уведомления (0)" })).toBeVisible();
  await page.goto("/animals/dictionaries");
  await expect(page).toHaveURL(/\/procedures$/);
});

test("expired API token clears the session", async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 401, json: { detail: "Сессия истекла" } }));
  await page.goto("/animals");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("lapka-token"))).toBeNull();
});

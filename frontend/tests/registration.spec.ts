import { expect, test } from "@playwright/test";
import { mockAuth } from "./auth-helper";

test("self registration validates confirmation, preserves name, and waits for approval", async ({ page }, testInfo) => {
  let submitted: Record<string, string> | undefined;
  await page.route("**/api/v1/auth/register", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { message: "Заявка отправлена" } });
  });
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({ status: 403, json: { detail: "Заявка ожидает подтверждения координатором." } }));
  await page.goto("/login");
  await page.getByRole("link", { name: "Зарегистрироваться" }).click();
  await page.getByLabel("ФИО", { exact: true }).fill("Лискина Вероника Ивановна");
  await page.getByLabel("Номер телефона").fill("89025781290");
  await page.getByLabel("Пароль", { exact: true }).fill("registration-password");
  await page.getByLabel("Повторите пароль").fill("different-password");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("alert")).toHaveText("Пароли не совпадают");
  expect(submitted).toBeUndefined();
  await page.getByLabel("Повторите пароль").fill("registration-password");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("registration-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("heading", { name: "Заявка отправлена" })).toBeVisible();
  expect(submitted).toEqual({ full_name: "Лискина Вероника Ивановна", phone: "+79025781290", password: "registration-password" });
  expect(await page.evaluate(() => sessionStorage.getItem("lapka-token"))).toBeNull();
  await page.getByRole("link", { name: "Перейти ко входу" }).click();
  await page.getByLabel("Номер телефона").fill("89025781290");
  await page.getByLabel("Пароль", { exact: true }).fill("registration-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ожидает подтверждения");
  await page.goto("/registrations");
  await expect(page).toHaveURL(/\/login$/);
});

test("registration displays duplicate phone error and allows correction", async ({ page }) => {
  await page.route("**/api/v1/auth/register", (route) => route.fulfill({ status: 409, json: { detail: "Этот номер телефона уже зарегистрирован." } }));
  await page.goto("/register");
  await page.getByLabel("ФИО", { exact: true }).fill("Иванова Анна");
  await page.getByLabel("Номер телефона").fill("89991234567");
  await page.getByLabel("Пароль", { exact: true }).fill("registration-password");
  await page.getByLabel("Повторите пароль").fill("registration-password");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("alert")).toContainText("уже зарегистрирован");
  await expect(page.getByLabel("ФИО", { exact: true })).toHaveValue("Иванова Анна");
  await expect(page.getByRole("button", { name: "Отправить заявку" })).toBeEnabled();
});

test("coordinator reviews applications and views history on mobile", async ({ page }, testInfo) => {
  await mockAuth(page);
  const items = [
    { id: 10, full_name: "Лискина Вероника Ивановна", phone: "+79025781290", role: null as string | null, registration_status: "pending", created_at: "2026-09-16T10:00:00Z", reviewed_at: null },
    { id: 11, full_name: "Иванова Анна", phone: "+79025781291", role: null as string | null, registration_status: "pending", created_at: "2026-09-16T10:00:00Z", reviewed_at: null },
  ];
  await page.route("**/api/v1/registrations?*", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    return route.fulfill({ json: items.filter((item) => item.registration_status === status) });
  });
  await page.route(/\/api\/v1\/registrations\/\d+\/(approve|reject)$/, (route) => {
    const url = new URL(route.request().url());
    const item = items.find((item) => url.pathname.includes(`/${item.id}/`))!;
    item.registration_status = url.pathname.endsWith("approve") ? "approved" : "rejected";
    item.role = item.registration_status === "approved" ? route.request().postDataJSON().role : null;
    return route.fulfill({ json: item });
  });
  await page.goto("/registrations");
  await expect(page.getByRole("heading", { name: "Заявки на регистрацию" })).toBeVisible();
  const first = page.getByRole("article", { name: "Лискина Вероника Ивановна" });
  await expect(first.getByLabel("Назначить роль")).toHaveValue("VOLUNTEER");
  await first.getByLabel("Назначить роль").selectOption("COORDINATOR");
  await expect(first).toContainText("Полный доступ");
  await page.screenshot({ path: testInfo.outputPath("registrations-desktop.png"), fullPage: true });
  await first.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Заявка подтверждена" })).toContainText("Координатор");
  await expect(first).toHaveCount(0);
  await page.getByRole("article", { name: "Иванова Анна" }).getByRole("button", { name: "Отклонить" }).click();
  await expect(page.getByText("Заявок с этим статусом нет.")).toBeVisible();
  await page.getByLabel("Статус заявок").selectOption("approved");
  await expect(page.getByText("Роль: Координатор")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("registrations-mobile.png"), fullPage: true });
  await page.getByLabel("Статус заявок").selectOption("rejected");
  await expect(page.getByRole("article", { name: "Иванова Анна" })).toContainText("Заявка отклонена");
});

test("volunteer cannot open coordinator applications", async ({ page }) => {
  await mockAuth(page, "VOLUNTEER");
  await page.route("**/api/v1/care-procedures**", (route) => route.fulfill({ json: [] }));
  await page.goto("/registrations");
  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByRole("link", { name: "Заявки", exact: true })).toHaveCount(0);
});

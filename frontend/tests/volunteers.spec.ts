import { expect, test } from "@playwright/test";
import { mockAuth } from "./auth-helper";
import { VolunteerStatus, type Volunteer, type VolunteerCreate } from "../src/types/volunteer";

test.beforeEach(async ({ page }) => {
  let volunteers: Volunteer[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/health") return route.fulfill({ json: { status: "ok", database: "connected" } });
    if (path === "/animals/summary") return route.fulfill({ json: { total: 0, in_care: 0, archived: 0 } });
    if (path === "/volunteers/summary") return route.fulfill({ json: {
      total: volunteers.length,
      active: volunteers.filter((volunteer) => volunteer.status === VolunteerStatus.Active).length,
      inactive: volunteers.filter((volunteer) => volunteer.status === VolunteerStatus.Inactive).length,
    } });
    if (path === "/volunteers/active") return route.fulfill({ json:
      volunteers.filter((volunteer) => volunteer.status === VolunteerStatus.Active) });
    if (path === "/volunteers" && method === "GET") {
      const search = url.searchParams.get("search")?.toLocaleLowerCase("ru-RU");
      const status = url.searchParams.get("status");
      const found = volunteers.filter((volunteer) => (!search || volunteer.full_name.toLocaleLowerCase("ru-RU").includes(search))
        && (!status || volunteer.status === status));
      return route.fulfill({ json: found });
    }
    if (path === "/volunteers" && method === "POST") {
      const data = request.postDataJSON() as VolunteerCreate;
      const digits = data.phone.replace(/\D/g, "");
      const volunteer: Volunteer = { ...data, id: volunteers.length + 1,
        phone: `+7${digits.slice(1)}`, status: VolunteerStatus.Active };
      volunteers = [volunteer, ...volunteers];
      return route.fulfill({ status: 201, json: volunteer });
    }
    const id = Number(path.split("/")[2]);
    const volunteer = volunteers.find((item) => item.id === id);
    if (!volunteer) return route.fulfill({ status: 404, json: { detail: { message: "Волонтёр не найден" } } });
    if (path.endsWith("/deactivation-assignments")) return route.fulfill({ json: [] });
    if (path.endsWith("/deactivate")) volunteer.status = VolunteerStatus.Inactive;
    else if (path.endsWith("/activate")) volunteer.status = VolunteerStatus.Active;
    else if (method === "PATCH") Object.assign(volunteer, request.postDataJSON());
    return route.fulfill({ json: volunteer });
  });
  await mockAuth(page);
});

test("volunteer creation, editing, deactivation, activation and filtering", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Волонтёры", exact: true }).click();
  await expect(page).toHaveURL(/\/volunteers$/);
  await expect(page.getByText("Волонтёры не найдены", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Добавить волонтёра/ }).click();
  await expect(page).toHaveURL(/\/volunteers\/new$/);
  await page.getByRole("button", { name: "Добавить волонтёра" }).click();
  await expect(page.getByText("Введите ФИО", { exact: true })).toBeVisible();
  await expect(page.getByText("Введите телефон", { exact: true })).toBeVisible();
  await page.locator("#volunteer-full_name").fill("Иванова Анна Сергеевна");
  await page.locator("#volunteer-phone").fill("123");
  await page.getByRole("button", { name: "Добавить волонтёра" }).click();
  await expect(page.locator("#volunteer-phone-error")).toContainText("Используйте формат");
  await page.locator("#volunteer-phone").fill("+7 (999) 123-45-67");
  await page.locator("#volunteer-note").fill("Помогает по выходным");
  await page.getByRole("button", { name: "Добавить волонтёра" }).click();
  await expect(page).toHaveURL(/\/volunteers$/);
  await expect(page.getByText("Волонтёр «Иванова Анна Сергеевна» добавлен", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Иванова Анна Сергеевна", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+7 (999) 123-45-67", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Изменить карточку Иванова Анна Сергеевна" }).click();
  await expect(page).toHaveURL(/\/volunteers\/1\/edit$/);
  await page.locator("#volunteer-note").fill("Координатор выходного дня");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page).toHaveURL(/\/volunteers$/);
  await expect(page.getByRole("cell", { name: "Координатор выходного дня", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Деактивировать Иванова Анна Сергеевна" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Отмена" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Деактивировать Иванова Анна Сергеевна" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Деактивировать", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Неактивен", exact: true })).toBeVisible();
  await page.getByLabel("Статус").selectOption("inactive");
  await expect(page.getByRole("cell", { name: "Иванова Анна Сергеевна", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Активировать Иванова Анна Сергеевна" }).click();
  await expect(page.getByText("Иванова Анна Сергеевна снова активен", { exact: true })).toBeVisible();
  await expect(page.getByText("Волонтёры не найдены", { exact: true })).toBeVisible();
  await page.getByLabel("Статус").selectOption("active");
  await expect(page.getByRole("cell", { name: "Активен", exact: true })).toBeVisible();
  await expect(page.getByText("На странице: 1", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("volunteers-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("volunteers-mobile.png"), fullPage: true });
});

test("volunteer list retry, server field error and invalid card URL", async ({ page }) => {
  let failList = true;
  await page.route("**/api/v1/volunteers?*", (route) => route.fulfill(failList
    ? { status: 503, json: { detail: "Сервис волонтёров временно недоступен" } }
    : { json: [] }));
  await page.goto("/volunteers");
  await expect(page.getByRole("alert")).toContainText("Сервис волонтёров временно недоступен");
  failList = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Волонтёры не найдены", { exact: true })).toBeVisible();

  await page.route("**/api/v1/volunteers", (route) => route.fulfill({ status: 422,
    json: { detail: { message: "Телефон уже используется", field: "phone" } } }));
  await page.goto("/volunteers/new");
  await page.locator("#volunteer-full_name").fill("Петров Пётр");
  await page.locator("#volunteer-phone").fill("89991234567");
  await page.getByRole("button", { name: "Добавить волонтёра" }).click();
  await expect(page.locator("#volunteer-phone-error")).toHaveText("Телефон уже используется");

  await page.goto("/volunteers/abc/edit");
  await expect(page.getByRole("alert")).toContainText("Некорректный номер карточки");
  await expect(page.locator("#volunteer-full_name")).toHaveCount(0);
});

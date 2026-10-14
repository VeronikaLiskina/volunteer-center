import { expect, test, type Page } from "@playwright/test";
import { mockAuth } from "./auth-helper";

const volunteer = { id: 1, full_name: "Иван Иванов", phone: "+79991234567", status: "active", note: "После обеда", available_from: "14:00:00", available_to: "18:00:00" };
const candidate = { ...volunteer, id: 2, full_name: "Анна Петрова" };
const animal = { id: 1, name: "Барсик", animal_type_id: 1, breed_id: 1, weight: "4.25", birth_year: 2021, owner_name: "Иван", owner_phone: "+79991234567", note: null, status: "in_care", animal_type: { id: 1, name: "Кошка" }, breed: { id: 1, animal_type_id: 1, name: "Беспородная", min_weight: null, max_weight: null } };
const procedure = { id: 1, animal_id: 1, volunteer_id: 1, procedure_type_id: 1, planned_date: "2099-10-10", planned_time: "14:00:00", duration_minutes: 60, status: "assigned", comment: "Нужен осмотр", animal, volunteer, procedure_type: { id: 1, name: "Кормление" } };

async function setup(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/animals") return route.fulfill({ json: [animal] });
    if (path === "/animal-types") return route.fulfill({ json: [animal.animal_type] });
    if (path === "/breeds") return route.fulfill({ json: [animal.breed] });
    if (path === "/volunteers" || path === "/volunteers/active") return route.fulfill({ json: [volunteer] });
    if (path === "/volunteers/1") return route.fulfill({ json: volunteer });
    if (path === "/care-procedure-types") return route.fulfill({ json: [procedure.procedure_type] });
    if (path === "/care-procedures/1") return route.fulfill({ json: procedure });
    if (path === "/care-procedures") return route.fulfill({ json: [procedure] });
    if (path.endsWith("/summary")) return route.fulfill({ json: { total: 1, active: 1, inactive: 0, in_care: 1, archived: 0, today_total: 1, today_completed: 0 } });
    return route.fulfill({ status: 404, json: { detail: "Не найдено" } });
  });
  await mockAuth(page);
}

test("phone mask accepts pasted formats, typing, deletion and normalizes login", async ({ page }) => {
  await page.goto("/login");
  const phone = page.getByLabel("Номер телефона", { exact: true });
  for (const input of ["89991234567", "+79991234567", "+7 (999) 123-45-67"]) {
    await phone.fill(input);
    await expect(phone).toHaveValue("+7 (999) 123-45-67");
  }
  await phone.fill("");
  await phone.pressSequentially("89991234567");
  await expect(phone).toHaveValue("+7 (999) 123-45-67");
  await phone.press("Backspace");
  await expect(phone).toHaveValue("+7 (999) 123-45-6");
  await phone.press("7");
  await phone.evaluate((element: HTMLInputElement) => element.setSelectionRange(9, 9));
  await phone.press("Backspace");
  await expect(phone).toHaveValue("+7 (991) 234-56-7");
  await phone.fill("89991234567");
  let submitted: unknown;
  await page.route("**/api/v1/auth/login", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 401, json: { detail: "Тестовый ответ" } });
  });
  await page.getByLabel("Пароль", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Тестовый ответ");
  expect(submitted).toEqual({ phone: "+79991234567", password: "test-password" });
});

test("volunteer form masks existing phone and saves availability", async ({ page }) => {
  await setup(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/volunteers/1", (route) => {
    if (route.request().method() === "PATCH") submitted = route.request().postDataJSON();
    return route.fulfill({ json: volunteer });
  });
  await page.goto("/volunteers/1/edit");
  await expect(page.locator("#volunteer-phone")).toHaveValue("+7 (999) 123-45-67");
  await page.getByLabel("Доступен с").fill("15:00");
  await page.getByLabel("Доступен до").fill("14:00");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Окончание должно быть позже начала")).toBeVisible();
  expect(submitted).toBeUndefined();
  await page.getByLabel("Доступен до").fill("18:00");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page).toHaveURL(/\/volunteers$/);
  expect(submitted).toMatchObject({ available_from: "15:00", available_to: "18:00", phone: "+79991234567" });
});

test("animal contact uses shared mask", async ({ page }) => {
  await setup(page);
  await page.goto("/animals/new");
  await page.getByLabel("Телефон хозяина").fill("89991234567");
  await expect(page.getByLabel("Телефон хозяина")).toHaveValue("+7 (999) 123-45-67");
});

test("assignment displays note and availability, accepts Russian dates and shows server rejection", async ({ page }) => {
  await setup(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/care-procedures", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 409, json: { detail: { message: "Время услуги выходит за пределы доступности волонтёра", field: "volunteer_id" } } });
  });
  await page.goto("/procedures/new");
  await page.locator("#care-procedure-animal_id").selectOption("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("1");
  await page.locator("#care-procedure-volunteer_id").selectOption("1");
  await expect(page.getByText("Примечание: После обеда")).toBeVisible();
  await expect(page.getByText("Доступность: 14:00–18:00")).toBeVisible();
  await page.getByLabel("Плановая дата").fill("31.02.2099");
  await page.getByLabel("Плановое время").fill("13:00");
  await page.getByRole("button", { name: "Назначить услугу", exact: true }).click();
  expect(submitted).toBeUndefined();
  await page.getByLabel("Плановая дата").fill("10.10.2099");
  await page.getByRole("button", { name: "Назначить услугу", exact: true }).click();
  await expect(page.locator(".care-procedure-form__error")).toContainText("доступности");
  expect(submitted).toMatchObject({ planned_date: "2099-10-10", planned_time: "13:00:00" });
});

test("failed execution requires reason and sends explicit outcome", async ({ page }) => {
  await setup(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/care-procedures/1/execute", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ...submitted, id: 1, care_procedure_id: 1 } });
  });
  await page.goto("/procedures/1/execute");
  await expect(page.getByText("10.10.2099 · 14:00")).toBeVisible();
  await page.getByLabel("Итог услуги").selectOption("false");
  await page.getByRole("button", { name: "Сохранить выполнение" }).click();
  await expect(page.getByText("Укажите причину невыполнения")).toBeVisible();
  expect(submitted).toBeUndefined();
  await page.getByLabel("Причина невыполнения").fill("Нет доступа");
  await page.getByRole("button", { name: "Сохранить выполнение" }).click();
  await expect(page).toHaveURL(/\/procedures$/);
  expect(submitted).toMatchObject({ is_completed: false, failure_reason: "Нет доступа", result: "" });
});

test("saved failed result is visible in procedure card", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/care-procedures/1/execution", (route) => route.fulfill({ json: {
    id: 1, care_procedure_id: 1, execution_date: "2099-10-10", execution_time: "14:00", is_completed: false, failure_reason: "Нет доступа", result: "", comment: null,
  } }));
  await page.goto("/procedures/1/edit");
  await expect(page.getByText("Не выполнено", { exact: true })).toBeVisible();
  await expect(page.getByText("Нет доступа", { exact: true })).toBeVisible();
});

for (const available of [true, false]) {
  test(`deactivation requires all replacements; candidates available=${available}`, async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/volunteers/1/deactivation-assignments", (route) => route.fulfill({ json: [
      { procedure, candidates: available ? [candidate] : [] },
      { procedure: { ...procedure, id: 2, planned_time: "15:00" }, candidates: [candidate] },
    ] }));
    let submitted: unknown;
    await page.route("**/api/v1/volunteers/1/deactivate", (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 409, json: { detail: { message: "Волонтёр занят другой услугой в это время" } } });
    });
    await page.goto("/volunteers");
    await page.getByRole("button", { name: "Деактивировать Иван Иванов" }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Деактивировать", exact: true });
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByText("10.10.2099 · 14:00 · 60 мин")).toBeVisible();
    await dialog.getByLabel("Замена для услуги №2").selectOption("2");
    await expect(confirm).toBeDisabled();
    if (!available) {
      await expect(dialog.getByRole("alert")).toContainText("Нет подходящих");
      expect(submitted).toBeUndefined();
      return;
    }
    await dialog.getByLabel("Замена для услуги №1").selectOption("2");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog.getByRole("alert")).toContainText("занят");
    expect(submitted).toEqual({ reassignments: [{ procedure_id: 1, volunteer_id: 2 }, { procedure_id: 2, volunteer_id: 2 }] });
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("archived animal restoration asks confirmation and shows conflict", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/animals?*", (route) => route.fulfill({ json: [{ ...animal, status: "archived" }] }));
  await page.route("**/api/v1/animals/1/restore", (route) => route.fulfill({ status: 409, json: { detail: { message: "Волонтёр занят другой услугой в это время" } } }));
  await page.goto("/animals");
  await page.getByRole("button", { name: "Восстановить карточку Барсик" }).click();
  await expect(page.getByRole("dialog")).toContainText("приостановленные назначения");
  await page.getByRole("dialog").getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("занят");
  await page.route("**/api/v1/animals/1/restore", (route) => route.fulfill({ json: animal }));
  await page.route("**/api/v1/animals?*", (route) => route.fulfill({ json: [animal] }));
  await page.getByRole("dialog").getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("восстановлена");
});

test("report type changes visible tables and charts", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/reports?*", (route) => {
    const type = new URL(route.request().url()).searchParams.get("report_type");
    return route.fulfill({ json: {
      report_type: type, title: "Отчёт", date_from: "2099-10-01", date_to: "2099-10-10", procedure_type_name: "Все услуги", metrics: [],
      executions_by_month: [], procedure_types: [], volunteer_activity: [],
      animal_activity: type === "animal_care" ? [{ animal_id: 1, name: "Барсик", total: 2, completed: 1 }] : [],
      volunteer_workload: type === "volunteer_activity" ? [{ volunteer_id: 1, full_name: "Иван Иванов", total: 2, completed: 1, completed_minutes: 60 }] : [],
    } });
  });
  await page.goto("/analytics");
  await page.getByRole("radio", { name: /Уход за животными/ }).check();
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("table", { name: "Уход по животным" })).toContainText("Барсик");
  await expect(page.locator(".procedure-chart")).toHaveCount(0);
  await expect(page.locator(".report-result__period")).toContainText("01.10.2099 — 10.10.2099");
  await page.getByRole("radio", { name: /Работа волонтёров/ }).check();
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("table", { name: "Нагрузка волонтёров" })).toContainText("Иван Иванов");
  await expect(page.getByRole("table", { name: "Уход по животным" })).toHaveCount(0);
  await expect(page.locator(".procedure-distribution")).toHaveCount(0);
  await page.getByRole("radio", { name: /Выполнение услуг/ }).check();
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("table", { name: "Нагрузка волонтёров" })).toHaveCount(0);
  await expect(page.locator(".procedure-distribution")).toBeVisible();
});

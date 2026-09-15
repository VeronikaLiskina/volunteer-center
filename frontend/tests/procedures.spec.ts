import { expect, test } from "@playwright/test";
import { mockAuth } from "./auth-helper";
import { AnimalStatus, type Animal } from "../src/types/animal";
import {
  CareProcedureStatus, type CareProcedure, type CareProcedureCreate,
} from "../src/types/careProcedure";
import { VolunteerStatus, type Volunteer } from "../src/types/volunteer";
import type {
  ProcedureExecution, ProcedureExecutionCreate,
} from "../src/types/procedureExecution";

const animal: Animal = {
  id: 1, name: "Барсик", animal_type_id: 1, breed_id: 1, weight: "4.25", birth_year: 2021,
  owner_name: null, owner_phone: null, note: null, status: AnimalStatus.InCare,
  animal_type: { id: 1, name: "Кошка" },
  breed: { id: 1, animal_type_id: 1, name: "Беспородная", min_weight: null, max_weight: null },
};
const volunteer: Volunteer = {
  id: 1, full_name: "Иванова Анна", phone: "+79991234567", note: null, status: VolunteerStatus.Active,
};
const procedureTypes = [{ id: 1, name: "Кормление" }, { id: 2, name: "Выгул" }];

test.beforeEach(async ({ page }) => {
  let procedures: CareProcedure[] = [];
  let executions: ProcedureExecution[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    if (path === "/health") return route.fulfill({ json: { status: "ok", database: "connected" } });
    if (path === "/animals/summary") return route.fulfill({ json: { total: 1, in_care: 1, archived: 0 } });
    if (path === "/volunteers/summary") return route.fulfill({ json: { total: 1, active: 1, inactive: 0 } });
    if (path === "/animals") return route.fulfill({ json: [animal] });
    if (path === "/volunteers/active") return route.fulfill({ json: [volunteer] });
    if (path === "/volunteers" && method === "GET") return route.fulfill({ json: [volunteer] });
    if (path === "/care-procedure-types") return route.fulfill({ json: procedureTypes });
    if (path === "/care-procedures/summary") return route.fulfill({ json: {
      today_total: procedures.length, today_completed: executions.length,
    } });
    if (path === "/care-procedures" && method === "GET") {
      const found = procedures.filter((item) =>
        (!url.searchParams.get("status") || item.status === url.searchParams.get("status"))
        && (!url.searchParams.get("animal_id") || item.animal_id === Number(url.searchParams.get("animal_id")))
        && (!url.searchParams.get("volunteer_id") || item.volunteer_id === Number(url.searchParams.get("volunteer_id")))
        && (!url.searchParams.get("procedure_type_id") || item.procedure_type_id === Number(url.searchParams.get("procedure_type_id"))));
      return route.fulfill({ json: found });
    }
    if (path === "/care-procedures" && method === "POST") {
      const data = request.postDataJSON() as CareProcedureCreate;
      const procedure: CareProcedure = { ...data, status: CareProcedureStatus.Assigned,
        id: procedures.length + 1, animal,
        volunteer, procedure_type: procedureTypes.find((item) => item.id === data.procedure_type_id)! };
      procedures = [...procedures, procedure];
      return route.fulfill({ status: 201, json: procedure });
    }
    const id = Number(path.split("/")[2]);
    const procedure = procedures.find((item) => item.id === id);
    if (!procedure) return route.fulfill({ status: 404, json: { detail: { message: "Процедура не найдена" } } });
    if (path.endsWith("/execute") && method === "POST") {
      if (procedure.status === CareProcedureStatus.Completed)
        return route.fulfill({ status: 409, json: { detail: { message: "Процедура уже выполнена" } } });
      const data = request.postDataJSON() as ProcedureExecutionCreate;
      const execution: ProcedureExecution = { ...data, id: executions.length + 1,
        care_procedure_id: id, created_at: "2026-09-09T10:45:00+08:00" };
      executions = [...executions, execution];
      procedure.status = CareProcedureStatus.Completed;
      return route.fulfill({ status: 201, json: execution });
    }
    if (path.endsWith("/execution")) {
      const execution = executions.find((item) => item.care_procedure_id === id);
      if (!execution) return route.fulfill({ status: 404, json: { detail: { message: "Результат выполнения не найден" } } });
      if (method === "PATCH") Object.assign(execution, request.postDataJSON());
      return route.fulfill({ json: execution });
    }
    if (method === "PATCH") {
      Object.assign(procedure, request.postDataJSON());
      procedure.procedure_type = procedureTypes.find((item) => item.id === procedure.procedure_type_id)!;
    }
    return route.fulfill({ json: procedure });
  });
  await mockAuth(page);
});

test("procedure navigation, validation, creation, editing and filters", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Процедуры", exact: true }).click();
  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByText("Процедуры не найдены", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Назначить процедуру/ }).click();
  await expect(page).toHaveURL(/\/procedures\/new$/);
  await expect(page.locator(".care-procedure-form__status-field")).toHaveText("Статус: Назначена");
  await expect(page.locator("#care-procedure-status")).toHaveCount(0);
  await page.getByRole("button", { name: "Назначить процедуру" }).click();
  await expect(page.locator("#care-procedure-animal_id-error")).toHaveText("Обязательное поле");
  await expect(page.locator("#care-procedure-volunteer_id-error")).toHaveText("Обязательное поле");
  await page.locator("#care-procedure-animal_id").selectOption("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("1");
  await page.locator("#care-procedure-planned_time").fill("10:30");
  await page.locator("#care-procedure-volunteer_id").selectOption("1");
  await page.locator("#care-procedure-duration_minutes").fill("0");
  await page.getByRole("button", { name: "Назначить процедуру" }).click();
  await expect(page.locator("#care-procedure-duration_minutes-error")).toContainText("больше нуля");
  await page.locator("#care-procedure-duration_minutes").fill("30");
  await page.locator("#care-procedure-comment").fill("После осмотра");
  await page.getByRole("button", { name: "Назначить процедуру" }).click();
  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByText("Процедура для «Барсик» назначена", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Барсик", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(page).toHaveURL(/\/procedures\/1\/edit$/);
  await expect(page.locator("#care-procedure-animal_id")).toHaveValue("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("2");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByRole("cell", { name: "Выгул", exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Таблица процедур" }).getByText("Назначена", { exact: true })).toBeVisible();
  await page.getByLabel("Статус").selectOption("completed");
  await expect(page.getByText("Процедуры не найдены", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Сбросить" }).click();
  await expect(page.getByRole("region", { name: "Таблица процедур" }).getByText("Назначена", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("procedures-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("procedures-mobile.png"), fullPage: true });
});

test("procedure errors, retry and invalid URL", async ({ page }) => {
  let failList = true;
  await page.route("**/api/v1/care-procedures?*", (route) => route.fulfill(failList
    ? { status: 503, json: { detail: "Расписание временно недоступно" } } : { json: [] }));
  await page.goto("/procedures");
  await expect(page.getByRole("alert")).toContainText("Расписание временно недоступно");
  failList = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Процедуры не найдены", { exact: true })).toBeVisible();

  await page.route("**/api/v1/care-procedures", (route) => route.fulfill({ status: 409,
    json: { detail: { message: "Можно назначить только активного волонтёра", field: "volunteer_id" } } }));
  await page.goto("/procedures/new");
  await page.locator("#care-procedure-animal_id").selectOption("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("1");
  await page.locator("#care-procedure-planned_time").fill("11:00");
  await page.locator("#care-procedure-volunteer_id").selectOption("1");
  await page.getByRole("button", { name: "Назначить процедуру" }).click();
  await expect(page.locator("#care-procedure-volunteer_id-error")).toHaveText("Можно назначить только активного волонтёра");

  await page.goto("/procedures/abc/edit");
  await expect(page.getByRole("alert")).toContainText("Некорректный номер процедуры");
  await expect(page.locator("#care-procedure-animal_id")).toHaveCount(0);
});

test("save and add another keeps the creation form and clears it", async ({ page }) => {
  await page.goto("/procedures/new");
  await page.locator("#care-procedure-animal_id").selectOption("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("1");
  await page.locator("#care-procedure-planned_time").fill("09:30");
  await page.locator("#care-procedure-volunteer_id").selectOption("1");
  await page.getByRole("button", { name: "Сохранить и добавить ещё" }).click();
  await expect(page).toHaveURL(/\/procedures\/new$/);
  await expect(page.locator("#care-procedure-animal_id")).toHaveValue("");
  await expect(page.locator("#care-procedure-procedure_type_id")).toHaveValue("");
  await expect(page.locator("#care-procedure-planned_time")).toHaveValue("");
  await expect(page.locator("#care-procedure-duration_minutes")).toHaveValue("30");
});

test("assigned procedure can be executed and its result is shown", async ({ page }) => {
  await page.goto("/procedures/new");
  await page.locator("#care-procedure-animal_id").selectOption("1");
  await page.locator("#care-procedure-procedure_type_id").selectOption("1");
  await page.locator("#care-procedure-planned_time").fill("10:30");
  await page.locator("#care-procedure-volunteer_id").selectOption("1");
  await page.getByRole("button", { name: "Назначить процедуру" }).click();

  await page.getByRole("button", { name: "Выполнить" }).click();
  await expect(page).toHaveURL(/\/procedures\/1\/execute$/);
  await expect(page.getByRole("heading", { name: "Кормление для Барсик" })).toBeVisible();
  await expect(page.getByText("Иванова Анна", { exact: true })).toBeVisible();
  await expect(page.getByText("30 мин", { exact: true })).toBeVisible();
  await page.locator("#procedure-execution-execution_date").fill("");
  await page.locator("#procedure-execution-execution_time").fill("");
  await page.getByRole("button", { name: "Сохранить выполнение" }).click();
  await expect(page.locator("#procedure-execution-execution_date-error")).toHaveText("Укажите дату выполнения");
  await expect(page.locator("#procedure-execution-execution_time-error")).toHaveText("Укажите время выполнения");
  await expect(page.locator("#procedure-execution-result-error")).toHaveText("Опишите результат выполнения");
  await page.locator("#procedure-execution-execution_date").fill("2026-09-09");
  await page.locator("#procedure-execution-execution_time").fill("10:45");
  await page.locator("#procedure-execution-result").fill("Животное накормлено, состояние спокойное");
  await page.locator("#procedure-execution-comment").fill("Без особенностей");
  await page.getByRole("button", { name: "Сохранить выполнение" }).click();

  await expect(page).toHaveURL(/\/procedures$/);
  await expect(page.getByText("Процедура выполнена", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Таблица процедур" }).getByText("Выполнена", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Выполнить" })).toHaveCount(0);
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Результат выполнения" })).toBeVisible();
  await expect(page.getByText("Животное накормлено, состояние спокойное", { exact: true })).toBeVisible();
  await expect(page.getByText("Без особенностей", { exact: true })).toBeVisible();
});

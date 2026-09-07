import { expect, test } from "@playwright/test";
import { AnimalStatus, type Animal, type AnimalCreate } from "../src/types/animal";

const types = [{ id: 1, name: "Кошка" }, { id: 2, name: "Собака" }];
const breeds = [
  { id: 1, animal_type_id: 1, name: "Сиамская", min_weight: null, max_weight: null },
  { id: 2, animal_type_id: 2, name: "Лабрадор", min_weight: null, max_weight: null },
];

test.beforeEach(async ({ page }) => {
  // Only the browser checks use a mock API. Backend tests run the real PostgreSQL module.
  let animals: Animal[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/health") return route.fulfill({ json: { status: "ok", database: "connected" } });
    if (path === "/animals/summary") return route.fulfill({ json: {
      total: animals.length, in_care: animals.filter((animal) => animal.status === AnimalStatus.InCare).length,
      archived: animals.filter((animal) => animal.status === AnimalStatus.Archived).length,
    } });
    if (path === "/volunteers/summary") return route.fulfill({ json: { total: 0, active: 0, inactive: 0 } });
    if (path === "/animal-types") return route.fulfill({ json: types });
    if (path === "/breeds") return route.fulfill({ json: breeds });
    if (path === "/animals" && method === "GET") {
      const found = animals.filter((animal) => (!url.searchParams.get("search") || animal.name.includes(url.searchParams.get("search")!))
        && (!url.searchParams.get("status") || animal.status === url.searchParams.get("status")));
      return route.fulfill({ json: found });
    }
    if (path === "/animals" && method === "POST") {
      const data = request.postDataJSON() as AnimalCreate;
      const animal: Animal = { ...data, id: animals.length + 1, status: AnimalStatus.InCare,
        animal_type: types.find((type) => type.id === data.animal_type_id)!,
        breed: breeds.find((breed) => breed.id === data.breed_id)! };
      animals = [animal, ...animals];
      return route.fulfill({ status: 201, json: animal });
    }
    const id = Number(path.split("/")[2]);
    const animal = animals.find((item) => item.id === id);
    if (!animal) return route.fulfill({ status: 404, json: { detail: { message: "Животное не найдено" } } });
    if (path.endsWith("/archive")) animal.status = AnimalStatus.Archived;
    else if (method === "PATCH") Object.assign(animal, request.postDataJSON());
    return route.fulfill({ json: animal });
  });
});

test("navigation, field validation, dependent breed, save, edit, confirmation and archive", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Система работает", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Животные", exact: true }).click();
  await expect(page).toHaveURL(/\/animals$/);
  await expect(page.getByRole("link", { name: /Добавить животное/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Справочники/ })).toBeVisible();
  await page.getByRole("link", { name: /Добавить животное/ }).click();
  await expect(page).toHaveURL(/\/animals\/new$/);
  await expect(page.getByRole("link", { name: "Закрыть и вернуться к списку животных" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Список животных" })).toHaveCount(0);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Введите кличку", { exact: true })).toBeVisible();
  await page.locator("#animal-animal_type_id").selectOption("1");
  await page.locator("#animal-breed_id").selectOption("1");
  await page.locator("#animal-animal_type_id").selectOption("2");
  await expect(page.locator("#animal-breed_id")).toHaveValue("");
  await expect(page.locator("#animal-breed_id option")).toHaveText(["Выберите породу", "Лабрадор"]);
  await page.locator("#animal-breed_id").selectOption("2");
  await page.locator("#animal-name").fill("Бим");
  await page.locator("#animal-weight").fill("0");
  await page.locator("#animal-birth_year").fill("2021");
  await page.locator("#animal-owner_phone").fill("123");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator("#animal-weight-error")).toBeVisible();
  await expect(page.locator("#animal-owner_phone-error")).toBeVisible();
  await page.locator("#animal-weight").fill("20,25");
  await page.locator("#animal-owner_phone").fill("+7 (999) 123-45-67");
  await page.getByRole("button", { name: "Сохранить и добавить ещё" }).click();
  await expect(page.getByText("Карточка животного сохранена", { exact: false })).toBeVisible();
  await expect(page.locator("#animal-name")).toHaveValue("");
  await page.getByRole("link", { name: "Закрыть и вернуться к списку животных" }).click();
  await expect(page).toHaveURL(/\/animals$/);
  await expect(page.getByRole("cell", { name: "Бим", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать карточку Бим" }).click();
  await expect(page).toHaveURL(/\/animals\/1\/edit$/);
  await expect(page.locator("#animal-name")).toHaveValue("Бим");
  await page.locator("#animal-name").fill("Бимка");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/animals$/);
  await expect(page.getByRole("cell", { name: "Бимка", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Архивировать карточку Бимка" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Под опекой", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Архивировать карточку Бимка" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "В архив", exact: true }).click();
  await expect(page.getByRole("cell", { name: "В архиве", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Просмотреть карточку Бимка" }).click();
  await expect(page).toHaveURL(/\/animals\/1\/edit$/);
  await expect(page.locator("#animal-name")).toBeDisabled();
  await page.getByRole("link", { name: "Закрыть и вернуться к списку животных" }).click();
  await page.screenshot({ path: testInfo.outputPath("animals-desktop.png"), fullPage: true });
});

test("server field errors and list retry", async ({ page }) => {
  let failList = true;
  await page.route("**/api/v1/animals?*", (route) => route.fulfill(failList
    ? { status: 503, json: { detail: "Сервис временно недоступен" } } : { json: [] }));
  await page.goto("/animals");
  await expect(page.getByRole("alert")).toContainText("Сервис временно недоступен");
  failList = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Животные не найдены.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Добавить животное/ }).click();
  await page.route("**/api/v1/animals", (route) => route.fulfill({ status: 422,
    json: { detail: { message: "Порода не соответствует выбранному типу животного", field: "breed_id" } } }));
  await page.locator("#animal-name").fill("Мурка");
  await page.locator("#animal-animal_type_id").selectOption("1");
  await page.locator("#animal-breed_id").selectOption("1");
  await page.locator("#animal-weight").fill("4.25");
  await page.locator("#animal-birth_year").fill("2021");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator("#animal-breed_id-error")).toHaveText("Порода не соответствует выбранному типу животного");
});

test("mobile layout and direct route", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/animals/abc/edit");
  await expect(page.getByRole("alert")).toHaveText(/Некорректный номер карточки/);
  await expect(page.locator("#animal-name")).toHaveCount(0);
  await page.getByRole("link", { name: "Закрыть и вернуться к списку животных" }).click();
  await expect(page).toHaveURL(/\/animals$/);
  await page.goto("/animals");
  await expect(page.getByRole("heading", { name: "Карточка животного", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /Добавить животное/ }).click();
  await expect(page).toHaveURL(/\/animals\/new$/);
  await expect(page.getByRole("heading", { name: "Карточка животного", exact: true })).toBeVisible();
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("animals-mobile.png"), fullPage: true });
});

test("dashboard matches layout, displays API counts and opens animal sections", async ({ page }, testInfo) => {
  await page.route("**/api/v1/animals/summary", (route) => route.fulfill({ json: { total: 4, in_care: 3, archived: 1 } }));
  await page.route("**/api/v1/volunteers/summary", (route) => route.fulfill({ json: { total: 7, active: 5, inactive: 2 } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Главная панель" })).toBeVisible();
  await expect(page.locator(".dashboard-metrics__card")).toHaveCount(4);
  await expect(page.locator(".dashboard-metrics__value").first()).toHaveText("3");
  await expect(page.locator(".dashboard-metrics__value").last()).toHaveText("5");
  await expect(page.getByText("Под опекой: 3 · В архиве: 1")).toBeVisible();
  await expect(page.getByText("Активны: 5 · Неактивны: 2")).toBeVisible();
  await expect(page.getByRole("link", { name: /Карточка животного/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Справочники/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: /Карточка животного/ }).click();
  await expect(page).toHaveURL(/\/animals\/new$/);
  await expect(page.getByRole("link", { name: "Закрыть и вернуться к списку животных" })).toBeVisible();
  await page.getByRole("link", { name: "Закрыть и вернуться к списку животных" }).click();
  await expect(page).toHaveURL(/\/animals$/);
  await page.goto("/");
  await page.getByRole("link", { name: /Справочники/ }).click();
  await expect(page).toHaveURL(/\/animals\/dictionaries$/);
  await expect(page.getByRole("heading", { name: "Справочники", exact: true })).toBeFocused();
  await page.getByRole("link", { name: "Закрыть справочники и вернуться к списку животных" }).click();
  await expect(page).toHaveURL(/\/animals$/);
});

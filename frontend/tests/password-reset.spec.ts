import { expect, test } from "@playwright/test";

const response = (id = "first-request") => ({
  request_id: id, message: "Если этот номер зарегистрирован, на него придёт SMS с кодом.",
  resend_after: 60, expires_in: 300,
});

test("forgot password carries phone and lets the user set a new password", async ({ page }) => {
  await page.route("**/api/v1/auth/password-reset/request", (route) => {
    expect(route.request().postDataJSON()).toEqual({ phone: "8 (999) 000-00-01" });
    return route.fulfill({ json: response() });
  });
  let confirmations = 0;
  await page.route("**/api/v1/auth/password-reset/confirm", (route) => {
    confirmations++;
    expect(route.request().postDataJSON()).toEqual({ request_id: "first-request", code: "123456", password: "new-password-12345" });
    return route.fulfill({ status: 204 });
  });
  await page.goto("/login");
  await page.getByLabel("Номер телефона", { exact: true }).fill("8 (999) 000-00-01");
  await page.getByRole("button", { name: "Забыли пароль", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByLabel("Номер телефона", { exact: true })).toHaveValue("8 (999) 000-00-01");
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(page.getByRole("status")).toContainText("Если этот номер зарегистрирован");
  await expect(page.getByRole("button", { name: /Отправить код повторно/ })).toBeDisabled();
  await page.getByLabel("Код из SMS").fill("123456");
  await page.getByLabel("Новый пароль", { exact: true }).fill("new-password-12345");
  await page.getByLabel("Повторите пароль").fill("different-password");
  await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
  await expect(page.getByRole("alert")).toHaveText("Пароли не совпадают");
  expect(confirmations).toBe(0);
  await page.getByLabel("Повторите пароль").fill("new-password-12345");
  await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
  await expect(page.getByRole("heading", { name: "Пароль изменён" })).toBeVisible();
  await expect(page.getByLabel("Новый пароль", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Вернуться ко входу" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("invalid code allows retry and resend replaces the recovery request", async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.route("**/api/v1/auth/password-reset/request", (route) => route.fulfill({ json: response(`request-${++requests}`) }));
  await page.route("**/api/v1/auth/password-reset/confirm", (route) => {
    const body = route.request().postDataJSON();
    if (body.request_id === "request-1") return route.fulfill({ status: 400, json: { detail: "Код неверный или истёк. Проверьте код или запросите новый." } });
    expect(body.request_id).toBe("request-2");
    return route.fulfill({ status: 204 });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/forgot-password");
  await page.getByLabel("Номер телефона", { exact: true }).fill("+79990000001");
  await page.getByRole("button", { name: "Получить код" }).click();
  await page.getByLabel("Код из SMS").fill("111111");
  await page.getByLabel("Новый пароль", { exact: true }).fill("new-password-12345");
  await page.getByLabel("Повторите пароль").fill("new-password-12345");
  await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
  await expect(page.getByRole("alert")).toContainText("Код неверный или истёк");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Отправить код повторно", exact: true }).click();
  await expect(page.getByLabel("Код из SMS")).toHaveValue("");
  await page.getByLabel("Код из SMS").fill("222222");
  await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
  await expect(page.getByRole("heading", { name: "Пароль изменён" })).toBeVisible();
});

test("delivery failure and rate limit remain actionable", async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.route("**/api/v1/auth/password-reset/request", (route) => {
    requests++;
    if (requests === 1) return route.fulfill({ status: 503, json: { detail: "Не удалось отправить SMS. Попробуйте позже." } });
    if (requests === 2) return route.fulfill({ status: 429, headers: { "Retry-After": "60", "Access-Control-Expose-Headers": "Retry-After" }, json: { detail: "Слишком много попыток. Подождите и попробуйте снова." } });
    return route.fulfill({ json: response() });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Номер телефона", { exact: true }).fill("+79990000001");
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось отправить SMS");
  await expect(page.getByLabel("Код из SMS")).toHaveCount(0);
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(page.getByRole("button", { name: /Повторить через/ })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Получить код" }).click();
  await page.getByRole("button", { name: "Изменить номер" }).click();
  await expect(page.getByLabel("Номер телефона", { exact: true })).toHaveValue("+79990000001");
  await expect(page.getByLabel("Код из SMS")).toHaveCount(0);
});

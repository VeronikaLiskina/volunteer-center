import { expect, test } from "@playwright/test";

const analytics = {
  animals: { total: 5, in_care: 4, archived: 1 },
  volunteers: { total: 3, active: 3, inactive: 0 },
  procedures: { total: 12, assigned: 4, completed: 6, cancelled: 1, overdue: 1 },
  executions_by_month: [
    { month: "2026-04", label: "Апр", completed: 1 },
    { month: "2026-05", label: "Май", completed: 2 },
    { month: "2026-06", label: "Июн", completed: 0 },
    { month: "2026-07", label: "Июл", completed: 4 },
    { month: "2026-08", label: "Авг", completed: 3 },
    { month: "2026-09", label: "Сен", completed: 6 },
  ],
  procedure_types: [
    { procedure_type_id: 1, name: "Кормление", count: 6, percentage: 50 },
    { procedure_type_id: 2, name: "Выгул", count: 3, percentage: 25 },
    { procedure_type_id: 3, name: "Уборка", count: 3, percentage: 25 },
  ],
  volunteer_activity: [
    { volunteer_id: 1, full_name: "Иванова Анна", completed_count: 4 },
    { volunteer_id: 2, full_name: "Петров Павел", completed_count: 2 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/analytics", (route) => route.fulfill({ json: analytics }));
  await page.route("**/api/v1/reports?*", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: {
      report_type: url.searchParams.get("report_type"),
      title: "Выполнение процедур",
      date_from: url.searchParams.get("date_from"),
      date_to: url.searchParams.get("date_to"),
      metrics: [
        { key: "total", label: "Всего процедур", value: 12 },
        { key: "completed", label: "Выполнено", value: 6 },
        { key: "cancelled", label: "Отменено", value: 1 },
        { key: "overdue", label: "Просрочено", value: 1 },
      ],
    } });
  });
  await page.route("**/api/v1/reports/export.xlsx?*", (route) => route.fulfill({
    body: "test workbook",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    headers: { "Content-Disposition": 'attachment; filename="lapka-report.xlsx"' },
  }));
});

test("analytics shows aggregates and charts on desktop and mobile", async ({ page }, testInfo) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Аналитика центра" })).toBeVisible();
  await expect(page.locator(".analytics-stat-card")).toHaveCount(3);
  await expect(page.locator(".analytics-stat-card__row").filter({ hasText: "Под опекой" }).locator("dd")).toHaveText("4");
  await expect(page.locator(".procedure-chart__column")).toHaveCount(6);
  await expect(page.getByText("Кормление", { exact: true })).toBeVisible();
  await expect(page.getByText("Иванова Анна", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("analytics-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("analytics-mobile.png"), fullPage: true });
});

test("reports validate filters, generate a result and show API errors", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Отчёты", exact: true })).toBeVisible();
  await expect(page.getByText("Отчёт ещё не сформирован")).toBeVisible();

  const from = page.getByLabel("Дата начала");
  const to = page.getByLabel("Дата окончания");
  await from.fill("2026-09-30");
  await to.fill("2026-09-01");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("alert")).toContainText("Дата начала не может быть позже");

  await from.fill("2026-09-01");
  await to.fill("2026-09-30");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByText("Сформированный отчёт")).toBeVisible();
  await expect(page.locator(".report-result__metric").filter({ hasText: "Всего процедур" }).locator("dd")).toHaveText("12");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать Excel" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lapka-report-2026-09-01-2026-09-30.xlsx");

  await page.route("**/api/v1/reports?*", (route) => route.fulfill({ status: 503, json: { detail: "Отчёт временно недоступен" } }));
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("alert")).toContainText("Отчёт временно недоступен");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("analytics error can be retried", async ({ page }) => {
  let failed = true;
  await page.route("**/api/v1/analytics", (route) => failed
    ? route.fulfill({ status: 503, json: { detail: "Аналитика временно недоступна" } })
    : route.fulfill({ json: analytics }));
  await page.goto("/analytics");
  await expect(page.getByRole("alert")).toContainText("Аналитика временно недоступна");
  failed = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.locator(".analytics-stat-card")).toHaveCount(3);
});

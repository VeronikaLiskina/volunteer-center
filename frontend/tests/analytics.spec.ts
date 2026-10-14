import { expect, test } from "@playwright/test";
import { mockAuth } from "./auth-helper";
import { readFile } from "node:fs/promises";

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
  await mockAuth(page);
  await page.route("**/api/v1/care-procedure-types", (route) => route.fulfill({ json: [{ id: 1, name: "Custom service" }] }));
  await page.route("**/api/v1/analytics", (route) => route.fulfill({ json: analytics }));
  await page.route("**/api/v1/reports?*", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: {
      report_type: url.searchParams.get("report_type"),
      title: "Выполнение услуг",
      date_from: url.searchParams.get("date_from"),
      date_to: url.searchParams.get("date_to"),
      procedure_type_id: Number(url.searchParams.get("procedure_type_id")) || null,
      report_id: "d117f4b8-14ac-4213-8bbe-9481d14a5137",
      procedure_type_name: "Custom service",
      executions_by_month: analytics.executions_by_month,
      procedure_types: analytics.procedure_types,
      volunteer_activity: analytics.volunteer_activity,
      metrics: [
        { key: "total", label: "Всего услуг", value: 12 },
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
  await expect(page.getByRole("heading", { name: "Аналитика и отчёты" })).toBeVisible();
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.locator(".report-result__metric")).toHaveCount(4);
  await expect(page.locator(".procedure-chart__column")).toHaveCount(6);
  await expect(page.getByText("Кормление", { exact: true })).toBeVisible();
  await expect(page.locator(".volunteer-activity")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("analytics-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("analytics-mobile.png"), fullPage: true });
});

test("reports validate filters, generate a result and show API errors", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole("heading", { name: "Аналитика и отчёты", exact: true })).toBeVisible();
  await expect(page.getByText("Отчёт ещё не сформирован")).toBeVisible();

  const from = page.getByLabel("Дата начала");
  const to = page.getByLabel("Дата окончания");
  await from.fill("30.09.2026");
  await to.fill("01.09.2026");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("alert")).toContainText("Дата начала не может быть позже");

  await from.fill("01.09.2026");
  await to.fill("30.09.2026");
  await page.getByRole("combobox", { name: "Услуга", exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByText("Сформированный отчёт")).toBeVisible();
  await expect(page.locator(".report-result__metric").filter({ hasText: "Всего услуг" }).locator("dd")).toHaveText("12");
  const downloadPromise = page.waitForEvent("download");
  // Draft filter edits must not silently change the generated report's export.
  await from.fill("01.01.2025");
  await page.getByRole("combobox", { name: "Услуга", exact: true }).selectOption("");
  const exportRequest = page.waitForRequest("**/api/v1/reports/export.xlsx?*");
  await page.getByRole("button", { name: "Выгрузить отчёт" }).click();
  const exportUrl = new URL((await exportRequest).url());
  expect(exportUrl.searchParams.get("procedure_type_id")).toBe("1");
  expect(exportUrl.searchParams.get("date_from")).toBe("2026-09-01");
  expect(exportUrl.searchParams.get("report_id")).toBe("d117f4b8-14ac-4213-8bbe-9481d14a5137");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lapka-report-2026-09-01-2026-09-30.xlsx");

  await page.route("**/api/v1/reports?*", (route) => route.fulfill({ status: 503, json: { detail: "Отчёт временно недоступен" } }));
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("alert")).toContainText("Отчёт временно недоступен");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("analytics error can be retried", async ({ page }) => {
  await page.route("**/api/v1/reports?*", (route) => route.fulfill({ status: 503, json: { detail: "Аналитика временно недоступна" } }));
  await page.goto("/analytics");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("alert")).toContainText("Аналитика временно недоступна");
  await page.unroute("**/api/v1/reports?*");
  await page.route("**/api/v1/reports?*", (route) => route.fulfill({ json: {
    ...analytics, report_type: "procedure_execution", title: "Выполнение услуг",
    date_from: "2026-09-01", date_to: "2026-09-30", procedure_type_name: "Все услуги", metrics: [],
  } }));
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByText("Сформированный отчёт")).toBeVisible();
});

for (const width of [1280, 375]) {
  test(`dashboard downloads a complete PNG at viewport ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/analytics");
    await expect(page.getByRole("button", { name: "Скачать PNG" })).toHaveCount(0);
    await page.getByLabel("Дата начала").fill("01.09.2026");
    await page.getByLabel("Дата окончания").fill("30.09.2026");
    await page.getByRole("button", { name: "Сформировать отчёт" }).click();
    await expect(page.getByText("Сформированный отчёт")).toBeVisible();
    await page.getByLabel("Дата начала").fill("01.01.2025");
    const pendingDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать PNG" }).click();
    const download = await pendingDownload;
    expect(download.suggestedFilename()).toBe("lapka-dashboard-2026-09-01-2026-09-30.png");
    const path = testInfo.outputPath("dashboard-export.png");
    await download.saveAs(path);
    const png = await readFile(path);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(2400);
    expect(png.readUInt32BE(20)).toBeGreaterThan(1500);
    // Decode the actual download: catch blank output or missing CSS charts.
    const pixels = await page.evaluate(async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let blue = 0, green = 0, dark = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
        if (b > 180 && r < 140 && g > 100 && g < 190) blue++;
        if (g > 140 && r < 120 && b < 170) green++;
        if (r < 40 && g < 40 && b < 40) dark++;
      }
      return { blue, green, dark };
    }, `data:image/png;base64,${png.toString("base64")}`);
    expect(pixels.blue).toBeGreaterThan(1000);
    expect(pixels.green).toBeGreaterThan(1000);
    expect(pixels.dark).toBeGreaterThan(1000);
    await expect(page.getByRole("button", { name: "Скачать PNG" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("PNG rendering failure allows retry", async ({ page }) => {
  await page.goto("/analytics");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByText("Сформированный отчёт")).toBeVisible();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить картинку");
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  expect((await pendingDownload).suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

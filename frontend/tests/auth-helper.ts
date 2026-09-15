import type { Page } from "@playwright/test";

export async function mockAuth(page: Page, role: "COORDINATOR" | "VOLUNTEER" = "COORDINATOR") {
  await page.addInitScript(() => sessionStorage.setItem("lapka-token", "test-token"));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: {
    id: 1, phone: "+79990000001", full_name: "Test User", role, is_active: true, volunteer_id: role === "VOLUNTEER" ? 1 : null,
  } }));
  await page.route("**/api/v1/notifications?*", (route) => route.fulfill({ json: { items: [], unread_count: 0 } }));
}

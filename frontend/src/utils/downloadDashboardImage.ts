import type { ReportData } from "../types/analytics";
import "./downloadDashboardImage.scss";

export async function downloadDashboardImage(source: HTMLElement, report: ReportData): Promise<void> {
  // Freeze the displayed report before any await: edits or a new request must
  // never mix one report's heading with another report's charts.
  const snapshot = document.createElement("div");
  snapshot.className = "dashboard-image";
  if (report.executions_by_month.length > 8) snapshot.classList.add("dashboard-image--long-period");
  for (const selector of [".report-result__header", ".report-result__metrics", ".analytics-dashboard"]) {
    const original = source.querySelector(selector);
    if (!original) throw new Error("Report is not ready");
    snapshot.append(original.cloneNode(true));
  }
  snapshot.querySelector(".report-result__eyebrow")!.textContent = "АСУВЦ «Лапка» · Аналитика и отчёты";
  snapshot.querySelectorAll("[id], [aria-labelledby]").forEach((node) => {
    node.removeAttribute("id"); node.removeAttribute("aria-labelledby");
  });

  const host = document.createElement("div");
  host.className = "dashboard-image-host";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  host.append(snapshot);
  document.body.append(host);

  try {
    const { toBlob } = await import("html-to-image");
    await document.fonts.ready;
    const blob = await toBlob(snapshot, { pixelRatio: 2, backgroundColor: "#f5f8fc" });
    if (!blob) throw new Error("PNG rendering failed");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lapka-dashboard-${report.date_from}-${report.date_to}.png`;
    document.body.append(link);
    try { link.click(); }
    finally {
      link.remove();
      // Give the browser time to consume the download URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } finally { host.remove(); }
}

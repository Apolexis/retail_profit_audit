import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname);
const forecast = readFileSync(resolve(root, "forecast.css"), "utf8");
const theme = readFileSync(resolve(root, "theme-refresh.css"), "utf8");
const overrides = readFileSync(resolve(root, "final-overrides.css"), "utf8");

describe("закрытые визуальные критерии", () => {
  it("выравнивает подписи и значения прогноза в одной левой ритмике", () => {
    expect(forecast).toContain(".forecast-controls > :is(label, div),");
    expect(forecast).toContain(".forecast-kpis .packet-kpi,");
    expect(forecast).toContain(".forecast-signal-grid article { min-width: 0; align-content: start; text-align: left; }");
    expect(forecast).toContain("overflow-wrap: anywhere;");
    expect(forecast).toContain("@media(max-width:720px){.forecast-controls{grid-template-columns:1fr}");
  });

  it("задает контур chart-кнопкам исключительно при hover точного указателя", () => {
    const hoverBlock = overrides.slice(overrides.indexOf("/* Chart view and series controls"));
    expect(hoverBlock).toContain("@media (hover: hover) and (pointer: fine)");
    expect(hoverBlock).toContain(":is(.chart-view-button, .series-toggle):not(:disabled):hover");
    expect(hoverBlock).toContain("#0a84ff");
    expect(hoverBlock).toContain("#ff765f");
    expect(hoverBlock).not.toContain("is-hovered");
  });

  it("выделяет верх security-карточки тематической, а не серой полосой", () => {
    expect(theme).toContain(".packet .access-create-card { align-content: start; border-top: 2px solid rgba(255, 118, 95, .72); }");
    expect(theme).toContain('html[data-audit-theme="light"] .packet .access-create-card { border-top-color: #0a84ff; }');
  });
});

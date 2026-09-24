import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const context = readFileSync(new URL("./AuditContext.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("общий выбор магазинов аналитики", () => {
  it("сохраняет один выбранный магазин или всю сеть вместе с периодом", () => {
    expect(context).toContain("selectedStores: string[]");
    expect(context).toContain("setSelectedStores: (value: string[]) => void");
    expect(context).toContain('const [selectedStores, setSelectedStoresState] = useState<string[]>(() => {');
    expect(context).toContain('localStorage.setItem("audit-stores", JSON.stringify(selectedStores));');
    expect(context).toContain("const setSelectedStores = (values: string[]) => setSelectedStoresState");
    expect(context).toContain("const normalizeStoreScope");
    expect(context).toContain(")).slice(0, 1)");
  });

  it("даёт selector всем аналитическим страницам, независимо от Excel-фактов", () => {
    expect(shell).toContain('className="analysis-store-scope"');
    expect(shell).toContain("МАГАЗИНЫ");
    expect(shell).toContain('<option value="">Все магазины</option>');
    expect(shell).toContain("selectedStores[0]");
    expect(shell).toContain("setSelectedStores(");
    expect(overrides).toContain(".packet .analysis-global-slice");
    expect(overrides).toContain(".packet .analysis-store-scope > select");
  });
});

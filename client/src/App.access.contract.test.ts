import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("начальный пароль магазина", () => {
  it("до замены начального пароля пропускает только профиль", () => {
    expect(app).toContain("function InitialPasswordGate");
    expect(app).toContain('const allowed = location === "/profile"');
    expect(app).toContain('if (!allowed) setLocation("/profile")');
    expect(app).toContain('if (session.data.mustChangePassword) return <InitialPasswordGate><Router /></InitialPasswordGate>');
  });

  it("ограничивает руководителя операционным контуром", () => {
    expect(app).toContain('const managerPaths = new Set(["/stock-control", "/inventory-control", "/requests", "/profile"])');
    expect(app).toContain('function ManagerRouteGate');
    expect(app).toContain('if (session.data.role === "manager") return <ManagerRouteGate><Router /></ManagerRouteGate>');
  });

  it("регистрирует отдельные маршруты остатков, ревизии, номенклатуры и заявок", () => {
    expect(app).toContain('<Route path="/stock-control" component={StockControl} />');
    expect(app).toContain('<Route path="/inventory-control" component={InventoryRegistry} />');
    expect(app).toContain('<Route path="/catalog-control" component={CatalogControl} />');
    expect(app).toContain('<Route path="/requests" component={StoreRequests} />');
  });
});

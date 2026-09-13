import { describe, expect, it } from "vitest";
import source from "./ErpRoadmap?raw";
import appSource from "../App.tsx?raw";
import shellSource from "../components/AuditShell.tsx?raw";

describe("ERP roadmap access", () => {
  it("exposes the roadmap as an authenticated shell page", () => {
    expect(appSource).toContain('path="/erp-roadmap" component={ErpRoadmap}');
    expect(shellSource).toContain('["/erp-roadmap","20","ERP-дорожная карта",false]');
  });

  it("keeps the roadmap operational and privacy boundaries explicit", () => {
    expect(source).toContain("финансовые факты, импорты, права и сессии остаются неизменными");
    expect(source).toContain("Персональные данные");
    expect(source).toContain("ручного подтверждения");
    expect(source).toContain("тестовая выгрузка без контактов покупателей");
  });
});

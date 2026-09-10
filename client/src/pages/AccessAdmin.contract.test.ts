import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const overrides=readFileSync(resolve(process.cwd(),"client/src/final-overrides.css"),"utf8");

describe("AccessAdmin dark theme contract",()=>{
  it("restores the first account card contour only outside the light theme",()=>{
    expect(overrides).toContain('html:not([data-audit-theme="light"]) .packet .account-list > .account-choice:first-child');
    expect(overrides).toContain("border-top: 1px solid rgba(255, 178, 162, .32)");
  });
});

describe("матрица доступа к импорту",()=>{
  it("содержит независимые уровни нет, загрузка и изменение",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Импорт Excel");
    expect(page).toContain(">Загрузка</button>");
    expect(page).toContain('importAccessLevel: "edit"');
  });
});

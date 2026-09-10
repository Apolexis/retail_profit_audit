import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./audit.ts", import.meta.url), "utf8");

describe("серверные права импорта", () => {
  it("проверяет загрузку, замену и удаление независимо от прав на магазин", () => {
    expect(router).toContain("async function requireImportPermission");
    expect(router).toContain('requireImportPermission(ctx.user.openId,"upload")');
    expect(router).toContain('input.resolution==="skip"?"upload":"edit"');
    expect(router).toContain('requireImportPermission(ctx.user.openId,"edit")');
    expect(router).toContain('downloadImport:protectedProcedure');
    expect(router).toContain('return getAuditImportDownload(input.importId)');
    expect(router).toContain('importMaterializationSettings:protectedProcedure');
    expect(router).toContain('updateImportMaterializationSettings:adminProcedure');
    expect(router).toContain("imports:protectedProcedure");
    expect(router).not.toContain("previewImport:adminProcedure");
    expect(router).not.toContain("deleteImport:adminProcedure");
  });
});

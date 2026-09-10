import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./ImportData.tsx", import.meta.url), "utf8");

describe("защищенный импорт", () => {
  it("показывает только статус конфигурации и два закрытых поля замены", () => {
    expect(page).toContain("importCredentialStatus");
    expect(page).toContain('type="password"');
    expect(page).toContain("Пароль открытия книги");
    expect(page).toContain("Пароль защиты листов и структуры (резерв)");
    expect(page).toContain("Оставьте пустым, чтобы не менять");
  });

  it("не выводит введенные пароли и очищает поля после сохранения", () => {
    expect(page).toContain("Пароль открытия скрыт");
    expect(page).toContain('setWorkbookPassword("")');
    expect(page).toContain('setUnprotectPassword("")');
    expect(page).not.toContain("console.log(workbookPassword)");
    expect(page).not.toContain("console.log(unprotectPassword)");
  });
});

describe("защита листов при чтении", () => {
  it("не обещает снятие защиты и не раскрывает сохраненные значения", () => {
    expect(page).toContain("чтение листов без снятия защиты");
    expect(page).toContain("не снимает защиту с листов и не изменяет исходную книгу");
  });
});

describe("уровни доступа к импорту", () => {
  it("оставляет загрузчику добавление новых дат и скрывает замену с удалением", () => {
    expect(page).toContain('const canUpload = importAccess === "upload" || importAccess === "edit"');
    expect(page).toContain('setResolution(canEditImport ? "preserve_manual" : "skip")');
    expect(page).toContain('canEditImport && <td className="import-row-actions">');
    expect(page).toContain('me.data?.role === "admin" && <section className="packet-card store-merge">');
  });

  it("показывает скачивание исходной книги только рядом с действием удаления", () => {
    expect(page).toContain("downloadImport");
    expect(page).toContain("Скачать исходник");
    expect(page).toContain("Скачивание возвращает точную исходную книгу");
    expect(page).toContain('canEditImport && <td className="import-row-actions">');
  });
});

describe("будущая материализация импорта", () => {
  it("объясняет особое распределение чистой прибыли и оставляет настройку только администратору", () => {
    expect(page).toContain("только при новом импорте");
    expect(page).toContain("она не делится поровну");
    expect(page).toContain("фактической дневной расходной нагрузке");
    expect(page).toContain("точным месячным итогом");
    expect(page).toContain("не меняет существующие факты");
    expect(page).toContain('me.data?.role === "admin" && <div className="materialization-picker"');
  });
});

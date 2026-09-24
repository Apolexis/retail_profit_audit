import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(import.meta.dirname, "OnecImportRegistry.tsx"), "utf8");
const shell = readFileSync(resolve(import.meta.dirname, "../components/AuditShell.tsx"), "utf8");
const app = readFileSync(resolve(import.meta.dirname, "../App.tsx"), "utf8");
const styles = readFileSync(resolve(import.meta.dirname, "../onec-import.css"), "utf8");

describe("страница изолированного импорта 1С", () => {
  it("разделяет срезы основных складов, закупочные цены, накладные и карантин", () => {
    expect(page).toContain("ОСТАТКИ ОСНОВНЫХ СКЛАДОВ");
    expect(page).toContain("ЗАКУПОЧНЫЕ ЦЕНЫ 1С");
    expect(page).toContain("Отдельный реестр до явного применения");
    expect(page).toContain("РАСХОДНЫЕ НАКЛАДНЫЕ");
    expect(page).toContain("КАРАНТИН СОПОСТАВЛЕНИЯ");
    expect(page).toContain("не меняет P&amp;L, Excel-факты, остатки магазинов");
  });

  it("применяет закупочную цену только по явному действию администратора", () => {
    expect(page).toContain("onecPurchaseCosts.useQuery");
    expect(page).toContain("applyOnecPurchaseCost.useMutation");
    expect(page).toContain("Строка 1С не меняет себестоимость сама");
    expect(page).toContain("Во внешнюю систему цена не передавалась");
    expect(page).toContain("Применить");
  });

  it("не выводит технические идентификаторы 1С", () => {
    expect(page).toContain("технический идентификатор 1С не показывается");
    expect(page).not.toContain("productSourceId");
    expect(page).not.toContain("destinationReference");
  });

  it("не выводит внутренние английские коды складов в операционном интерфейсе", () => {
    expect(page).toContain('const warehouseLabel = (code: string) => code === "BM" ? "Основной склад БМ" : code === "SRS" ? "Основной склад СРС" : "Основной склад"');
    expect(page).toContain("warehouseLabel(row.warehouseCode)");
    expect(page).toContain("warehouseLabel(row.originWarehouseCode)");
  });

  it("показывает срок только из явной партии и раскрывает состав накладной read-only", () => {
    expect(page).toContain("expirationText");
    expect(page).toContain("Не передан 1С");
    expect(page).toContain("onecShipmentLines.useQuery");
    expect(page).toContain("Партии и сроки");
    expect(page).toContain("Товары и срок годности");
    expect(page).toContain("shipmentLineRows");
  });

	it("дает только администратору прием и сопоставление", () => {
	  expect(page).toContain('const isAdmin = me.data?.role === "admin"');
    expect(page).toContain("Нет доступа к импорту 1С");
    expect(page).toContain("resolveOnecQuarantineProduct");
	  expect(page).toContain("resolveOnecShipmentDestination");
	});

  it("настраивает получателей рекомендаций БМ/СРС рядом с импортированными источниками, а не с печатью", () => {
    expect(page).toContain("onecWarehouseGroupMappings.useQuery");
    expect(page).toContain("setOnecWarehouseGroupMapping.useMutation");
    expect(page).toContain("Источники БМ и СРС");
    expect(page).toContain("Это не настройка печати");
    expect(page).toContain("не создаёт движение и не меняет фактический остаток");
    expect(styles).toContain(".packet .onec-warehouse-mapping-grid");
  });

	it("не оставляет ручную загрузку пакета и не публикует внутреннее ТЗ 1С", () => {
	  expect(page).toContain("Пакеты принимает только защищенный автоматический канал 1С");
	  expect(page).toContain("ЗАДАНИЕ РАЗРАБОТЧИКУ 1С");
	  expect(page).toContain("Внутреннее ТЗ не публикуется в исходном коде");
	  expect(page).not.toContain('href="/docs/1c-developer-export-task.md"');
	  expect(page).not.toContain("Выбрать JSON-пакет");
	  expect(page).not.toContain("Подтвердить ·");
	});

	it("оформляет явный показ текущего ключа как обычную тематическую кнопку", () => {
	  expect(page).toContain('className="subtle-button onec-reveal-current"');
	  expect(styles).toContain(".onec-reveal-current{border-radius:999px");
	});

	it("выводит длинный адрес приемника как переносимый текст, а не прокручиваемый input", () => {
	  expect(page).toContain('<output aria-label="Адрес приёмника 1С">');
	  expect(page).not.toContain('value={`${window.location.origin}/api/integrations/1c/import`} aria-label="Адрес приёмника 1С"');
	});

	it("зарегистрирована в маршрутах и административной навигации", () => {
    expect(app).toContain('path="/onec-import"');
    expect(shell).toContain('["/onec-import", "33", "Импорт 1С", true]');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journal = readFileSync(new URL("./ChangeLog.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("компактный журнал изменений", () => {
  it("показывает конкретную смену как цветное значение → значение без лишних слов", () => {
    expect(journal).toContain('className="audit-change-value before"');
    expect(journal).toContain('className="audit-change-value after"');
    expect(journal).not.toContain("<i>Было</i>");
    expect(journal).not.toContain("<i>Стало</i>");
    expect(overrides).toContain(".packet .audit-change-value {");
    expect(overrides).not.toContain(".packet .audit-change-value.before i");
  });

  it("не показывает технические идентификаторы у событий быстрого входа", () => {
    expect(journal).toContain('"passkey.register":"Быстрый вход включен"');
    expect(journal).toContain('"passkey.delete":"Быстрый вход отключен"');
    expect(journal).toContain("Ключ быстрого входа добавлен");
    expect(journal).toContain("Ключ быстрого входа удален");
  });

  it("ищет по всему журналу серверными порциями с явной догрузкой", () => {
    expect(journal).toContain('const CHANGE_LOG_PAGE_SIZE=50;');
    expect(journal).toContain('trpc.audit.changes.useQuery({limit:CHANGE_LOG_PAGE_SIZE,offset,search:deferredQuery||undefined,filter,range:isRangeApplied?range:undefined}');
    expect(journal).toContain('ЖУРНАЛ СОБЫТИЙ · ПО {CHANGE_LOG_PAGE_SIZE}');
    expect(journal).toContain('Показать еще');
    expect(journal).toContain('"weekly_report.delete":"Удаление сохраненной сводки"');
    expect(overrides).toContain('.packet .change-log-more');
    expect(journal).toContain('const [query,setQuery]=useState("")');
    expect(journal).toContain('const [filter,setFilter]=useState<ChangeFilter>("all")');
    expect(journal).toContain('className="packet-link compact notification-load-more change-log-more"');
    expect(journal).toContain('className="change-log-more-wrap"');
    expect(journal).toContain('Поиск и фильтр применяются ко всей истории; период ограничивает запись по времени МСК.');
    expect(journal).toContain('const deferredQuery=useDeferredValue(query.trim())');
  });

  it("ограничивает растущий журнал календарным периодом в МСК и дает вернуться ко всем датам", () => {
    expect(journal).toContain('const [range,setRange]=useState<DateRangeValue>(defaultChangeRange)');
    expect(journal).toContain('title="ПЕРИОД ЖУРНАЛА"');
    expect(journal).toContain('setIsRangeApplied(true)');
    expect(journal).toContain('Все даты');
    expect(journal).toContain('Период событий, МСК');
    expect(overrides).toContain('.packet .change-log-filters .change-log-period');
  });

  it("выравнивает пустой результат поиска по левому краю контента карточки", () => {
    expect(journal).toContain('className="change-log-empty"');
    expect(overrides).toContain('.packet .change-log.detailed > .change-log-empty { margin: 8px 4px 10px; padding: 0; }');
  });

  it("показывает изменения соответствий поставщиков в общем журнале с отдельным фильтром прайс‑контроля", () => {
    expect(journal).toContain('"price_alias.link":"Создание соответствия поставщика"');
    expect(journal).toContain('"price_alias.reassign":"Переназначение соответствия поставщика"');
    expect(journal).toContain('"price_alias.unlink":"Отмена соответствия поставщика"');
    expect(journal).toContain('<option value="price_control">Прайс‑контроль</option>');
    expect(journal).toContain('className="audit-change-summary audit-price-alias"');
    expect(journal).toContain('supplierProductName:"Название поставщика"');
    expect(overrides).toContain('.packet .audit-price-alias-context');
  });

  it("показывает в том же журнале все операции прайс‑контроля с понятными названиями и значениями до/после", () => {
    expect(journal).toContain('"price_product.update":"Изменение товара"');
    expect(journal).toContain('"price_product.variant_repair":"Восстановление вариантов товаров"');
    expect(journal).toContain('"price_category.update":"Изменение категории"');
    expect(journal).toContain('"price_supplier.update":"Изменение поставщика"');
    expect(journal).toContain('"price_import.commit":"Сохранение прайс‑листа"');
    expect(journal).toContain('"price_offer.update":"Изменение цены поставщика"');
    expect(journal).toContain('"price_product_characteristic.create":"Создание характеристики товара"');
    expect(journal).toContain('"price_product_characteristic.update":"Изменение характеристики товара"');
    expect(journal).toContain('"price_product.import_create":"Создание товаров при импорте"');
    expect(journal).toContain('"price_alias.import_link":"Создание соответствий при импорте"');
    expect(journal).toContain('categoryName:"Категория"');
    expect(journal).toContain('priceAmount:"Цена, ₽"');
    expect(journal).toContain('manufacturer:"Производитель"');
    expect(journal).toContain('placeContents:"Состав места"');
    expect(journal).toContain('productsUpdated:"Обновлено товаров"');
    expect(journal).toContain('repair:"Правило"');
    expect(journal).toContain('market:"Город / склад"');
    expect(journal).toContain('account:"Учетная запись"');
    expect(journal).toContain('value.toFixed(2)');
    expect(journal).toContain('audit-price-import-products');
    expect(journal).toContain('audit-price-import-product-list');
    expect(overrides).toContain('.packet .audit-price-import-product-list');
  });

  it("называет удаление выручки из рабочего реестра и его причину", () => {
    expect(journal).toContain('"operational_revenue.remove":"Удаление выручки из реестра"');
    expect(journal).toContain('voidReason:"Причина удаления"');
    expect(journal).toContain('correctionReason:"Причина изменения"');
  });

  it("показывает сохранение каталога и внутреннюю себестоимость в общем журнале операций", () => {
    expect(journal).toContain('"operational_catalog.evotor_confirm":"Сохранение номенклатуры Эвотор"');
    expect(journal).toContain('"operational_catalog.internal_cost.update":"Изменение внутренней себестоимости"');
    expect(journal).toContain('savedPositions:"Сохранено позиций"');
    expect(journal).toContain('costPricePolicy:"Правило себестоимости"');
    expect(journal).toContain('internalCostPrice:"Внутренняя себестоимость"');
  });
});

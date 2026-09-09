import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { inDateRange, isManualValueChange, materializeMonthlyDailyFacts, normalizeAuditName, parseWorkbook, shouldProtectManualMetric, wasManuallyEditedAfterImport } from "./audit";

const workbookWithSheet=(header:string[],total:number[])=>{const workbook=XLSX.utils.book_new();["tech-1","tech-2","tech-3"].forEach(name=>XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([[name]]),name));const sheet=XLSX.utils.aoa_to_sheet([["Январь"],header,[1,...total],["Итого",...total]]);sheet["AQ3"]={t:"n",v:17};sheet["!ref"]="A1:AQ4";XLSX.utils.book_append_sheet(workbook,sheet,"Новый магазин");return XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}) as Buffer};
const workbookWithDailyRows=(header:string[])=>{const first=header.slice(1).map(()=>0),second=header.slice(1).map(()=>0);first[0]=1000;second[0]=850;first[6]=1200;second[6]=1800;first[31]=3100;first[41]=700;const workbook=XLSX.utils.book_new();["tech-1","tech-2","tech-3"].forEach(name=>XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([[name]]),name));XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["Январь"],header,[1,...first],[2,...second],["Итого",...first]]),"Дневной магазин");return XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}) as Buffer};

describe("parseWorkbook",()=>{
  it("пропускает первые три листа и нормализует месячный блок с заголовками 2026",()=>{const header=["Дата","Остаток","З. Коп","З. Мор","П. Коп","П. Мор","Закупка","Продажа","% коп","% мор","% общий","Грязная","Выр нал","Б/нал","Общая","Списания К.","Списания М.","Перемещение","Уценка","Переоценка","Хоз. Нужды","Доставка","Уборка","Премия","Выслуга","Доплата","Водитель","Ком. Плат.","Расходы","Траты нал","Вод. Б/нал","Ком. Б/нал","Аренда","-% банк","Налоги","Зарпл. Б/нал","Налоги з/п","Отпускные","Налоги отпуск.","Зарпл. Нал","Отпуск. Нал","НДФЛ 22%","Итог"];const total=header.slice(1).map((_,index)=>index+10);const result=parseWorkbook(workbookWithSheet(header,total),"операционный_2026.xlsx");expect(result.year).toBe(2026);expect(result.stores).toEqual(["Новый магазин"]);expect(result.periods).toHaveLength(1);expect(result.periods[0]?.monthDate).toBe("2026-01");expect(result.periods[0]?.entryDate).toBe("2026-01-01");expect(result.periods[0]?.metrics).toEqual(expect.arrayContaining([{code:"revenue",amount:16},{code:"net_profit",amount:17},{code:"stock_open",amount:10}]));});
  it("сохраняет отличающуюся вторую колонку «Расходы» из книги 2025 отдельным кодом",()=>{const header=["Дата","Остаток","З. Коп","З. Мор","П. Коп","П. Мор","Закупка","Продажа","% коп","% мор","% общий","Грязная","Выр нал","б/нал","Общая","Списания К.","Списания М.","Перемещение","Уценка","Переоценка","Хоз. Нужды","Доставка","Уборка","Примия","Выслуга","Доплата","Водитель","Ком. Плат.","Расходы","Траты нал","Расходы","Ком. Б/нал","Аренда","-% банк","Налоги","Зарпл. б/нал","Зарпл. нал","НДФЛ 22%","Итог"];const total=header.slice(1).map((_,index)=>index+10);const result=parseWorkbook(workbookWithSheet(header,total),"учет_2025.xlsx");expect(result.year).toBe(2025);expect(result.periods[0]?.metrics).toEqual(expect.arrayContaining([{code:"bonus",amount:32},{code:"cashless_operating_costs",amount:39},{code:"personal_income_tax_22",amount:46}]));});
  it("сохраняет отдельные дневные строки и не заменяет продажи равномерным делением",()=>{const header=["Дата","Остаток","З. Коп","З. Мор","П. Коп","П. Мор","Закупка","Продажа","% коп","% мор","% общий","Грязная","Выр нал","Б/нал","Общая","Списания К.","Списания М.","Перемещение","Уценка","Переоценка","Хоз. Нужды","Доставка","Уборка","Премия","Выслуга","Доплата","Водитель","Ком. Плат.","Расходы","Траты нал","Вод. Б/нал","Ком. Б/нал","Аренда","-% банк","Налоги","Зарпл. Б/нал","Налоги з/п","Отпускные","Налоги отпуск.","Зарпл. Нал","Отпуск. Нал","НДФЛ 22%","Итог"];const result=parseWorkbook(workbookWithDailyRows(header),"учет_2026.xlsx");expect(result.periods).toHaveLength(2);expect(result.periods.map(row=>row.entryDate)).toEqual(["2026-01-01","2026-01-02"]);expect(result.periods[0]?.metrics).toEqual(expect.arrayContaining([{code:"revenue",amount:1200},{code:"net_profit",amount:700},{code:"stock_open",amount:1000}]));expect(result.periods[1]?.metrics).toEqual(expect.arrayContaining([{code:"revenue",amount:1800},{code:"stock_close",amount:850}]));});
  it("возвращает понятную ошибку по листу без распознаваемых месяцев",()=>{const workbook=XLSX.utils.book_new();["tech-1","tech-2","tech-3"].forEach(name=>XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([[name]]),name));XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["Сводный лист"]]),"Проблемный магазин");const result=parseWorkbook(XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}) as Buffer,"учет_2026.xlsx");expect(result.recognitionIssues).toEqual(expect.arrayContaining([{sheet:"Проблемный магазин",message:"Не найдены названия месяцев в колонке A."}]));});
});

describe("защита ручных правок при повторном импорте",()=>{
  it("защищает только изменение, сделанное после последней импортной записи",()=>{
    const importTime=new Date("2026-09-01T08:00:00.000Z");
    expect(wasManuallyEditedAfterImport(new Date("2026-09-01T08:00:01.000Z"),importTime)).toBe(true);
    expect(wasManuallyEditedAfterImport(importTime,importTime)).toBe(false);
    expect(wasManuallyEditedAfterImport(new Date("2026-08-31T23:59:59.000Z"),importTime)).toBe(false);
  });
  it("не принимает скрытие показателя за ручное изменение его суммы",()=>{
    expect(isManualValueChange("metric.update")).toBe(true);
    expect(isManualValueChange("metric.rollback")).toBe(true);
    expect(isManualValueChange("metric.visibility")).toBe(false);
  });
  it("сохраняет новую ручную сумму, но позволяет replace перезаписать ее",()=>{
    const importTime=new Date("2026-09-01T08:00:00.000Z");
    const manualTime=new Date("2026-09-01T08:01:00.000Z");
    expect(shouldProtectManualMetric("metric.update",manualTime,importTime)).toBe(true);
    expect(shouldProtectManualMetric("metric.update",importTime,importTime)).toBe(false);
    expect(shouldProtectManualMetric("metric.visibility",manualTime,importTime)).toBe(false);
  });
});

describe("календарный выбор импорта",()=>{
  it("включает только первичные дневные строки внутри выбранного календарного диапазона",()=>{
    expect(inDateRange("2026-09-01",{from:"2026-09-15",to:"2026-09-25"})).toBe(false);
    expect(inDateRange("2026-09-15",{from:"2026-09-15",to:"2026-09-25"})).toBe(true);
    expect(inDateRange("2026-09-25",{from:"2026-09-15",to:"2026-09-25"})).toBe(true);
    expect(inDateRange("2026-09-26",{from:"2026-09-15",to:"2026-09-25"})).toBe(false);
  });
});

describe("материализация ежемесячных статей в дневные факты",()=>{
  it("разносит только согласованные показатели, оставляя продажи и НДФЛ на исходной дате",()=>{
    const rows=materializeMonthlyDailyFacts([
      {store:"Точка",monthDate:"2026-01",entryDate:"2026-01-01",metrics:[{code:"revenue",amount:1000},{code:"rent",amount:310},{code:"net_profit",amount:155},{code:"personal_income_tax_22",amount:55}]},
      {store:"Точка",monthDate:"2026-01",entryDate:"2026-01-02",metrics:[{code:"revenue",amount:2000},{code:"rent",amount:0},{code:"net_profit",amount:0},{code:"personal_income_tax_22",amount:0}]},
    ]);
    const amount=(row:number,code:string)=>rows[row].metrics.find(metric=>metric.code===code)?.amount;
    expect(amount(0,"rent")).toBe(155);expect(amount(1,"rent")).toBe(155);
    expect(amount(0,"net_profit")).toBe(77.5);expect(amount(1,"net_profit")).toBe(77.5);
    expect(amount(0,"revenue")).toBe(1000);expect(amount(1,"revenue")).toBe(2000);
    expect(amount(0,"personal_income_tax_22")).toBe(55);expect(amount(1,"personal_income_tax_22")).toBe(0);
  });
});

describe("безопасные имена аналитических объектов",()=>{
  it("удаляет лишние пробелы перед проверкой дубликатов и сохранением",()=>{
    expect(normalizeAuditName("  Магазин   Север  ")).toBe("Магазин Север");
    expect(normalizeAuditName("   ")).toBe("");
  });
});

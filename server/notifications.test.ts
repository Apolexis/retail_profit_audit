import { describe, expect, it } from "vitest";
import { evaluateMetricAlert, shouldSendMobilePush } from "./notifications";

describe("пороги критических уведомлений", () => {
  it("немедленно отмечает отрицательную чистую прибыль", () => {
    expect(evaluateMetricAlert("net_profit", 1000, -1)).toMatchObject({ severity: "critical", reason: "чистая прибыль стала отрицательной" });
  });
  it("требует относительный и абсолютный порог для выручки", () => {
    expect(evaluateMetricAlert("revenue", 1000000, 1120000)).toBeNull();
    expect(evaluateMetricAlert("revenue", 1000000, 1300000)).toMatchObject({ severity: "warning" });
  });
  it("делает существенное изменение списаний М. критичным", () => {
    expect(evaluateMetricAlert("writeoff_frozen", 100000, 130000)).toMatchObject({ severity: "critical" });
  });
  it("не оповещает о несущественном изменении", () => {
    expect(evaluateMetricAlert("net_profit", 500000, 530000)).toBeNull();
  });
});

describe("телефонные push‑уведомления",()=>{
  it("отправляет только критичные сигналы, управленческие отчеты и явную администраторскую рассылку",()=>{
    expect(shouldSendMobilePush({severity:"critical"})).toBe(true);
    expect(shouldSendMobilePush({severity:"info",entityType:"weekly_report"})).toBe(true);
    expect(shouldSendMobilePush({severity:"info",entityType:"admin_broadcast"})).toBe(true);
    expect(shouldSendMobilePush({severity:"warning",entityType:"metric"})).toBe(false);
  });
});

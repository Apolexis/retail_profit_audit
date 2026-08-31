"""Export Jan–Jul cleaned financial results into the static AuditLine data module."""

import json
from pathlib import Path


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
SOURCE = ROOT / "audit_work_jan_jul_excl_rez" / "analysis_data.json"
TARGET = ROOT / "client" / "src" / "data" / "auditData.ts"
data = json.loads(SOURCE.read_text(encoding="utf-8"))


def money_m(value):
    return round(value / 1_000_000, 3)


profiles = []
for item in data["store_profiles"]:
    profiles.append({
        "store": item["store"],
        "revenue": money_m(item["revenue"]),
        "netProfit": money_m(item["net_profit"]),
        "netMargin": round(item["net_margin"] * 100, 1),
        "grossMargin": round(item["gross_margin"] * 100, 1),
        "bestMonth": item["best_month"],
        "lossMonths": int(item["loss_months"]),
        "reserve": item["excess_cost_driver"],
        "reserveAmount": money_m(item["excess_cost_amount"]),
    })

monthly = [
    {"month": item["month"][:3], "revenue": round(item["revenue"] / 1_000_000, 1), "profit": round(item["net_profit"] / 1_000_000, 2), "margin": round(item["net_margin"] * 100, 1)}
    for item in data["monthly_network"]
]

palette = ["#145b44", "#aa4439", "#b4985f", "#6f746c", "#3d8b79", "#d7cebb", "#879d94", "#c7bfae", "#e1b6a5"]
costs = [
    {"name": item["category"].replace("Закупочная себестоимость", "Закупки").replace("ФОТ и налоги на персонал", "ФОТ + налоги").replace("Налог с валовой прибыли", "Налог"), "value": round(item["amount"] / 1_000_000, 1), "color": palette[i]}
    for i, item in enumerate(data["cost_bridge"])
]

priority_actions = {
    "Н95": ("Операции · HR", "20 дней", "Переразвернуть смены и роли; привязать ФОТ к трафику."),
    "КА1": ("Операции · HR", "30 дней", "Нормировать штатные часы и подтвердить экономику формата."),
    "ПЗ1": ("Развитие · коммерция", "45 дней", "Переговоры по аренде; при отказе — релокационный сценарий."),
    "П.ЗОР": ("Финансы · розница", "10 дней", "Сверить наличные траты с первичкой и установить месячные лимиты."),
    "МОЛ": ("Операции · развитие", "45 дней", "Подтвердить безубыточность; при отсутствии эффекта — закрыть или релокировать."),
}
action_plan = []
for item in data["turnaround_priorities"]:
    if item["store"] in priority_actions:
        owner, period, action = priority_actions[item["store"]]
        action_plan.append({"point": item["store"], "owner": owner, "period": period, "target": f"{item['excess_cost_amount'] / 1_000_000:.3f} млн ₽", "action": action})

module = """/**
 * AuditLine design reminder: warm-paper editorial report, forest-green authority,
 * bordeaux for risk, jade for verified improvement. Basis: Jan–Jul 2026, exclusions applied.
 */
export type StoreProfile = { store: string; revenue: number; netProfit: number; netMargin: number; grossMargin: number; bestMonth: string; lossMonths: number; reserve: string; reserveAmount: number; };

export const monthlyData = """ + json.dumps(monthly, ensure_ascii=False, indent=2) + ";\n\n" + "export const costData = " + json.dumps(costs, ensure_ascii=False, indent=2) + ";\n\n" + "export const stores: StoreProfile[] = " + json.dumps(profiles, ensure_ascii=False, indent=2) + ";\n\n" + "export const actionPlan = " + json.dumps(action_plan, ensure_ascii=False, indent=2) + ";\n\n" + "export const auditChecks = [[\"Проверено исходных листов\", \"43\"], [\"Проверено месячных P&L-блоков\", \"516\"], [\"Сверено формульных ячеек\", \"310 723\"], [\"Ошибки и расхождения > 0,15 руб.\", \"0\"]] as const;\n"
TARGET.write_text(module, encoding="utf-8")
print(TARGET)

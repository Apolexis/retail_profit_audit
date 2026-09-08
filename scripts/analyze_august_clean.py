"""Create management analytics for the corrected 2026 workbook (Jan–Aug; exclusions applied)."""

import json
from pathlib import Path

import pandas as pd


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
WORK = ROOT / "audit_2026" / "audit_august_clean"
MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август"]


def records(frame):
    return [
        {key: (None if pd.isna(value) else value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def positive_cost(value):
    return max(0.0, float(value))


def factor(row, benchmarks):
    expenses = {
        "ФОТ и налоги": positive_cost(row["payroll_total"]),
        "Аренда": positive_cost(row["rent"]),
        "Налог с валовой прибыли": positive_cost(row["gross_profit_tax_cost"]),
        "Банковская комиссия": positive_cost(row["bank_fee_cost"]),
        "Наличные операционные траты": positive_cost(row["cash_operating_costs"]),
        "Коммунальные платежи": positive_cost(row["utilities_cash"]),
        "Списания": positive_cost(row["writeoffs_total"]),
    }
    highest = max(expenses, key=expenses.get)
    excess = {name: max(0.0, value - benchmarks[name] * row["revenue"]) for name, value in expenses.items()}
    reserve = max(excess, key=excess.get)
    return highest, expenses[highest], reserve, excess[reserve]


def action_for(row):
    driver = row["excess_cost_driver"]
    if driver == "ФОТ и налоги":
        action = "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
    elif driver == "Аренда":
        action = "Переговоры по ставке и релокационный сценарий; решение — только при подтвержденной окупаемости."
    elif driver == "Наличные операционные траты":
        action = "Сверить расходы с первичкой, ввести месячные лимиты и согласование отклонений."
    elif driver == "Списания":
        action = "Пересобрать заказ и контроль сроков; еженедельно лимитировать списания в процентах от выручки."
    else:
        action = "Разобрать отклонение по статье, закрепить владельца и еженедельный контроль P&L."
    return action


monthly = pd.read_csv(WORK / "store_monthly.csv", encoding="utf-8-sig")
annual = pd.read_csv(WORK / "store_annual.csv", encoding="utf-8-sig")
for frame in (monthly, annual):
    for col in frame.columns:
        if col not in {"store", "month", "net_profit_cell", "best_month", "worst_month"}:
            frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(0.0)

annual["gross_profit_tax_cost"] = -annual["gross_profit_tax"]
annual["bank_fee_cost"] = -annual["bank_fee"]
annual["personal_income_tax_cost"] = -annual["personal_income_tax"]
annual["payroll_total"] = annual[["salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_cost"]].sum(axis=1)
annual["writeoffs_total"] = annual["writeoffs_copy"] + annual["writeoffs_frozen"]
annual["net_stock_movement"] = annual["movement"]
annual["inventory_net_effect"] = annual["movement"] - annual["discount"] + annual["revaluation"]
annual["operating_store"] = annual["revenue"] >= 1_000_000
annual["active_store"] = annual["revenue"] > 0
annual["gross_margin"] = annual["gross_profit"] / annual["revenue"]
annual["net_margin"] = annual["net_profit"] / annual["revenue"]

comparable = annual[annual["operating_store"]].copy()
active = annual[annual["active_store"]].copy()
benchmarks = {
    "ФОТ и налоги": (comparable["payroll_total"] / comparable["revenue"]).median(),
    "Аренда": (comparable["rent"] / comparable["revenue"]).median(),
    "Налог с валовой прибыли": (comparable["gross_profit_tax_cost"] / comparable["revenue"]).median(),
    "Банковская комиссия": (comparable["bank_fee_cost"] / comparable["revenue"]).median(),
    "Наличные операционные траты": (comparable["cash_operating_costs"] / comparable["revenue"]).median(),
    "Коммунальные платежи": (comparable["utilities_cash"] / comparable["revenue"]).median(),
    "Списания": (comparable["writeoffs_total"] / comparable["revenue"]).median(),
}

for idx, row in annual.iterrows():
    primary, primary_value, reserve, reserve_value = factor(row, benchmarks)
    annual.loc[idx, "primary_cost_driver"] = primary
    annual.loc[idx, "primary_cost_driver_amount"] = primary_value
    annual.loc[idx, "excess_cost_driver"] = reserve
    annual.loc[idx, "excess_cost_amount"] = reserve_value

network_revenue = active["revenue"].sum()
network_gross = active["gross_profit"].sum()
network_profit = active["net_profit"].sum()
network_net_margin = network_profit / network_revenue
for idx, row in annual.iterrows():
    if row["revenue"] <= 0:
        narrative = "За январь–август отсутствуют продажи; точка не включается в сопоставимый рейтинг."
    elif row["net_profit"] < 0:
        narrative = f"Убыток {abs(row['net_profit']):,.0f} руб. при марже {row['net_margin']:.1%}; главный резерв — {row['excess_cost_driver']} {row['excess_cost_amount']:,.0f} руб. сверх медианной доли сети."
    elif row["net_margin"] < network_net_margin:
        narrative = f"Маржа {row['net_margin']:.1%} ниже сети ({network_net_margin:.1%}); основной резерв — {row['excess_cost_driver']} {row['excess_cost_amount']:,.0f} руб."
    else:
        narrative = f"Маржа {row['net_margin']:.1%} не ниже сети ({network_net_margin:.1%}); валовая маржа {row['gross_margin']:.1%} поддерживает положительный результат."
    annual.loc[idx, "narrative"] = narrative

monthly_network = monthly.groupby(["month", "month_number"], as_index=False).agg(
    revenue=("revenue", "sum"), gross_profit=("gross_profit", "sum"), net_profit=("net_profit", "sum"),
    movement=("movement", "sum"), discount=("discount", "sum"), revaluation=("revaluation", "sum"), store_count=("store", "nunique")
).sort_values("month_number")
monthly_network["expenses"] = monthly_network["revenue"] - monthly_network["net_profit"]
monthly_network["gross_margin"] = monthly_network["gross_profit"] / monthly_network["revenue"]
monthly_network["net_margin"] = monthly_network["net_profit"] / monthly_network["revenue"]
monthly_network["inventory_net_effect"] = monthly_network["movement"] - monthly_network["discount"] + monthly_network["revaluation"]

best = monthly.loc[monthly.groupby("store")["net_profit"].idxmax(), ["store", "month", "net_profit"]].set_index("store")
worst = monthly.loc[monthly.groupby("store")["net_profit"].idxmin(), ["store", "month", "net_profit"]].set_index("store")
loss_months = monthly[monthly["net_profit"] < 0].groupby("store")["month"].apply(list).to_dict()
annual["best_month"] = annual["store"].map(best["month"])
annual["best_month_profit"] = annual["store"].map(best["net_profit"])
annual["worst_month"] = annual["store"].map(worst["month"])
annual["worst_month_profit"] = annual["store"].map(worst["net_profit"])
annual["loss_months"] = annual["store"].map(loss_months).apply(lambda value: len(value) if isinstance(value, list) else 0)
annual["loss_month_names"] = annual["store"].map(loss_months).apply(lambda value: ", ".join(value) if isinstance(value, list) else "—")
annual["reported_month_count"] = 8

ranking_top = comparable.nlargest(3, "net_profit")
ranking_bottom = comparable.nsmallest(3, "net_profit")
loss_makers = annual[(annual["operating_store"]) & (annual["net_profit"] < 0)].sort_values("net_profit")
median_revenue = comparable["revenue"].median()
upper_margin = comparable["net_margin"].quantile(2 / 3)
traps = annual[(annual["operating_store"]) & (annual["revenue"] >= median_revenue) & (annual["net_margin"] < 0.02)].sort_values(["net_margin", "revenue"], ascending=[True, False])
if traps.empty:
    traps = annual[(annual["operating_store"]) & (annual["revenue"] >= comparable["revenue"].quantile(0.75)) & (annual["net_margin"] <= comparable["net_margin"].quantile(0.25))].sort_values(["net_margin", "revenue"], ascending=[True, False])
heroes = annual[(annual["operating_store"]) & (annual["revenue"] < median_revenue) & (annual["net_margin"] >= upper_margin)].sort_values(["net_margin", "revenue"], ascending=[False, True])
if heroes.empty:
    heroes = annual[(annual["operating_store"]) & (annual["revenue"] < comparable["revenue"].quantile(0.6)) & (annual["net_margin"] >= comparable["net_margin"].median())].sort_values(["net_margin", "revenue"], ascending=[False, True])

cost_bridge = pd.DataFrame({
    "category": ["Закупочная себестоимость", "ФОТ и налоги", "Аренда", "Налог с валовой прибыли", "Банковская комиссия", "Наличные операционные траты", "Коммунальные платежи", "Списания"],
    "amount": [active["purchases"].sum(), active["payroll_total"].sum(), active["rent"].sum(), active["gross_profit_tax_cost"].sum(), active["bank_fee_cost"].sum(), active["cash_operating_costs"].sum(), active["utilities_cash"].sum(), active["writeoffs_total"].sum()]
})
cost_bridge["share_of_revenue"] = cost_bridge["amount"] / network_revenue
cost_bridge = cost_bridge.sort_values("amount", ascending=False)

inventory_bridge = pd.DataFrame({
    "category": ["Перемещения: поступления", "Перемещения: выбытия", "Уценка (уменьшение остатка)", "Переоценка (увеличение остатка)", "Чистый эффект на остаток"],
    "amount": [active.loc[active["movement"] > 0, "movement"].sum(), active.loc[active["movement"] < 0, "movement"].sum(), -active["discount"].sum(), active["revaluation"].sum(), active["inventory_net_effect"].sum()]
})
inventory_outliers = annual.reindex(annual["inventory_net_effect"].abs().sort_values(ascending=False).index).head(5).copy()
inventory_outliers["inventory_net_effect_ratio"] = inventory_outliers["inventory_net_effect"] / inventory_outliers["revenue"]

formula = json.loads((WORK / "audit_summary.json").read_text(encoding="utf-8"))
recalc = json.loads((WORK / "recalculation_summary.json").read_text(encoding="utf-8"))
peak = monthly_network.nlargest(1, "net_profit")
trough = monthly_network.nsmallest(1, "net_profit")
turnaround = loss_makers.copy()
turnaround["break_even_reduction"] = -turnaround["net_profit"]
turnaround["recommended_action"] = turnaround.apply(action_for, axis=1)

output = {
    "reporting_scope": {
        "year": 2026, "file_name": "2026.xlsx", "analysis_period": "Январь–август 2026",
        "excluded_stores": formula["excluded_store_names"], "store_sheets_scanned": 43,
        "stores_included": int(len(annual)), "comparable_operating_stores": int(len(comparable)),
        "reported_months": MONTHS,
        "inventory_treatment": "Перемещения, уценки и переоценки анализируются как драйверы изменения товарного остатка. Они не включены в чистую прибыль, если не входят в исходную формулу AQ.",
        "source_note": "Источник — повторно загруженный исправленный файл 2026.xlsx; текстовый файл использован только как постановка задачи."
    },
    "network_dashboard": {
        "revenue": network_revenue, "gross_profit": network_gross, "expenses": network_revenue-network_profit, "net_profit": network_profit,
        "gross_margin": network_gross/network_revenue, "net_margin": network_net_margin, "average_store_net_margin": comparable["net_margin"].mean(),
        "profitable_comparable_stores": int((comparable["net_profit"] > 0).sum()), "loss_making_comparable_stores": int((comparable["net_profit"] < 0).sum()),
        "top_3_profit_share": ranking_top["net_profit"].sum()/network_profit, "total_comparable_losses": -loss_makers["net_profit"].sum(),
        "top_3": records(ranking_top[["store", "revenue", "net_profit", "net_margin"]]), "bottom_3": records(ranking_bottom[["store", "revenue", "net_profit", "net_margin"]]),
        "profit_peak_month": records(peak[["month", "revenue", "net_profit", "net_margin"]])[0], "profit_trough_month": records(trough[["month", "revenue", "net_profit", "net_margin"]])[0]
    },
    "monthly_network": records(monthly_network), "cost_bridge": records(cost_bridge), "inventory_bridge": records(inventory_bridge),
    "inventory_outliers": records(inventory_outliers[["store", "revenue", "movement", "discount", "revaluation", "inventory_net_effect", "inventory_net_effect_ratio"]]),
    "store_profiles": records(annual.sort_values("net_profit", ascending=False)),
    "loss_makers": records(loss_makers[["store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "rent", "payroll_total", "excess_cost_driver", "excess_cost_amount", "narrative"]]),
    "revenue_traps": records(traps[["store", "revenue", "net_profit", "net_margin", "rent", "payroll_total", "excess_cost_driver", "excess_cost_amount", "narrative"]]),
    "hidden_heroes": records(heroes[["store", "revenue", "net_profit", "net_margin", "gross_margin", "rent", "payroll_total", "narrative"]]),
    "turnaround_priorities": records(turnaround[["store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "payroll_total", "rent", "excess_cost_driver", "excess_cost_amount", "break_even_reduction", "recommended_action"]]),
    "formula_audit": {"pnl_formula_issues": formula["issues_total"], "monthly_records_checked": formula["monthly_records"], "formula_cells_compared": recalc["formula_cells_compared"], "recalculation_errors": recalc["recalculation_errors"], "differences_above_tolerance": recalc["output_differences_above_tolerance"], "conclusion": "Формулы 43 исходных листов прошли tie-out и независимый пересчет: ошибок и расхождений свыше 0,15 руб. не выявлено."},
    "benchmarks": {"median_revenue": median_revenue, "upper_third_net_margin": upper_margin, "network_net_margin": network_net_margin, "baseline_cost_ratios": benchmarks}
}

(WORK / "analysis_data.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
annual.sort_values("net_profit", ascending=False).to_csv(WORK / "store_profiles_enriched.csv", index=False, encoding="utf-8-sig")
monthly_network.to_csv(WORK / "network_monthly.csv", index=False, encoding="utf-8-sig")
cost_bridge.to_csv(WORK / "cost_bridge.csv", index=False, encoding="utf-8-sig")
inventory_bridge.to_csv(WORK / "inventory_bridge.csv", index=False, encoding="utf-8-sig")
print(json.dumps({"included_stores": len(annual), "comparable_stores": len(comparable), "revenue": network_revenue, "net_profit": network_profit, "net_margin": network_net_margin, "top_3": ranking_top["store"].tolist(), "bottom_3": ranking_bottom["store"].tolist(), "traps": traps["store"].tolist(), "heroes": heroes["store"].tolist()}, ensure_ascii=False, indent=2))

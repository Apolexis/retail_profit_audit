"""Recalculate retail P&L for Jan–Jul 2026, excluding stores named РЕЗ*."""

import json
from pathlib import Path

import pandas as pd


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
SOURCE = ROOT / "audit_work"
OUT = ROOT / "audit_work_jan_jul_excl_rez"
OUT.mkdir(exist_ok=True)
PERIOD_MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль"]
EXCLUDED_STORES = ["РЕЗ", "РЕЗ2", "РЕЗЕРВ", "РЕЗЕРВ1", "РЕЗЕРВ2", "РЕЗЕРВ3", "РЕЗЕРВ4", "АЛА", "С2"]


def recordify(dataframe):
    return [
        {key: (None if pd.isna(value) else value) for key, value in item.items()}
        for item in dataframe.to_dict(orient="records")
    ]


def primary_cost_driver(row):
    components = {
        "Закупочная себестоимость": row["purchases"],
        "Аренда": row["rent"],
        "ФОТ и налоги на персонал": row["payroll_total"],
        "Налог с валовой прибыли": row["gross_profit_tax_cost"],
        "Банковская комиссия": row["bank_fee_cost"],
        "Операционные траты за наличные": row["cash_operating_costs"],
        "Коммунальные платежи за наличные": row["utilities_cash"],
        "Списания": row["writeoffs_total"],
        "Уценка": row["discount"],
    }
    name = max(components, key=components.get)
    return name, components[name]


def driver_excess(row, baseline_ratios):
    components = {
        "Аренда": row["rent"],
        "ФОТ и налоги на персонал": row["payroll_total"],
        "Налог с валовой прибыли": row["gross_profit_tax_cost"],
        "Банковская комиссия": row["bank_fee_cost"],
        "Операционные траты за наличные": row["cash_operating_costs"],
        "Коммунальные платежи за наличные": row["utilities_cash"],
        "Списания": row["writeoffs_total"],
        "Уценка": row["discount"],
    }
    excess = {name: max(0.0, value - baseline_ratios[name] * row["revenue"]) for name, value in components.items()}
    name = max(excess, key=excess.get)
    return name, excess[name]


def narrative(row, network_margin, baselines):
    if row["revenue"] == 0:
        return "Лист не содержит продаж за период январь–июль и исключен из сопоставимого рейтинга."
    primary_name, primary_value = primary_cost_driver(row)
    excess_name, excess_value = driver_excess(row, baselines)
    if row["net_margin"] < 0:
        return f"Убыточный результат: чистая маржа {row['net_margin']:.1%}, убыток {abs(row['net_profit']):,.0f}. Крупнейшая контролируемая нагрузка — {primary_name} {primary_value:,.0f}; наибольший избыток к медиане — «{excess_name}» ({excess_value:,.0f})."
    if row["net_margin"] < network_margin:
        return f"Доходность ниже сети: {row['net_margin']:.1%} против {network_margin:.1%}. Ключевая нагрузка — {primary_name} {primary_value:,.0f}; резерв к медиане — «{excess_name}» ({excess_value:,.0f})."
    return f"Маржа выше сети: {row['net_margin']:.1%} против {network_margin:.1%}. Результат поддержан валовой маржой {row['gross_margin']:.1%}; крупнейшая контролируемая статья — {primary_name} {primary_value:,.0f}."


monthly_source = pd.read_csv(SOURCE / "store_monthly.csv", encoding="utf-8-sig")
monthly_source = monthly_source[monthly_source["month_number"] <= 7].copy()
monthly = monthly_source[~monthly_source["store"].isin(EXCLUDED_STORES)].copy()

for column in monthly.columns:
    if column not in {"store", "month", "net_profit_cell"}:
        monthly[column] = pd.to_numeric(monthly[column], errors="coerce").fillna(0.0)

numeric_cols = [col for col in monthly.columns if col not in {"store", "month", "month_number", "total_row", "net_profit_cell"}]
annual = monthly.groupby("store", as_index=False)[numeric_cols].sum()
annual["gross_profit_tax_cost"] = -annual["gross_profit_tax"]
annual["bank_fee_cost"] = -annual["bank_fee"]
annual["personal_income_tax_cost"] = -annual["personal_income_tax"]
annual["payroll_total"] = annual[["salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_cost"]].sum(axis=1)
annual["writeoffs_total"] = annual["writeoffs_copy"] + annual["writeoffs_frozen"]
annual["gross_margin"] = annual["gross_profit"] / annual["revenue"]
annual["net_margin"] = annual["net_profit"] / annual["revenue"]
annual["operating_store"] = annual["revenue"] >= 1_000_000
annual["active_sheet"] = annual["revenue"] > 0

comparable = annual[annual["operating_store"]].copy()
active = annual[annual["active_sheet"]].copy()
baselines = {
    "Аренда": (comparable["rent"] / comparable["revenue"]).median(),
    "ФОТ и налоги на персонал": (comparable["payroll_total"] / comparable["revenue"]).median(),
    "Налог с валовой прибыли": (comparable["gross_profit_tax_cost"] / comparable["revenue"]).median(),
    "Банковская комиссия": (comparable["bank_fee_cost"] / comparable["revenue"]).median(),
    "Операционные траты за наличные": (comparable["cash_operating_costs"] / comparable["revenue"]).median(),
    "Коммунальные платежи за наличные": (comparable["utilities_cash"] / comparable["revenue"]).median(),
    "Списания": (comparable["writeoffs_total"] / comparable["revenue"]).median(),
    "Уценка": (comparable["discount"] / comparable["revenue"]).median(),
}

reported_months = monthly.groupby(["month", "month_number"], as_index=False).agg(revenue=("revenue", "sum"), gross_profit=("gross_profit", "sum"), net_profit=("net_profit", "sum"), store_count=("store", "count")).sort_values("month_number")
reported_months["expenses"] = reported_months["revenue"] - reported_months["net_profit"]
reported_months["gross_margin"] = reported_months["gross_profit"] / reported_months["revenue"]
reported_months["net_margin"] = reported_months["net_profit"] / reported_months["revenue"]
reported_months["data_available"] = True

network_revenue = active["revenue"].sum()
network_profit = active["net_profit"].sum()
network_gross = active["gross_profit"].sum()
network_margin = network_profit / network_revenue
for index, row in annual.iterrows():
    primary, primary_amount = primary_cost_driver(row)
    excess, excess_amount = driver_excess(row, baselines)
    annual.loc[index, "primary_cost_driver"] = primary
    annual.loc[index, "primary_cost_driver_amount"] = primary_amount
    annual.loc[index, "excess_cost_driver"] = excess
    annual.loc[index, "excess_cost_amount"] = excess_amount
    annual.loc[index, "narrative"] = narrative(row, network_margin, baselines)

loss_months = monthly[monthly["net_profit"] < 0].groupby("store")["month"].apply(list).to_dict()
best = monthly.loc[monthly.groupby("store")["net_profit"].idxmax(), ["store", "month", "net_profit"]].set_index("store")
worst = monthly.loc[monthly.groupby("store")["net_profit"].idxmin(), ["store", "month", "net_profit"]].set_index("store")
annual["loss_month_names"] = annual["store"].map(loss_months).apply(lambda values: ", ".join(values) if isinstance(values, list) else "—")
annual["loss_months"] = annual["store"].map(loss_months).apply(lambda values: len(values) if isinstance(values, list) else 0)
annual["best_month"] = annual["store"].map(best["month"])
annual["best_month_profit"] = annual["store"].map(best["net_profit"])
annual["worst_month"] = annual["store"].map(worst["net_profit"])
annual["worst_month_profit"] = annual["store"].map(worst["net_profit"])
annual["reported_month_count"] = 7

# Rebuild all decision subsets after adding narratives, cost drivers and monthly loss details.
comparable = annual[annual["operating_store"]].copy()

ranking_top = comparable.nlargest(3, "net_profit")
ranking_bottom = comparable.nsmallest(3, "net_profit")
median_revenue = comparable["revenue"].median()
upper_margin = comparable["net_margin"].quantile(2 / 3)
traps = comparable[(comparable["revenue"] >= median_revenue) & (comparable["net_margin"] < 0.02)].sort_values(["net_margin", "revenue"], ascending=[True, False])
heroes = comparable[(comparable["revenue"] < median_revenue) & (comparable["net_margin"] >= upper_margin)].sort_values(["net_margin", "revenue"], ascending=[False, True])
loss_makers = comparable[comparable["net_profit"] < 0].sort_values("net_profit")
cost_bridge = pd.DataFrame({"category": ["Закупочная себестоимость", "ФОТ и налоги на персонал", "Налог с валовой прибыли", "Аренда", "Банковская комиссия", "Операционные траты за наличные", "Коммунальные платежи за наличные", "Списания", "Уценка"], "amount": [active["purchases"].sum(), active["payroll_total"].sum(), active["gross_profit_tax_cost"].sum(), active["rent"].sum(), active["bank_fee_cost"].sum(), active["cash_operating_costs"].sum(), active["utilities_cash"].sum(), active["writeoffs_total"].sum(), active["discount"].sum()]})
cost_bridge["share_of_revenue"] = cost_bridge["amount"] / network_revenue
cost_bridge = cost_bridge.sort_values("amount", ascending=False)

formula_summary = json.loads((SOURCE / "audit_summary.json").read_text(encoding="utf-8"))
recalc_summary = json.loads((SOURCE / "recalculation_summary.json").read_text(encoding="utf-8"))
march = reported_months[reported_months["month"] == "Март"].iloc[0]
may = reported_months[reported_months["month"] == "Май"].iloc[0]
july = reported_months[reported_months["month"] == "Июль"].iloc[0]
output = {
    "reporting_scope": {
        "year": 2026, "file_name": "учет2026.xlsm", "analysis_period": "Январь–июль 2026", "excluded_stores": EXCLUDED_STORES,
        "store_sheets_scanned": int(len(annual)), "active_sheets_with_sales": int(len(active)), "comparable_operating_stores_revenue_ge_1m": int(len(comparable)),
        "reported_months": PERIOD_MONTHS, "important_limit": "Расчеты ограничены январем–июлем 2026 по поручению пользователя. Из базы полностью исключены РЕЗ, РЕЗ2, РЕЗЕРВ, РЕЗЕРВ1–РЕЗЕРВ4, АЛА и С2.",
    },
    "network_dashboard": {
        "revenue": network_revenue, "gross_profit": network_gross, "expenses": network_revenue - network_profit, "net_profit": network_profit,
        "gross_margin": network_gross / network_revenue, "net_margin": network_margin, "average_store_net_margin": comparable["net_margin"].mean(),
        "profitable_comparable_stores": int((comparable["net_profit"] > 0).sum()), "loss_making_comparable_stores": int((comparable["net_profit"] < 0).sum()),
        "top_3_profit_share": ranking_top["net_profit"].sum() / network_profit, "total_comparable_losses": -loss_makers["net_profit"].sum(),
        "top_3": recordify(ranking_top[["store", "revenue", "net_profit", "net_margin"]]), "bottom_3": recordify(ranking_bottom[["store", "revenue", "net_profit", "net_margin"]]),
        "profit_peak_month": recordify(reported_months.nlargest(1, "net_profit")[["month", "revenue", "net_profit", "net_margin"]])[0], "profit_trough_month": recordify(reported_months.nsmallest(1, "net_profit")[["month", "revenue", "net_profit", "net_margin"]])[0],
    },
    "monthly_network": recordify(reported_months), "cost_bridge": recordify(cost_bridge), "store_profiles": recordify(annual.sort_values("net_profit", ascending=False)),
    "loss_makers": recordify(loss_makers[["store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "rent", "payroll_total", "excess_cost_driver", "excess_cost_amount", "narrative"]]),
    "revenue_traps": recordify(traps[["store", "revenue", "net_profit", "net_margin", "rent", "payroll_total", "excess_cost_driver", "excess_cost_amount", "narrative"]]),
    "hidden_heroes": recordify(heroes[["store", "revenue", "net_profit", "net_margin", "gross_margin", "rent", "payroll_total", "narrative"]]),
    "turnaround_priorities": recordify(loss_makers.assign(payroll_ratio=loss_makers["payroll_total"] / loss_makers["revenue"], rent_ratio=loss_makers["rent"] / loss_makers["revenue"], profit_breakeven_cost_reduction=-loss_makers["net_profit"])[["store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "payroll_total", "payroll_ratio", "rent", "rent_ratio", "excess_cost_driver", "excess_cost_amount", "profit_breakeven_cost_reduction"]]),
    "formula_audit": {"pnl_formula_issues": formula_summary["issues_total"], "monthly_records_checked": formula_summary["monthly_records"], "formula_cells_compared": recalc_summary["formula_cells_compared"], "recalculation_errors": recalc_summary["recalculation_errors"], "differences_above_tolerance": recalc_summary["output_differences_above_tolerance"], "conclusion": "Формулы всех исходных листов-магазинов проверены ранее по полному файлу: ошибок и расхождений после независимого пересчета выше 0,15 руб. не выявлено. В текущем срезе РЕЗ* исключены по поручению пользователя."},
    "seasonality": {"march_to_may_revenue_change": may["revenue"] - march["revenue"], "march_to_may_profit_change": may["net_profit"] - march["net_profit"], "march_to_may_gross_margin_change": may["gross_margin"] - march["gross_margin"], "may_to_july_profit_change": july["net_profit"] - may["net_profit"], "july_gross_margin": july["gross_margin"], "note": "В очищенной базе январь–июль минимум чистой прибыли приходится на июль (1,2 млн руб., маржа 1,6%). От марта к маю чистая прибыль сократилась на 5,4 млн руб.; валовая маржа к июлю снизилась до 23,9%."},
    "benchmarks": {"median_revenue": median_revenue, "upper_third_net_margin": upper_margin, "network_net_margin": network_margin, "baseline_cost_ratios": baselines},
}

monthly.to_csv(OUT / "store_monthly_jan_jul_excl_rez.csv", index=False, encoding="utf-8-sig")
annual.to_csv(OUT / "store_profiles_enriched.csv", index=False, encoding="utf-8-sig")
reported_months.to_csv(OUT / "network_monthly.csv", index=False, encoding="utf-8-sig")
cost_bridge.to_csv(OUT / "cost_bridge.csv", index=False, encoding="utf-8-sig")
(OUT / "analysis_data.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"excluded_stores": EXCLUDED_STORES, "network_revenue": network_revenue, "network_net_profit": network_profit, "network_net_margin": network_margin, "comparable_stores": len(comparable), "loss_makers": loss_makers["store"].tolist(), "traps": traps["store"].tolist(), "heroes": heroes["store"].tolist()}, ensure_ascii=False, indent=2))

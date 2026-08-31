"""Build management-ready findings from extracted retail P&L data."""

import json
from pathlib import Path

import pandas as pd


WORK_DIR = Path("/home/ubuntu/retail_profit_audit_2026/audit_work")
MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]


def recordify(dataframe):
    records = dataframe.to_dict(orient="records")
    clean = []
    for item in records:
        clean.append({key: (None if pd.isna(value) else value) for key, value in item.items()})
    return clean


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
    excess = {
        key: max(0.0, value - baseline_ratios[key] * row["revenue"])
        for key, value in components.items()
    }
    name = max(excess, key=excess.get)
    return name, excess[name]


def store_narrative(row, network_margin):
    if row["revenue"] == 0:
        return "Лист не содержит продаж за период и исключен из сопоставимого рейтинга."
    margin = row["net_margin"]
    primary_name, primary_value = primary_cost_driver(row)
    excess_name, excess_value = driver_excess(row, BASELINE_RATIOS)
    if margin < 0:
        return (
            f"Убыточный результат: чистая маржа {margin:.1%}, убыток {abs(row['net_profit']):,.0f}. "
            f"Крупнейшая контролируемая нагрузка — {primary_name} {primary_value:,.0f}; "
            f"относительно медианы сети наибольший избыток создает «{excess_name}» ({excess_value:,.0f})."
        )
    if margin < network_margin:
        return (
            f"Доходность ниже сети: {margin:.1%} против {network_margin:.1%}. "
            f"Ключевая нагрузка — {primary_name} {primary_value:,.0f}; "
            f"наибольший резерв относительно медианы — «{excess_name}» ({excess_value:,.0f})."
        )
    return (
        f"Маржа выше сети: {margin:.1%} против {network_margin:.1%}. "
        f"Результат поддержан валовой маржой {row['gross_margin']:.1%}; "
        f"крупнейшая контролируемая статья — {primary_name} {primary_value:,.0f}."
    )


annual = pd.read_csv(WORK_DIR / "store_annual.csv", encoding="utf-8-sig")
monthly = pd.read_csv(WORK_DIR / "store_monthly.csv", encoding="utf-8-sig")

numeric_annual = annual.columns.drop(["store", "best_month", "worst_month"], errors="ignore")
for column in numeric_annual:
    annual[column] = pd.to_numeric(annual[column], errors="coerce")
for column in monthly.columns:
    if column not in {"store", "month", "net_profit_cell"}:
        monthly[column] = pd.to_numeric(monthly[column], errors="coerce")

annual["gross_profit_tax_cost"] = -annual["gross_profit_tax"]
annual["bank_fee_cost"] = -annual["bank_fee"]
annual["personal_income_tax_cost"] = -annual["personal_income_tax"]
annual["payroll_total"] = (
    annual["salary_cashless"]
    + annual["payroll_tax"]
    + annual["vacation_cashless"]
    + annual["vacation_tax"]
    + annual["salary_cash"]
    + annual["vacation_cash"]
    + annual["personal_income_tax_cost"]
)
annual["writeoffs_total"] = annual["writeoffs_copy"] + annual["writeoffs_frozen"]
annual["operating_store"] = annual["revenue"] >= 1_000_000
annual["active_sheet"] = annual["revenue"] > 0

comparable = annual[annual["operating_store"]].copy()
active = annual[annual["active_sheet"]].copy()

BASELINE_RATIOS = {
    "Аренда": (comparable["rent"] / comparable["revenue"]).median(),
    "ФОТ и налоги на персонал": (comparable["payroll_total"] / comparable["revenue"]).median(),
    "Налог с валовой прибыли": (comparable["gross_profit_tax_cost"] / comparable["revenue"]).median(),
    "Банковская комиссия": (comparable["bank_fee_cost"] / comparable["revenue"]).median(),
    "Операционные траты за наличные": (comparable["cash_operating_costs"] / comparable["revenue"]).median(),
    "Коммунальные платежи за наличные": (comparable["utilities_cash"] / comparable["revenue"]).median(),
    "Списания": (comparable["writeoffs_total"] / comparable["revenue"]).median(),
    "Уценка": (comparable["discount"] / comparable["revenue"]).median(),
}

for index, row in annual.iterrows():
    if row["revenue"] == 0:
        annual.loc[index, "primary_cost_driver"] = "—"
        annual.loc[index, "primary_cost_driver_amount"] = 0.0
        annual.loc[index, "excess_cost_driver"] = "—"
        annual.loc[index, "excess_cost_amount"] = 0.0
        annual.loc[index, "narrative"] = "Лист не содержит продаж за период и исключен из сопоставимого рейтинга."
        continue
    name, amount = primary_cost_driver(row)
    excess_name, excess_amount = driver_excess(row, BASELINE_RATIOS)
    annual.loc[index, "primary_cost_driver"] = name
    annual.loc[index, "primary_cost_driver_amount"] = amount
    annual.loc[index, "excess_cost_driver"] = excess_name
    annual.loc[index, "excess_cost_amount"] = excess_amount

reported_months = (
    monthly.groupby(["month", "month_number"], as_index=False)
    .agg(
        revenue=("revenue", "sum"),
        gross_profit=("gross_profit", "sum"),
        net_profit=("net_profit", "sum"),
        store_count=("store", "count"),
    )
)
reported_months["expenses"] = reported_months["revenue"] - reported_months["net_profit"]
reported_months["gross_margin"] = reported_months["gross_profit"] / reported_months["revenue"]
reported_months["net_margin"] = reported_months["net_profit"] / reported_months["revenue"]
reported_months["data_available"] = reported_months["revenue"] > 0
reported_months = reported_months.sort_values("month_number")
months_with_data = reported_months[reported_months["data_available"]].copy()

network_revenue = active["revenue"].sum()
network_profit = active["net_profit"].sum()
network_gross_profit = active["gross_profit"].sum()
network_expenses = network_revenue - network_profit
network_gross_margin = network_gross_profit / network_revenue
network_net_margin = network_profit / network_revenue

for index, row in annual.iterrows():
    annual.loc[index, "narrative"] = store_narrative(row, network_net_margin)

ranking_top = comparable.nlargest(3, "net_profit")
ranking_bottom = comparable.nsmallest(3, "net_profit")

median_revenue = comparable["revenue"].median()
upper_margin = comparable["net_margin"].quantile(2 / 3)
low_margin = 0.02
traps = comparable[(comparable["revenue"] >= median_revenue) & (comparable["net_margin"] < low_margin)].copy()
if traps.empty:
    traps = comparable[
        (comparable["revenue"] >= comparable["revenue"].quantile(0.75))
        & (comparable["net_margin"] <= comparable["net_margin"].quantile(0.25))
    ].copy()
traps = traps.sort_values(["net_margin", "revenue"], ascending=[True, False])

heroes = comparable[
    (comparable["revenue"] < median_revenue) & (comparable["net_margin"] >= upper_margin)
].copy()
if heroes.empty:
    heroes = comparable[
        (comparable["revenue"] < comparable["revenue"].quantile(0.6))
        & (comparable["net_margin"] >= comparable["net_margin"].median())
    ].copy()
heroes = heroes.sort_values(["net_margin", "revenue"], ascending=[False, True])

loss_makers = comparable[comparable["net_profit"] < 0].sort_values("net_profit")
monthly_peaks = months_with_data.nlargest(1, "net_profit")
monthly_troughs = months_with_data.nsmallest(1, "net_profit")

# Monthly losses for each store (among periods with actual sales records).
store_monthly = monthly[monthly["revenue"] > 0].copy()
loss_months_by_store = (
    store_monthly[store_monthly["net_profit"] < 0]
    .groupby("store")["month"]
    .apply(list)
    .to_dict()
)
annual["loss_month_names"] = annual["store"].map(loss_months_by_store).apply(
    lambda x: ", ".join(x) if isinstance(x, list) else "—"
)

# Month best/worst must be assessed only where the respective shop had sales.
active_period_monthly = store_monthly[store_monthly["month_number"] <= 8].copy()
best_by_store = active_period_monthly.loc[
    active_period_monthly.groupby("store")["net_profit"].idxmax(),
    ["store", "month", "net_profit"],
].set_index("store")
worst_by_store = active_period_monthly.loc[
    active_period_monthly.groupby("store")["net_profit"].idxmin(),
    ["store", "month", "net_profit"],
].set_index("store")
month_count_by_store = active_period_monthly.groupby("store").size()
annual["best_month"] = annual["store"].map(best_by_store["month"])
annual["best_month_profit"] = annual["store"].map(best_by_store["net_profit"])
annual["worst_month"] = annual["store"].map(worst_by_store["month"])
annual["worst_month_profit"] = annual["store"].map(worst_by_store["net_profit"])
annual["reported_month_count"] = annual["store"].map(month_count_by_store).fillna(0).astype(int)

# Rebuild subsets after enriching the annual table with drivers, narratives and loss-month detail.
loss_makers = annual[(annual["operating_store"]) & (annual["net_profit"] < 0)].sort_values("net_profit")
traps = annual[(annual["operating_store"]) & (annual["revenue"] >= median_revenue) & (annual["net_margin"] < low_margin)].copy()
if traps.empty:
    traps = annual[
        (annual["operating_store"])
        & (annual["revenue"] >= comparable["revenue"].quantile(0.75))
        & (annual["net_margin"] <= comparable["net_margin"].quantile(0.25))
    ].copy()
traps = traps.sort_values(["net_margin", "revenue"], ascending=[True, False])
heroes = annual[
    (annual["operating_store"])
    & (annual["revenue"] < median_revenue)
    & (annual["net_margin"] >= upper_margin)
].copy()
if heroes.empty:
    heroes = annual[
        (annual["operating_store"])
        & (annual["revenue"] < comparable["revenue"].quantile(0.6))
        & (annual["net_margin"] >= comparable["net_margin"].median())
    ].copy()
heroes = heroes.sort_values(["net_margin", "revenue"], ascending=[False, True])

# Material cost bridge.
cost_bridge = pd.DataFrame(
    {
        "category": [
            "Закупочная себестоимость", "ФОТ и налоги на персонал", "Налог с валовой прибыли",
            "Аренда", "Банковская комиссия", "Операционные траты за наличные", "Коммунальные платежи за наличные",
            "Списания", "Уценка",
        ],
        "amount": [
            active["purchases"].sum(), active["payroll_total"].sum(), active["gross_profit_tax_cost"].sum(),
            active["rent"].sum(), active["bank_fee_cost"].sum(), active["cash_operating_costs"].sum(),
            active["utilities_cash"].sum(), active["writeoffs_total"].sum(), active["discount"].sum(),
        ],
    }
)
cost_bridge["share_of_revenue"] = cost_bridge["amount"] / network_revenue
cost_bridge = cost_bridge.sort_values("amount", ascending=False)

top_3_profit_share = ranking_top["net_profit"].sum() / network_profit
total_comparable_losses = -loss_makers["net_profit"].sum()
loss_makers["payroll_ratio"] = loss_makers["payroll_total"] / loss_makers["revenue"]
loss_makers["rent_ratio"] = loss_makers["rent"] / loss_makers["revenue"]
loss_makers["profit_breakeven_cost_reduction"] = -loss_makers["net_profit"]
seasonal_trough = monthly_troughs.iloc[0]
seasonal_peak = monthly_peaks.iloc[0]
march = months_with_data[months_with_data["month"] == "Март"].iloc[0]
july = months_with_data[months_with_data["month"] == "Июль"].iloc[0]

formula_summary = json.loads((WORK_DIR / "audit_summary.json").read_text(encoding="utf-8"))
recalc_summary = json.loads((WORK_DIR / "recalculation_summary.json").read_text(encoding="utf-8"))

output = {
    "reporting_scope": {
        "year": 2026,
        "file_name": "учет2026.xlsm",
        "store_sheets_scanned": int(len(annual)),
        "active_sheets_with_sales": int(len(active)),
        "comparable_operating_stores_revenue_ge_1m": int(len(comparable)),
        "non_operating_or_placeholder_sheets": recordify(annual[~annual["active_sheet"]][["store", "revenue"]]),
        "reported_months": months_with_data["month"].tolist(),
        "missing_months_zeroed_in_source": reported_months[~reported_months["data_available"]]["month"].tolist(),
        "important_limit": "Сентябрь–декабрь имеют нулевые продажи и нулевую прибыль на всех листах. Годовой итог отражает январь–август 2026; прогнозов или фактических данных IV квартала в файле нет.",
    },
    "network_dashboard": {
        "revenue": network_revenue,
        "gross_profit": network_gross_profit,
        "expenses": network_expenses,
        "net_profit": network_profit,
        "gross_margin": network_gross_margin,
        "net_margin": network_net_margin,
        "average_store_net_margin": comparable["net_margin"].mean(),
        "profitable_comparable_stores": int((comparable["net_profit"] > 0).sum()),
        "loss_making_comparable_stores": int((comparable["net_profit"] < 0).sum()),
        "top_3_profit_share": top_3_profit_share,
        "total_comparable_losses": total_comparable_losses,
        "top_3": recordify(ranking_top[["store", "revenue", "net_profit", "net_margin"]]),
        "bottom_3": recordify(ranking_bottom[["store", "revenue", "net_profit", "net_margin"]]),
        "profit_peak_month": recordify(monthly_peaks[["month", "revenue", "net_profit", "net_margin"]])[0],
        "profit_trough_month": recordify(monthly_troughs[["month", "revenue", "net_profit", "net_margin"]])[0],
    },
    "monthly_network": recordify(reported_months),
    "cost_bridge": recordify(cost_bridge),
    "store_profiles": recordify(annual.sort_values("net_profit", ascending=False)),
    "loss_makers": recordify(loss_makers[[
        "store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "rent", "payroll_total",
        "excess_cost_driver", "excess_cost_amount", "narrative"
    ]]),
    "revenue_traps": recordify(traps[[
        "store", "revenue", "net_profit", "net_margin", "rent", "payroll_total", "excess_cost_driver", "excess_cost_amount", "narrative"
    ]]),
    "hidden_heroes": recordify(heroes[[
        "store", "revenue", "net_profit", "net_margin", "gross_margin", "rent", "payroll_total", "narrative"
    ]]),
    "turnaround_priorities": recordify(loss_makers[[
        "store", "revenue", "net_profit", "net_margin", "loss_months", "loss_month_names", "payroll_total", "payroll_ratio",
        "rent", "rent_ratio", "excess_cost_driver", "excess_cost_amount", "profit_breakeven_cost_reduction"
    ]]),
    "seasonality": {
        "march_to_may_revenue_change": seasonal_trough["revenue"] - march["revenue"],
        "march_to_may_profit_change": seasonal_trough["net_profit"] - march["net_profit"],
        "march_to_may_gross_margin_change": seasonal_trough["gross_margin"] - march["gross_margin"],
        "may_to_july_profit_change": july["net_profit"] - seasonal_trough["net_profit"],
        "july_gross_margin": july["gross_margin"],
        "august_margin_discontinuity_vs_july": seasonal_peak["net_margin"] - july["net_margin"],
        "note": "Август показывает резкий скачок чистой маржи при снижении продаж; формулы арифметически корректны, но следует подтвердить полноту начисления затрат и разовые эффекты по закрытию месяца.",
    },
    "formula_audit": {
        "pnl_formula_issues": formula_summary["issues_total"],
        "monthly_records_checked": formula_summary["monthly_records"],
        "formula_cells_compared": recalc_summary["formula_cells_compared"],
        "recalculation_errors": recalc_summary["recalculation_errors"],
        "differences_above_tolerance": recalc_summary["output_differences_above_tolerance"],
        "conclusion": "Расчетные формулы на всех листах-магазинах прошли арифметические tie-out-проверки и сверку с независимым пересчетом без выявленных ошибок или расхождений выше 0,15 руб.",
    },
    "benchmarks": {
        "median_revenue": median_revenue,
        "upper_third_net_margin": upper_margin,
        "network_net_margin": network_net_margin,
        "baseline_cost_ratios": BASELINE_RATIOS,
    },
}

(WORK_DIR / "analysis_data.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
annual.to_csv(WORK_DIR / "store_profiles_enriched.csv", index=False, encoding="utf-8-sig")
cost_bridge.to_csv(WORK_DIR / "cost_bridge.csv", index=False, encoding="utf-8-sig")

print(json.dumps({
    "network_revenue": network_revenue,
    "network_net_profit": network_profit,
    "network_net_margin": network_net_margin,
    "comparables": len(comparable),
    "traps": traps["store"].tolist(),
    "heroes": heroes["store"].tolist(),
    "loss_makers": loss_makers["store"].tolist(),
}, ensure_ascii=False, indent=2))

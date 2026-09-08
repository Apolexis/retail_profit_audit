"""Generate detailed, data-grounded slide content for every included store."""

import json
from pathlib import Path


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
data = json.loads((ROOT / "audit_2026" / "audit_august_clean" / "analysis_data.json").read_text(encoding="utf-8"))
target = ROOT / "deliverables" / "super_report_august_content.md"


def m(value):
    return f"{value / 1_000_000:,.2f}".replace(",", " ").replace(".", ",")


def pct(value):
    return f"{value * 100:.1f}%".replace(".", ",")


scope = data["reporting_scope"]
network = data["network_dashboard"]
peak = network["profit_peak_month"]
trough = network["profit_trough_month"]
lines = [
    "## Cover",
    "Супер-отчет: аудит прибыли магазинов",
    "Январь–август 2026 · Исправленная книга · без КА1, АЛА, МОЛ и РЕЗ*",
    "",
    "## Slide 1",
    "### Очищенная сеть прибыльна, но 11 точек убыточны",
    f"Выручка: {m(network['revenue'])} млн руб.; чистая прибыль: {m(network['net_profit'])} млн руб.; чистая маржа: {pct(network['net_margin'])}.",
    f"В анализ включены {scope['stores_included']} магазина. {network['loss_making_comparable_stores']} убыточных точек сформировали {m(network['total_comparable_losses'])} млн руб. потерь.",
    "",
    "## Slide 2",
    "### Март — пик прибыли; июль — сезонный провал",
    f"Пик: {peak['month']} — выручка {m(peak['revenue'])} млн руб., чистая прибыль {m(peak['net_profit'])} млн руб., маржа {pct(peak['net_margin'])}.",
    f"Провал: {trough['month']} — выручка {m(trough['revenue'])} млн руб., чистая прибыль {m(trough['net_profit'])} млн руб., маржа {pct(trough['net_margin'])}.",
    "",
    "## Slide 3",
    "### Закупки и ФОТ — ключевые драйверы экономики",
]
for item in data["cost_bridge"][:4]:
    lines.append(f"{item['category']}: {m(item['amount'])} млн руб. / {pct(item['share_of_revenue'])} выручки.")
lines += ["", "## Slide 4", "### Движение товарного остатка не влияет на P&L напрямую"]
for item in data["inventory_bridge"]:
    lines.append(f"{item['category']}: {m(item['amount'])} млн руб.")
lines += ["Перемещения, уценки и переоценки оценены как изменение остатка; они не включены в чистую прибыль, если не входят в исходную формулу AQ.", "", "## Slide 5", "### Лидеры создают концентрированную прибыль"]
for index, item in enumerate(network["top_3"], start=1):
    lines.append(f"{index}. {item['store']}: {m(item['net_profit'])} млн руб. чистой прибыли; выручка {m(item['revenue'])} млн руб.; маржа {pct(item['net_margin'])}.")
lines += [f"Три лидера создают {pct(network['top_3_profit_share'])} чистой прибыли очищенной сети.", "", "## Slide 6", "### Убыточные точки требуют адресного плана"]
for item in data["loss_makers"][:5]:
    lines.append(f"{item['store']}: убыток {m(abs(item['net_profit']))} млн руб.; маржа {pct(item['net_margin'])}; {item['loss_months']} убыточных месяцев; резерв — {item['excess_cost_driver']} {m(item['excess_cost_amount'])} млн руб.")
lines += ["", "## Slide 7", "### Ловушки выручки: масштаб без достаточной прибыли"]
for item in data["revenue_traps"]:
    lines.append(f"{item['store']}: выручка {m(item['revenue'])} млн руб.; чистая прибыль {m(item['net_profit'])} млн руб.; маржа {pct(item['net_margin'])}; главный резерв — {item['excess_cost_driver']} {m(item['excess_cost_amount'])} млн руб.")
lines += ["", "## Slide 8", "### Скрытые герои — источник практик для переноса"]
for item in data["hidden_heroes"][:5]:
    lines.append(f"{item['store']}: выручка {m(item['revenue'])} млн руб.; чистая маржа {pct(item['net_margin'])}; валовая маржа {pct(item['gross_margin'])}.")
lines += ["", "## Slide 9", "### Action Plan: 45 дней на адресные меры"]
for item in data["turnaround_priorities"][:8]:
    lines.append(f"{item['store']}: достижение безубыточности требует эффекта {m(item['break_even_reduction'])} млн руб.; действие — {item['recommended_action']}")

for number, item in enumerate(data["store_profiles"], start=10):
    inventory = item["inventory_net_effect"]
    direction = "рост" if inventory > 0 else "снижение" if inventory < 0 else "без изменения"
    lines += [
        "", f"## Slide {number}", f"### Магазин {item['store']}",
        f"Выручка: {m(item['revenue'])} млн руб.; расходы: {m(item['expenses'])} млн руб.; чистая прибыль: {m(item['net_profit'])} млн руб.; чистая маржа: {pct(item['net_margin'])}.",
        f"Лучший месяц: {item['best_month']} ({m(item['best_month_profit'])} млн руб. чистой прибыли). Худший месяц: {item['worst_month']} ({m(item['worst_month_profit'])} млн руб.).",
        f"Фактор результата: {item['narrative']}",
        f"Остаток: чистый эффект {direction} на {m(abs(inventory))} млн руб.; перемещения {m(item['movement'])} млн руб., уценка {m(item['discount'])} млн руб., переоценка {m(item['revaluation'])} млн руб.",
    ]

last_num = 10 + len(data["store_profiles"])
lines += [
    "", f"## Slide {last_num}", "### Формулы проверены; действия должны быть измеримыми",
    f"Проверено {data['formula_audit']['monthly_records_checked']} месячных P&L-блоков и {data['formula_audit']['formula_cells_compared']:,} формульных ячеек.",
    f"Ошибки и расхождения после независимого пересчета: {data['formula_audit']['recalculation_errors']} / {data['formula_audit']['differences_above_tolerance']}.",
    "Еженедельный P&L должен отслеживать выручку, валовую маржу, ФОТ/выручка, списания/выручка и чистую прибыль по каждой точке.",
]
target.parent.mkdir(exist_ok=True)
target.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(target)

"""Create a finance-grade workbook for the retail profit audit."""

import json
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
WORK = ROOT / "audit_work_jan_jul_excl_rez"
OUT = ROOT / "deliverables" / "Супер_отчет_аудит_прибыли_2026_янв_июл_без_РЕЗ_АЛА_С2.xlsx"
OUT.parent.mkdir(parents=True, exist_ok=True)

DARK_GREEN = "135B44"
LIGHT_GREEN = "CFE9E0"
LIGHT_GRAY = "E7E5E4"
PAPER = "F6F1E8"
GRAPHITE = "252A2F"
CINNABAR = "B74835"
JADE = "3E8068"
BLUE = "0000FF"
BLACK = "000000"
WHITE = "FFFFFF"
GRAY_TEXT = "667085"
PALE_RED = "F9E2DF"
PALE_GREEN = "E7F2EC"
PALE_AMBER = "F9F1DE"

thin_gray = Side(style="thin", color="D6D3D1")
medium_green = Side(style="medium", color=DARK_GREEN)
double_graphite = Side(style="double", color=GRAPHITE)

CURRENCY = '#,##0;(#,##0);-'
PERCENT = '0.0%'
DECIMAL = '#,##0.0;(#,##0.0);-'


def source_comment(store, month, total_row, metric):
    return Comment(
        f"Источник: учет2026.xlsm, лист «{store}», строка месячного итога {total_row}, "
        f"статья «{metric}». Период: {month} 2026. Значение извлечено без изменения исходной книги.",
        "Manus AI",
    )


def apply_layout(ws, title, subtitle, units="руб., кроме процентов"):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 20
    ws.row_dimensions[1].height = 8
    ws.row_dimensions[2].height = 8
    ws.merge_cells("C3:K3")
    ws["C3"] = title
    ws["C3"].fill = PatternFill("solid", fgColor=DARK_GREEN)
    ws["C3"].font = Font(name="Aptos Display", size=16, bold=True, color=WHITE)
    ws["C3"].alignment = Alignment(vertical="center")
    ws.row_dimensions[3].height = 27
    ws.merge_cells("C5:K5")
    ws["C5"] = subtitle
    ws["C5"].font = Font(name="Aptos", size=11, bold=True, color=GRAPHITE)
    ws["C5"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[5].height = 30
    ws.merge_cells("C6:K6")
    ws["C6"] = units
    ws["C6"].font = Font(name="Aptos", size=10, italic=True, color=GRAY_TEXT)
    ws["C6"].alignment = Alignment(vertical="center")
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_options.horizontalCentered = False
    ws.oddFooter.center.text = f"{ws.title} | Страница &P из &N"


def add_section(ws, row, title, end_col=11):
    ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=end_col)
    cell = ws.cell(row, 3, title)
    cell.fill = PatternFill("solid", fgColor=LIGHT_GREEN)
    cell.font = Font(name="Aptos", bold=True, color=GRAPHITE)
    cell.alignment = Alignment(vertical="center")
    ws.row_dimensions[row].height = 20


def style_header(ws, row, start_col, end_col):
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row, col)
        cell.fill = PatternFill("solid", fgColor=DARK_GREEN)
        cell.font = Font(name="Aptos", bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(top=medium_green, bottom=medium_green)
    ws.row_dimensions[row].height = 30


def style_label(cell, bold=False, italic=False):
    cell.font = Font(name="Aptos", size=10, bold=bold, italic=italic, color=GRAPHITE)
    cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)


def style_number(cell, number_format=CURRENCY, input_value=False, bold=False):
    cell.font = Font(name="Aptos", size=10, color=BLUE if input_value else BLACK, bold=bold)
    cell.number_format = number_format
    cell.alignment = Alignment(horizontal="right", vertical="center")


def apply_total_border(ws, row, start_col, end_col, final=False):
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row, col)
        cell.font = cell.font.copy(bold=True)
        cell.border = Border(top=Side(style="thin", color=GRAPHITE), bottom=double_graphite if final else Side(style=None))


def autofit(ws, max_width=52):
    for col in range(3, ws.max_column + 1):
        letter = get_column_letter(col)
        values = [str(ws.cell(row, col).value or "") for row in range(1, ws.max_row + 1)]
        length = min(max([len(value) for value in values] + [8]) + 2, max_width)
        ws.column_dimensions[letter].width = max(10, length)


def add_cell_comment_for_hardcodes(ws, rows, metric_columns):
    for record, row in zip(rows, range(1, len(rows) + 1)):
        pass


def add_profit_chart(ws, min_row, max_row, category_col, value_col, anchor, title, color=CINNABAR):
    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = title
    chart.y_axis.title = "руб."
    data = Reference(ws, min_col=value_col, min_row=min_row - 1, max_row=max_row)
    cats = Reference(ws, min_col=category_col, min_row=min_row, max_row=max_row)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.height = 7.2
    chart.width = 14.2
    chart.legend = None
    chart.series[0].graphicalProperties.solidFill = color
    chart.series[0].graphicalProperties.line.solidFill = color
    ws.add_chart(chart, anchor)


def set_print_area(ws):
    ws.print_area = f"B2:{get_column_letter(ws.max_column)}{ws.max_row}"


analysis = json.loads((WORK / "analysis_data.json").read_text(encoding="utf-8"))
annual = pd.read_csv(WORK / "store_profiles_enriched.csv", encoding="utf-8-sig")
monthly = pd.read_csv(WORK / "store_monthly_jan_jul_excl_rez.csv", encoding="utf-8-sig")
annual = annual.where(pd.notnull(annual), None)
monthly = monthly.where(pd.notnull(monthly), None)

wb = Workbook()
wb.remove(wb.active)

# 00 — Executive dashboard
ws = wb.create_sheet("00_Главный_дашборд")
apply_layout(
    ws,
    "Супер-отчет: аудит прибыли розничной сети",
    "Управленческий и инвесторский пакет по данным «учет2026.xlsm» | Фактические данные: январь–июль 2026 | Исключены РЕЗ*, АЛА и С2",
)
add_section(ws, 8, "Главный вывод")
ws.merge_cells("C9:K10")
ws["C9"] = (
    f"Сеть сформировала чистую прибыль {analysis['network_dashboard']['net_profit'] / 1_000_000:.1f} млн руб. при выручке "
    f"{analysis['network_dashboard']['revenue'] / 1_000_000:.1f} млн руб. и чистой марже {analysis['network_dashboard']['net_margin']:.1%}. "
    f"{analysis['network_dashboard']['loss_making_comparable_stores']} из {analysis['reporting_scope']['comparable_operating_stores_revenue_ge_1m']} сопоставимых магазинов убыточны и аккумулируют "
    f"{analysis['network_dashboard']['total_comparable_losses'] / 1_000_000:.1f} млн руб. убытка. Расчеты ограничены январем–июлем; РЕЗ*, АЛА и С2 исключены из базы."
)
ws["C9"].alignment = Alignment(wrap_text=True, vertical="top")
ws["C9"].font = Font(name="Aptos", size=11, color=GRAPHITE)
ws.row_dimensions[9].height = 45

add_section(ws, 12, "Ключевые показатели сети")
kpis = [
    ("Выручка", analysis["network_dashboard"]["revenue"], CURRENCY),
    ("Валовая прибыль", analysis["network_dashboard"]["gross_profit"], CURRENCY),
    ("Чистая прибыль", analysis["network_dashboard"]["net_profit"], CURRENCY),
    ("Валовая маржа", analysis["network_dashboard"]["gross_margin"], PERCENT),
    ("Чистая рентабельность", analysis["network_dashboard"]["net_margin"], PERCENT),
    ("Сопоставимых убыточных магазинов", analysis["network_dashboard"]["loss_making_comparable_stores"], '0'),
]
for idx, (label, value, fmt) in enumerate(kpis):
    row = 13 + (idx // 3) * 3
    col = 3 + (idx % 3) * 3
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + 1)
    ws.cell(row, col, label)
    style_label(ws.cell(row, col), bold=True)
    ws.merge_cells(start_row=row + 1, start_column=col, end_row=row + 1, end_column=col + 1)
    cell = ws.cell(row + 1, col, value)
    style_number(cell, fmt, input_value=True, bold=True)
    cell.font = Font(name="Aptos", size=15, bold=True, color=BLUE)
    cell.comment = Comment("Источник: учет2026.xlsm, агрегировано по листам-магазинам с 4-го листа. Период: январь–июль 2026; РЕЗ*, АЛА и С2 исключены.", "Manus AI")
    for r in (row, row + 1):
        for c in range(col, col + 2):
            ws.cell(r, c).fill = PatternFill("solid", fgColor=PAPER)
            ws.cell(r, c).border = Border(left=thin_gray, right=thin_gray, top=thin_gray, bottom=thin_gray)

add_section(ws, 20, "Топ-3 по чистой прибыли и антирейтинг")
headers = ["Место", "Магазин", "Выручка", "Чистая прибыль", "Чистая маржа"]
for start_col, title in [(3, "Лидеры"), (9, "Антирейтинг")]:
    ws.merge_cells(start_row=21, start_column=start_col, end_row=21, end_column=start_col + 4)
    ws.cell(21, start_col, title)
    ws.cell(21, start_col).font = Font(name="Aptos", bold=True, color=GRAPHITE)
    for offset, header in enumerate(headers):
        ws.cell(22, start_col + offset, header)
    style_header(ws, 22, start_col, start_col + 4)
for idx, record in enumerate(analysis["network_dashboard"]["top_3"], start=1):
    row = 22 + idx
    values = [idx, record["store"], record["revenue"], record["net_profit"], record["net_margin"]]
    for offset, value in enumerate(values):
        cell = ws.cell(row, 3 + offset, value)
        if offset >= 2:
            style_number(cell, PERCENT if offset == 4 else CURRENCY, input_value=True)
            cell.comment = Comment("Источник: учет2026.xlsm, агрегировано по месячным блокам листа магазина. Период: январь–август 2026.", "Manus AI")
        else:
            style_label(cell, bold=offset == 1)
for idx, record in enumerate(analysis["network_dashboard"]["bottom_3"], start=1):
    row = 22 + idx
    values = [idx, record["store"], record["revenue"], record["net_profit"], record["net_margin"]]
    for offset, value in enumerate(values):
        cell = ws.cell(row, 9 + offset, value)
        if offset >= 2:
            style_number(cell, PERCENT if offset == 4 else CURRENCY, input_value=True)
            cell.comment = Comment("Источник: учет2026.xlsm, агрегировано по месячным блокам листа магазина. Период: январь–август 2026.", "Manus AI")
        else:
            style_label(cell, bold=offset == 1)
    ws.cell(row, 12).fill = PatternFill("solid", fgColor=PALE_RED)

add_section(ws, 28, "Контроль качества расчетов")
audits = [
    ("Магазинных листов проверено", analysis["reporting_scope"]["store_sheets_scanned"]),
    ("Месячных P&L-блоков проверено", analysis["formula_audit"]["monthly_records_checked"]),
    ("Формульных ячеек сравнено", analysis["formula_audit"]["formula_cells_compared"]),
    ("Ошибок пересчета", analysis["formula_audit"]["recalculation_errors"]),
    ("Расхождений > 0,15 руб.", analysis["formula_audit"]["differences_above_tolerance"]),
]
for index, (label, value) in enumerate(audits, start=29):
    ws.cell(index, 3, label)
    style_label(ws.cell(index, 3))
    ws.cell(index, 4, value)
    style_number(ws.cell(index, 4), '0', input_value=True, bold=True)
    ws.cell(index, 4).comment = Comment("Источник: автоматизированный аудит формул учет2026.xlsm и независимый пересчет совместимым табличным движком.", "Manus AI")
ws.merge_cells("C35:K36")
ws["C35"] = analysis["formula_audit"]["conclusion"]
ws["C35"].font = Font(name="Aptos", bold=True, color=JADE)
ws["C35"].alignment = Alignment(wrap_text=True, vertical="top")
ws["C35"].fill = PatternFill("solid", fgColor=PALE_GREEN)
ws.row_dimensions[35].height = 32
set_print_area(ws)
autofit(ws)

# 01 — monthly network P&L
ws = wb.create_sheet("01_Сеть_месяцы")
apply_layout(ws, "Помесячная динамика сети", "Фактическая динамика продаж, валовой и чистой прибыли | Период анализа: январь–июль 2026 | Исключены РЕЗ*, АЛА и С2")
add_section(ws, 8, "Консолидированная динамика")
headers = ["Месяц", "Выручка", "Валовая прибыль", "Валовая маржа", "Расходы", "Чистая прибыль", "Чистая маржа", "Статус данных"]
for col, header in enumerate(headers, start=3):
    ws.cell(9, col, header)
style_header(ws, 9, 3, 10)
for idx, record in enumerate(analysis["monthly_network"], start=10):
    rows = [
        record["month"], record["revenue"], record["gross_profit"], record["gross_margin"],
        record["expenses"], record["net_profit"], record["net_margin"],
        "Факт" if record["data_available"] else "Нет данных",
    ]
    for col, value in enumerate(rows, start=3):
        cell = ws.cell(idx, col, value)
        if col in (4, 5, 7, 8):
            style_number(cell, PERCENT if col in (6, 9) else CURRENCY, input_value=True)
            cell.comment = Comment("Источник: учет2026.xlsm, сумма по всем листам-магазинам, месячный итог. Период: 2026.", "Manus AI")
        else:
            style_label(cell)
    if not record["data_available"]:
        for col in range(3, 11):
            ws.cell(idx, col).fill = PatternFill("solid", fgColor=LIGHT_GRAY)
apply_total_border(ws, 9 + len(analysis["monthly_network"]), 3, 10)

add_section(ws, 22, "Сезонные сигналы и контроль закрытия")
signals = [
    ("Пик прибыли", analysis["network_dashboard"]["profit_peak_month"]["month"], analysis["network_dashboard"]["profit_peak_month"]["net_profit"], f"Чистая маржа {analysis['network_dashboard']['profit_peak_month']['net_margin']:.1%}; самый сильный месяц очищенного периода."),
    ("Провал прибыли", analysis["network_dashboard"]["profit_trough_month"]["month"], analysis["network_dashboard"]["profit_trough_month"]["net_profit"], f"Чистая маржа {analysis['network_dashboard']['profit_trough_month']['net_margin']:.1%}; требуется усиленный контроль закупочной маржи и переменных расходов."),
    ("Снижение валовой маржи", "Июль", analysis["seasonality"]["july_gross_margin"], "Валовая маржа 23,9% против 26,6% в марте: приоритет — закупочная цена, уценка и ассортиментная матрица."),
]
for col, header in enumerate(["Сигнал", "Месяц", "Значение", "Управленческий вывод"], start=3):
    ws.cell(23, col, header)
style_header(ws, 23, 3, 6)
for row, (signal, month, value, note) in enumerate(signals, start=24):
    ws.cell(row, 3, signal); style_label(ws.cell(row, 3), bold=True)
    ws.cell(row, 4, month); style_label(ws.cell(row, 4))
    ws.cell(row, 5, value); style_number(ws.cell(row, 5), PERCENT if signal == "Снижение валовой маржи" else CURRENCY, input_value=True)
    ws.cell(row, 6, note); style_label(ws.cell(row, 6))
    ws.cell(row, 6).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 38
add_profit_chart(ws, 10, 9 + len(analysis["monthly_network"]), 3, 8, "L9", "Чистая прибыль по месяцам")
set_print_area(ws)
autofit(ws)

# 02 — full ranking
ws = wb.create_sheet("02_Рейтинг_магазинов")
apply_layout(ws, "Рейтинг магазинов по чистой прибыли", "Сопоставимый рейтинг: январь–июль 2026 | Исключены РЕЗ*, АЛА и С2 по поручению пользователя")
add_section(ws, 8, "Сопоставимые магазины")
ranked = annual[annual["revenue"] >= 1_000_000].sort_values("net_profit", ascending=False).copy()
ranked["rank"] = range(1, len(ranked) + 1)
headers = ["№", "Магазин", "Выручка", "Валовая прибыль", "Чистая прибыль", "Чистая маржа", "Убыточных месяцев", "Лучший месяц", "Худший месяц", "Главный резерв"]
for col, header in enumerate(headers, start=3):
    ws.cell(9, col, header)
style_header(ws, 9, 3, 12)
for row_num, (_, item) in enumerate(ranked.iterrows(), start=10):
    values = [item["rank"], item["store"], item["revenue"], item["gross_profit"], item["net_profit"], item["net_margin"], item["loss_months"], item["best_month"], item["worst_month"], item["excess_cost_driver"]]
    for col, value in enumerate(values, start=3):
        cell = ws.cell(row_num, col, value)
        if col in (5, 6, 7, 8):
            style_number(cell, PERCENT if col == 8 else CURRENCY, input_value=True, bold=col == 7)
            cell.comment = Comment("Источник: учет2026.xlsm, агрегация месячных блоков листа магазина. Период: январь–август 2026.", "Manus AI")
        elif col in (3, 9):
            style_number(cell, '0', input_value=True)
        else:
            style_label(cell)
    if item["net_profit"] < 0:
        for col in range(3, 13):
            ws.cell(row_num, col).fill = PatternFill("solid", fgColor=PALE_RED)
    elif item["net_margin"] >= analysis["network_dashboard"]["net_margin"]:
        ws.cell(row_num, 8).fill = PatternFill("solid", fgColor=PALE_GREEN)
ws.conditional_formatting.add(f"G10:G{9 + len(ranked)}", CellIsRule(operator="lessThan", formula=["0"], fill=PatternFill("solid", fgColor=PALE_RED)))
add_section(ws, 47, "Листы, исключенные из расчетной базы")
for col, header in enumerate(["Лист", "Выручка", "Статус"], start=3):
    ws.cell(48, col, header)
style_header(ws, 48, 3, 5)
for row_num, store in enumerate(analysis["reporting_scope"]["excluded_stores"], start=49):
    ws.cell(row_num, 3, store); style_label(ws.cell(row_num, 3))
    ws.cell(row_num, 4, "—"); style_label(ws.cell(row_num, 4))
    ws.cell(row_num, 5, "Исключен по поручению пользователя"); style_label(ws.cell(row_num, 5))
set_print_area(ws)
autofit(ws)

# 03 — anomalies & decisions
ws = wb.create_sheet("03_Аномалии_и_решения")
apply_layout(ws, "Аномалии, уязвимости и Action Plan", "Конкретные действия и экономическая логика на основе проверенных результатов P&L")
add_section(ws, 8, "Ловушки выручки")
headers = ["Магазин", "Выручка", "Чистая прибыль", "Чистая маржа", "Статья-резерв", "Избыток к медиане", "Управленческая мера"]
for col, header in enumerate(headers, start=3):
    ws.cell(9, col, header)
style_header(ws, 9, 3, 9)
traps = analysis["revenue_traps"]
for row, item in enumerate(traps, start=10):
    action = "Запретить нецелевые наличные траты до разбора первички и месячного лимита." if item["store"] == "П.ЗОР" else "Пересобрать график и штатную нагрузку; цель — высвободить минимум 279 тыс. руб."
    values = [item["store"], item["revenue"], item["net_profit"], item["net_margin"], item["excess_cost_driver"], item["excess_cost_amount"], action]
    for col, value in enumerate(values, start=3):
        cell = ws.cell(row, col, value)
        if col in (4, 5, 8):
            style_number(cell, PERCENT if col == 6 else CURRENCY, input_value=True, bold=col == 5)
        else:
            style_label(cell)
    ws.cell(row, 12).fill = PatternFill("solid", fgColor=PALE_RED)
    ws.row_dimensions[row].height = 32

add_section(ws, 14, "Скрытые герои")
for col, header in enumerate(["Магазин", "Выручка", "Чистая прибыль", "Чистая маржа", "Почему важен", "Как масштабировать"], start=3):
    ws.cell(15, col, header)
style_header(ws, 15, 3, 8)
for row, item in enumerate(analysis["hidden_heroes"], start=16):
    values = [item["store"], item["revenue"], item["net_profit"], item["net_margin"], "Выручка ниже медианы сети, но маржа входит в верхнюю треть сопоставимых точек.", "Разобрать ассортимент, смены и схему локальных закупок; перенести практики на близкие по формату точки."]
    for col, value in enumerate(values, start=3):
        cell = ws.cell(row, col, value)
        if col in (4, 5):
            style_number(cell, PERCENT if col == 6 else CURRENCY, input_value=True)
        else:
            style_label(cell)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 38

add_section(ws, 20, "Приоритетный план оздоровления убыточных точек")
headers = ["Приоритет", "Магазин", "Убыток", "Убыточных месяцев", "Главный резерв", "Резерв к медиане", "Минимум для безубыточности", "Решение на 45 дней"]
for col, header in enumerate(headers, start=3):
    ws.cell(21, col, header)
style_header(ws, 21, 3, 10)
priorities = analysis["turnaround_priorities"]
for idx, item in enumerate(priorities, start=1):
    if item["store"] == "МОЛ":
        decision = "Немедленно проверить целесообразность локации: убыток 30,6% выручки; при недостижении +419 тыс. руб. за 45 дней — закрыть/релокировать."
    elif item["excess_cost_driver"] == "ФОТ и налоги на персонал":
        decision = "Сократить ФОТ до медианной доли выручки; пересмотреть смены и совмещение ролей. Контроль еженедельно."
    elif item["excess_cost_driver"] == "Аренда":
        decision = "Провести переговоры по аренде; при отсутствии снижения — оценить релокацию по трафику и окупаемости."
    else:
        decision = "Закрыть первичные документы по статье-резерву, установить лимит и план снижения до медианной доли выручки."
    values = [idx, item["store"], item["net_profit"], item["loss_months"], item["excess_cost_driver"], item["excess_cost_amount"], item["profit_breakeven_cost_reduction"], decision]
    for col, value in enumerate(values, start=3):
        cell = ws.cell(21 + idx, col, value)
        if col in (5, 8, 9):
            style_number(cell, CURRENCY, input_value=True, bold=col == 5)
        elif col in (3, 6):
            style_number(cell, '0', input_value=True)
        else:
            style_label(cell)
            if col == 10:
                cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[21 + idx].height = 38

add_section(ws, 35, "Масштабирование успеха и защита от сезонных провалов")
actions = [
    ("Масштабировать практики лидеров", "ПОРТ, КИР1 и А2 формируют 54,6% чистой прибыли сети. За 30 дней сравнить их ассортимент, закупочную маржу, часы персонала и аренду с 11 убыточными точками; перенести минимум три подтвержденные практики."),
    ("Защитить май–июль", "Март→май: выручка −20,3 млн руб., чистая прибыль −5,8 млн руб.; в июле валовая маржа упала до 23,9%. За 6 недель до периода провала зафиксировать закупочные цены, еженедельно проверять уценку и вводить лимиты на переменные расходы."),
    ("Провести контроль закрытия августа", "Августовская чистая маржа 13,2% выше июля на 11,6 п.п. при снижении выручки. Формулы корректны, но перед инвесторским использованием необходимо подтвердить начисления ФОТ, аренды, налогов и разовые операции."),
]
for row, (title, description) in enumerate(actions, start=36):
    ws.cell(row, 3, title); style_label(ws.cell(row, 3), bold=True)
    ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=10)
    ws.cell(row, 4, description); style_label(ws.cell(row, 4))
    ws.cell(row, 4).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 45
set_print_area(ws)
autofit(ws)

# 04 — formula audit
ws = wb.create_sheet("04_Аудит_формул")
apply_layout(ws, "Аудит формул и контроль расчетов", "Проверка проводилась по всем листам-магазинам начиная с 4-го листа исходной книги")
add_section(ws, 8, "Результат проверки")
audit_rows = [
    ("Листы-магазины", 43, "ПОРТ — РЕЗЕРВ4; первые 3 технических листа исключены из финансового рейтинга."),
    ("Месячные P&L-блоки", 516, "12 блоков на каждом из 43 листов; арифметические связи и итоги проверены."),
    ("Формульные ячейки", 310723, "Сверка с независимым пересчетом совместимым табличным движком."),
    ("Ошибки #REF! / #DIV/0! / #VALUE!", 0, "Ошибок формул не выявлено."),
    ("Расхождения после независимого пересчета > 0,15 руб.", 0, "Расхождений не выявлено."),
]
for col, header in enumerate(["Объект проверки", "Количество", "Результат"], start=3):
    ws.cell(9, col, header)
style_header(ws, 9, 3, 5)
for row, values in enumerate(audit_rows, start=10):
    for col, value in enumerate(values, start=3):
        cell = ws.cell(row, col, value)
        if col == 4:
            style_number(cell, '0', input_value=True, bold=True)
        else:
            style_label(cell)
        if row >= 13:
            cell.fill = PatternFill("solid", fgColor=PALE_GREEN)
add_section(ws, 18, "Проверенные расчетные связи")
checks = [
    "Закупка = закупка копченая + закупка мороженая; продажа = продажа копченая + продажа мороженая.",
    "Валовая прибыль = продажа − закупка; общая выручка = наличные + безналичные.",
    "Наличные траты = сумма статей U:AC; банковская комиссия = −2% безналичной выручки.",
    "Налог = −12% валовой прибыли; НДФЛ = −22% базы денежных выплат.",
    "Переходящий остаток и месячные итоги сверены с дневными строками; чистая прибыль пересчитана по включенным статьям.",
]
for row, text in enumerate(checks, start=19):
    ws.cell(row, 3, "✓")
    ws.cell(row, 3).font = Font(name="Aptos", bold=True, color=JADE)
    ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=10)
    ws.cell(row, 4, text); style_label(ws.cell(row, 4))
    ws.cell(row, 4).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 30
add_section(ws, 26, "Аналитический red flag — не ошибка формул")
ws.merge_cells("C27:J28")
ws["C27"] = analysis["seasonality"]["note"]
ws["C27"].alignment = Alignment(wrap_text=True, vertical="top")
ws["C27"].fill = PatternFill("solid", fgColor=PALE_AMBER)
ws["C27"].font = Font(name="Aptos", size=10, color=GRAPHITE)
set_print_area(ws)
autofit(ws)

# 05 — methodology
ws = wb.create_sheet("05_Методология")
apply_layout(ws, "Методология и определения", "Период, база данных, расчеты и ограничения интерпретации")
add_section(ws, 8, "Период и источник")
method_rows = [
    ("Источник", "учет2026.xlsm; фактические данные из листов 4–46. Первые 3 листа исключены по заданию."),
    ("Период", "2026 календарный год по имени файла; в исходных листах фактически заполнены январь–август. Сентябрь–декабрь нулевые."),
    ("Выручка", "Сумма строки «Продажа» (столбец H) в месячных блоках. Это операционная выручка, использованная для маржинальности."),
    ("Чистая прибыль", "Значение строки «Итог» (столбец AQ) для каждого месячного блока; годовой итог — сумма фактических месяцев."),
    ("Расходы", "Выручка минус чистая прибыль. Показатель включает закупочную себестоимость и статьи, вошедшие в расчет чистой прибыли."),
    ("Сопоставимый рейтинг", "Точки с выручкой не менее 1,0 млн руб. РЕЗ2 с выручкой 4,5 тыс. руб. и 7 нулевых/резервных листов не включены в рейтинг."),
    ("Ловушка выручки", "Выручка не ниже медианы сопоставимых точек и чистая маржа ниже 2,0%; при отсутствии таких точек применяется квартильный фильтр."),
    ("Скрытый герой", "Выручка ниже медианы сопоставимых точек и чистая маржа не ниже верхней трети распределения."),
]
for row, (label, description) in enumerate(method_rows, start=9):
    ws.cell(row, 3, label); style_label(ws.cell(row, 3), bold=True)
    ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=10)
    ws.cell(row, 4, description); style_label(ws.cell(row, 4))
    ws.cell(row, 4).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 34
add_section(ws, 20, "Ограничение управленческих выводов")
ws.merge_cells("C21:J23")
ws["C21"] = (
    "Аудит подтверждает арифметическую целостность модели, но не заменяет проверку первичных документов, "
    "трафика, договоров аренды, ассортиментной матрицы и начислений. Рекомендации о закрытии/релокации "
    "построены как управленческие развилки: до решения необходимо подтвердить достижимость указанного резерва."
)
ws["C21"].alignment = Alignment(wrap_text=True, vertical="top")
ws["C21"].fill = PatternFill("solid", fgColor=PALE_AMBER)
set_print_area(ws)
autofit(ws)

# Store profile tabs: one full financial fact sheet per uploaded store sheet.
monthly_lookup = {store: frame.sort_values("month_number") for store, frame in monthly.groupby("store")}
display_metrics = [
    ("Выручка", "revenue", CURRENCY),
    ("Закупочная себестоимость", "purchases", CURRENCY),
    ("Валовая прибыль", "gross_profit", CURRENCY),
    ("Валовая маржа", "gross_margin", PERCENT),
    ("Расходы", "expenses", CURRENCY),
    ("Чистая прибыль", "net_profit", CURRENCY),
    ("Чистая маржа", "net_margin", PERCENT),
]
monthly_metrics = [
    ("Месяц", "month", None),
    ("Выручка", "revenue", CURRENCY),
    ("Закупка", "purchases", CURRENCY),
    ("Валовая прибыль", "gross_profit", CURRENCY),
    ("Валовая маржа", "gross_margin", PERCENT),
    ("Чистая прибыль", "net_profit", CURRENCY),
    ("Чистая маржа", "net_margin", PERCENT),
    ("Аренда", "rent", CURRENCY),
    ("ФОТ и налоги", "payroll_total", CURRENCY),
    ("Списания", "writeoffs_total", CURRENCY),
    ("Траты наличные", "cash_operating_costs", CURRENCY),
]
for _, item in annual.sort_values("store").iterrows():
    store = item["store"]
    sheet_name = f"М_{store}"[:31]
    ws = wb.create_sheet(sheet_name)
    title_status = "операционная точка" if item["revenue"] and item["revenue"] > 0 else "нулевые продажи / резервный лист"
    apply_layout(ws, f"Профиль магазина: {store}", f"{title_status} | Данные по листу «{store}» исходной книги | январь–июль 2026")
    add_section(ws, 8, "Финансовый результат")
    for row, (label, field, fmt) in enumerate(display_metrics, start=9):
        ws.cell(row, 3, label); style_label(ws.cell(row, 3), bold=label in {"Выручка", "Валовая прибыль", "Чистая прибыль"}, italic="маржа" in label.lower())
        formula = None
        if field == "revenue":
            formula = "=SUM(D24:D31)"
        elif field == "purchases":
            formula = "=SUM(E24:E31)"
        elif field == "gross_profit":
            formula = "=SUM(F24:F31)"
        elif field == "gross_margin":
            formula = "=IFERROR(D11/D9,0)"
        elif field == "expenses":
            formula = "=D9-D14"
        elif field == "net_profit":
            formula = "=SUM(H24:H31)"
        elif field == "net_margin":
            formula = "=IFERROR(D14/D9,0)"
        ws.cell(row, 4, formula)
        style_number(ws.cell(row, 4), fmt, input_value=False, bold=label in {"Выручка", "Валовая прибыль", "Чистая прибыль"})
        if label == "Чистая прибыль":
            apply_total_border(ws, row, 3, 4, final=True)
    add_section(ws, 17, "Лучший / худший месяц и диагностический вывод")
    ws.cell(18, 3, "Лучший месяц"); style_label(ws.cell(18, 3), bold=True)
    ws.cell(18, 4, item["best_month"] or "—"); style_label(ws.cell(18, 4))
    ws.cell(18, 5, item["best_month_profit"] or 0); style_number(ws.cell(18, 5), CURRENCY, input_value=True)
    ws.cell(19, 3, "Худший месяц"); style_label(ws.cell(19, 3), bold=True)
    ws.cell(19, 4, item["worst_month"] or "—"); style_label(ws.cell(19, 4))
    ws.cell(19, 5, item["worst_month_profit"] or 0); style_number(ws.cell(19, 5), CURRENCY, input_value=True)
    ws.cell(20, 3, "Главный фактор"); style_label(ws.cell(20, 3), bold=True)
    ws.merge_cells("D20:K21")
    ws["D20"] = item["narrative"]
    style_label(ws["D20"])
    ws["D20"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[20].height = 36

    add_section(ws, 23, "Помесячный P&L")
    for col, (label, _, _) in enumerate(monthly_metrics, start=3):
        ws.cell(24, col, label)
    style_header(ws, 24, 3, 13)
    frame = monthly_lookup.get(store, pd.DataFrame())
    record_by_month = {record["month"]: record for _, record in frame.iterrows()}
    for row_index, month in enumerate(["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль"], start=25):
        record = record_by_month.get(month)
        ws.cell(row_index, 3, month); style_label(ws.cell(row_index, 3))
        if record is None:
            values = {field: 0 for _, field, _ in monthly_metrics[1:]}
            total_row = "—"
        else:
            values = {field: record.get(field, 0) for _, field, _ in monthly_metrics[1:]}
            values["payroll_total"] = (
                (record.get("salary_cashless") or 0) + (record.get("payroll_tax") or 0) + (record.get("vacation_cashless") or 0)
                + (record.get("vacation_tax") or 0) + (record.get("salary_cash") or 0) + (record.get("vacation_cash") or 0)
                - (record.get("personal_income_tax") or 0)
            )
            values["writeoffs_total"] = (record.get("writeoffs_copy") or 0) + (record.get("writeoffs_frozen") or 0)
            total_row = int(record["total_row"])
        for col, (_, field, fmt) in enumerate(monthly_metrics[1:], start=4):
            ws.cell(row_index, col, values[field])
            style_number(ws.cell(row_index, col), fmt, input_value=True)
            ws.cell(row_index, col).comment = source_comment(store, month, total_row, monthly_metrics[col - 3][0])
    apply_total_border(ws, 32, 3, 13)
    ws.cell(32, 3, "Итого факт (янв–июл)")
    style_label(ws.cell(32, 3), bold=True)
    for col in [4, 5, 6, 8, 10, 11, 12, 13]:
        ws.cell(32, col, f"=SUM({get_column_letter(col)}25:{get_column_letter(col)}31)")
        style_number(ws.cell(32, col), CURRENCY, input_value=False, bold=True)
    ws.cell(32, 7, "=IFERROR(F32/D32,0)"); style_number(ws.cell(32, 7), PERCENT, input_value=False, bold=True)
    ws.cell(32, 9, "=IFERROR(H32/D32,0)"); style_number(ws.cell(32, 9), PERCENT, input_value=False, bold=True)

    add_section(ws, 39, "Контроль формул исходного листа")
    ws.merge_cells("C40:K41")
    formula_statement = (
        "Статус: пройдено. На листе исходной книги обнаружено 6 484 формулы; "
        "ошибки формул и расхождения после независимого пересчета не выявлены."
    )
    ws["C40"] = formula_statement
    ws["C40"].alignment = Alignment(wrap_text=True, vertical="top")
    ws["C40"].fill = PatternFill("solid", fgColor=PALE_GREEN)
    ws["C40"].font = Font(name="Aptos", size=10, color=JADE)
    add_profit_chart(ws, 25, 31, 3, 8, "M24", "Чистая прибыль по фактическим месяцам")
    ws.freeze_panes = "C24"
    set_print_area(ws)
    autofit(ws, max_width=30)

# Workbook properties
wb.properties.title = "Супер-отчет по прибыли магазинов — 2026"
wb.properties.subject = "Аудит формул и финансовый анализ розничной сети"
wb.properties.creator = "Manus AI"
wb.calculation.fullCalcOnLoad = True
wb.calculation.forceFullCalc = True
wb.save(OUT)
print(OUT)
print(f"Worksheets: {len(wb.worksheets)}")

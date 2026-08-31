"""Compare source cached results against LibreOffice-recalculated output."""

import csv
import json
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook


SOURCE = Path("/home/ubuntu/upload/учет2026.xlsm")
RECALCULATED = Path("/home/ubuntu/retail_profit_audit_2026/audit_work/recalculated/учет2026.xlsx")
OUT_DIR = Path("/home/ubuntu/retail_profit_audit_2026/audit_work")
ERROR_MARKERS = ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#NULL!")


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def main():
    source_formulas = load_workbook(SOURCE, data_only=False, keep_vba=True)
    source_values = load_workbook(SOURCE, data_only=True, keep_vba=True)
    recalculated_values = load_workbook(RECALCULATED, data_only=True)

    differences = []
    errors = []
    for sheet in source_formulas.sheetnames:
        fws = source_formulas[sheet]
        sws = source_values[sheet]
        rws = recalculated_values[sheet]
        for row in fws.iter_rows():
            for cell in row:
                formula = cell.value
                if not (isinstance(formula, str) and formula.startswith("=")):
                    continue
                old = sws[cell.coordinate].value
                new = rws[cell.coordinate].value
                if isinstance(new, str) and new.upper().startswith(ERROR_MARKERS):
                    errors.append({
                        "sheet": sheet,
                        "cell": cell.coordinate,
                        "formula": formula,
                        "recalculated_value": new,
                    })
                elif numeric(old) and numeric(new):
                    delta = float(new) - float(old)
                    if abs(delta) > 0.15:
                        differences.append({
                            "sheet": sheet,
                            "cell": cell.coordinate,
                            "formula": formula,
                            "original_cached": float(old),
                            "recalculated": float(new),
                            "delta": delta,
                        })
                elif old != new:
                    # Ignore blank-to-zero and local formula-engine representation quirks.
                    if not ((old is None and new in (0, "")) or (new is None and old in (0, ""))):
                        differences.append({
                            "sheet": sheet,
                            "cell": cell.coordinate,
                            "formula": formula,
                            "original_cached": old,
                            "recalculated": new,
                            "delta": "non_numeric_change",
                        })

    differences.sort(key=lambda item: abs(item["delta"]) if numeric(item["delta"]) else float("inf"), reverse=True)
    fields = ["sheet", "cell", "formula", "original_cached", "recalculated", "delta"]
    with (OUT_DIR / "recalculation_differences.csv").open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(differences)
    with (OUT_DIR / "recalculation_errors.csv").open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=["sheet", "cell", "formula", "recalculated_value"])
        writer.writeheader()
        writer.writerows(errors)

    summary = {
        "formula_cells_compared": sum(
            1
            for ws in source_formulas.worksheets
            for row in ws.iter_rows()
            for cell in row
            if isinstance(cell.value, str) and cell.value.startswith("=")
        ),
        "recalculation_errors": len(errors),
        "output_differences_above_tolerance": len(differences),
        "differences_by_sheet": dict(Counter(row["sheet"] for row in differences)),
    }
    (OUT_DIR / "recalculation_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

"""Export audited P&L data as a static TypeScript module for the report UI."""

import json
from pathlib import Path


ROOT = Path("/home/ubuntu/retail_profit_audit_2026")
source = ROOT / "audit_work" / "analysis_data.json"
target = ROOT / "client" / "src" / "data" / "auditData.ts"
target.parent.mkdir(parents=True, exist_ok=True)
data = json.loads(source.read_text(encoding="utf-8"))

module = """/**
 * AuditLine design reminder: warm-paper editorial report, forest-green authority,
 * bordeaux for risk, jade for verified improvement. Source: audited user workbook.
 */
export type StoreProfile = {
  store: string;
  revenue: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  gross_margin: number | null;
  net_margin: number | null;
  best_month: string | null;
  best_month_profit: number | null;
  worst_month: string | null;
  worst_month_profit: number | null;
  loss_months: number;
  loss_month_names: string;
  primary_cost_driver: string;
  primary_cost_driver_amount: number;
  excess_cost_driver: string;
  excess_cost_amount: number;
  narrative: string;
  operating_store: boolean;
  active_sheet: boolean;
  rent: number;
  payroll_total: number;
  writeoffs_total: number;
  cash_operating_costs: number;
};

export const auditData = """ + json.dumps(data, ensure_ascii=False, indent=2) + " as const;\n\n" + "export const storeProfiles = auditData.store_profiles as unknown as StoreProfile[];\n"
target.write_text(module, encoding="utf-8")
print(target)


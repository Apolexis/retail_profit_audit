"""Export corrected Jan–Aug 2026 audit data to the static React report."""
import json
from pathlib import Path
import pandas as pd

ROOT = Path('/home/ubuntu/retail_profit_audit_2026')
WORK = ROOT/'audit_2026'/'audit_august_clean_excl_s2'
data = json.loads((WORK/'analysis_data.json').read_text(encoding='utf-8'))
target = ROOT/'client'/'src'/'data'/'auditData.ts'

def rnd(value, digits=3):
    return round(value, digits)

store_monthly = pd.read_csv(WORK/'store_monthly.csv', encoding='utf-8-sig')
profit_rank = {item['store']: index + 1 for index, item in enumerate(sorted(data['store_profiles'], key=lambda row: row['net_profit'], reverse=True))}
stores = [{
    'store': x['store'], 'revenue': rnd(x['revenue']/1_000_000), 'netProfit': rnd(x['net_profit']/1_000_000),
    'netMargin': rnd(x['net_margin']*100, 1), 'grossMargin': rnd(x['gross_margin']*100, 1),
    'bestMonth': x['best_month'], 'worstMonth': x['worst_month'], 'lossMonths': int(x['loss_months']),
    'reserve': x['excess_cost_driver'], 'reserveAmount': rnd(x['excess_cost_amount']/1_000_000),
    'inventoryEffect': rnd(x['inventory_net_effect']/1_000_000), 'narrative': x['narrative'], 'profitRank': profit_rank[x['store']],
    'monthlyProfit': [
        {'month': str(row.month)[:3], 'profit': rnd(float(row.net_profit)/1_000_000, 2)}
        for row in store_monthly[store_monthly['store'] == x['store']].sort_values('month_number').itertuples()
    ]
} for x in data['store_profiles']]
monthly = [{'month': x['month'][:3], 'revenue': rnd(x['revenue']/1_000_000,1), 'profit': rnd(x['net_profit']/1_000_000,2), 'margin': rnd(x['net_margin']*100,1)} for x in data['monthly_network']]
colors = ['#1e4d3b','#3f7663','#7fa89b','#b8995c','#a5594e','#7b7b72','#c7bead','#d8d2c5']
cost = [{'name': x['category'], 'value': rnd(x['amount']/1_000_000,1), 'color': colors[i]} for i,x in enumerate(data['cost_bridge'])]
inventory = [{'name': x['category'], 'value': rnd(x['amount']/1_000_000,2)} for x in data['inventory_bridge']]
actions = [{
    'point': x['store'], 'target': f"{x['break_even_reduction']/1_000_000:.2f} млн ₽", 'reserve': x['excess_cost_driver'],
    'reserveAmount': f"{x['excess_cost_amount']/1_000_000:.2f} млн ₽", 'action': x['recommended_action']
} for x in data['turnaround_priorities']]
text = '''/** AuditLine: corrected Jan–Aug 2026 base; warm-paper investment-committee report. */\n\nexport type StoreProfile = { store:string; revenue:number; netProfit:number; netMargin:number; grossMargin:number; bestMonth:string; worstMonth:string; lossMonths:number; reserve:string; reserveAmount:number; inventoryEffect:number; narrative:string; profitRank:number; monthlyProfit:{month:string;profit:number}[]; };\n\n'''
text += 'export const monthlyData = ' + json.dumps(monthly,ensure_ascii=False,indent=2) + ';\n\n'
text += 'export const costData = ' + json.dumps(cost,ensure_ascii=False,indent=2) + ';\n\n'
text += 'export const inventoryData = ' + json.dumps(inventory,ensure_ascii=False,indent=2) + ';\n\n'
text += 'export const stores: StoreProfile[] = ' + json.dumps(stores,ensure_ascii=False,indent=2) + ';\n\n'
text += 'export const actionPlan = ' + json.dumps(actions,ensure_ascii=False,indent=2) + ';\n\n'
text += 'export const network = ' + json.dumps({
    'revenue':rnd(data['network_dashboard']['revenue']/1_000_000,1), 'grossProfit':rnd(data['network_dashboard']['gross_profit']/1_000_000,1),
    'netProfit':rnd(data['network_dashboard']['net_profit']/1_000_000,1), 'netMargin':rnd(data['network_dashboard']['net_margin']*100,1),
    'lossCount':data['network_dashboard']['loss_making_comparable_stores'], 'storeCount':data['reporting_scope']['stores_included'],
    'losses':rnd(data['network_dashboard']['total_comparable_losses']/1_000_000,1), 'topShare':rnd(data['network_dashboard']['top_3_profit_share']*100,1),
    'top3':data['network_dashboard']['top_3'], 'bottom3':data['network_dashboard']['bottom_3'],
    'peak':data['network_dashboard']['profit_peak_month'], 'trough':data['network_dashboard']['profit_trough_month']
},ensure_ascii=False,indent=2) + ' as const;\n\n'
text += 'export const auditChecks = [["Исходных листов-магазинов", "43"], ["Включено в срез", "32"], ["P&L-блоков в срезе", "256"], ["Формульных ячеек", "310 723"], ["Расхождений > 0,15 руб.", "0"]] as const;\n'
target.write_text(text,encoding='utf-8')
print(target)

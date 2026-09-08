from __future__ import annotations

import json
import statistics
from pathlib import Path

ROOT = Path('/home/ubuntu/retail_profit_audit_2026')
SOURCE = ROOT/'audit_2026'/'deep_operational_excl_s2'/'deep_analysis.json'
OUT = ROOT/'audit_2026'/'deep_operational_excl_s2'/'monthly_comparison.json'

data = json.loads(SOURCE.read_text(encoding='utf-8'))
rows = data['monthly_stores']

metrics = [
    ('pnl','Выручка','revenue','amount'),('pnl','Валовая прибыль','gross_profit','amount'),('pnl','Чистая прибыль','net_profit','amount'),('pnl','Валовая маржа','gross_margin_pct','percent'),('pnl','Чистая маржа','net_margin_pct','percent'),
    ('product','Закупка всего','purchases','amount'),('product','З. Коп. — закупка копченой','purchase_smoked','amount'),('product','З. Мор. — закупка мороженой','purchase_frozen','amount'),('product','П. Коп. — продажа копченой','sales_smoked','amount'),('product','П. Мор. — продажа мороженой','sales_frozen','amount'),
    ('pricing','Наценка Коп.','smoked_markup_pct','percent'),('pricing','Наценка Мор.','frozen_markup_pct','percent'),
    ('expense','Хоз. нужды','household','amount'),('expense','Доставка','delivery','amount'),('expense','Уборка','cleaning','amount'),('expense','Премия','bonus','amount'),('expense','Выслуга','service_bonus','amount'),('expense','Доплата','extra_pay','amount'),('expense','Водитель (наличные)','driver_cash','amount'),('expense','Коммунальные (наличные)','utilities_cash','amount'),('expense','Прочие наличные расходы','other_cash_expenses','amount'),('expense','Водитель (безнал)','driver_cashless','amount'),('expense','Коммунальные (безнал)','utilities_cashless','amount'),('expense','Аренда','rent','amount'),('expense','Банковская комиссия','bank_fee','amount'),('expense','Налог с валовой прибыли','gross_profit_tax','amount'),('expense','Зарплата (безнал)','salary_cashless','amount'),('expense','Налоги на ФОТ','payroll_tax','amount'),('expense','Отпускные (безнал)','vacation_cashless','amount'),('expense','Налоги на отпускные','vacation_tax','amount'),('expense','Зарплата (наличные)','salary_cash','amount'),('expense','Отпускные (наличные)','vacation_cash','amount'),('expense','НДФЛ','personal_income_tax','amount'),('expense','Списания М. — расход P&L','writeoff_frozen','amount'),
    ('inventory','Остаток на начало','stock_open','amount'),('inventory','Остаток на конец','stock_close','amount'),('inventory','Изменение остатка','stock_change','amount'),('inventory','Перемещение','movement','amount'),('inventory','Уценка','discount','amount'),('inventory','Переоценка','revaluation','amount'),('inventory','Списания К. — производственный сигнал','writeoff_smoked','amount'),('inventory','Списания М. — расход P&L','writeoff_frozen','amount'),
]

for row in rows:
    row['stock_change'] = row['stock_close'] - row['stock_open']
    row['smoked_markup_pct'] = ((row['sales_smoked'] / row['purchase_smoked']) - 1) * 100 if row['purchase_smoked'] else 0
    row['frozen_markup_pct'] = ((row['sales_frozen'] / row['purchase_frozen']) - 1) * 100 if row['purchase_frozen'] else 0
    row['gross_margin_pct'] = row['gross_profit'] / row['revenue'] * 100 if row['revenue'] else 0
    row['net_margin_pct'] = row['net_profit'] / row['revenue'] * 100 if row['revenue'] else 0

months = sorted({r['month_number'] for r in rows})
network=[]
for month_number in months:
    selection=[r for r in rows if r['month_number']==month_number]
    record={'month_number':month_number,'month':selection[0]['month']}
    for _,_,field,unit in metrics:
        values=[r.get(field,0) for r in selection]
        if unit == 'percent':
            if field == 'smoked_markup_pct': record[field]=(sum(r['sales_smoked'] for r in selection) / sum(r['purchase_smoked'] for r in selection) - 1) * 100 if sum(r['purchase_smoked'] for r in selection) else 0
            elif field == 'frozen_markup_pct': record[field]=(sum(r['sales_frozen'] for r in selection) / sum(r['purchase_frozen'] for r in selection) - 1) * 100 if sum(r['purchase_frozen'] for r in selection) else 0
            elif field == 'gross_margin_pct': record[field]=sum(r['gross_profit'] for r in selection) / sum(r['revenue'] for r in selection) * 100 if sum(r['revenue'] for r in selection) else 0
            else: record[field]=sum(r['net_profit'] for r in selection) / sum(r['revenue'] for r in selection) * 100 if sum(r['revenue'] for r in selection) else 0
        else:
            record[field]=sum(values)
        record[f'{field}_median']=statistics.median(values)
        revenue_values=[r['revenue'] for r in selection]
        ratios=[(r.get(field,0)/r['revenue']) if r['revenue'] else 0 for r in selection]
        record[f'{field}_median_share']=statistics.median(ratios)
    network.append(record)

payload={'metric_definitions':[{'group':g,'label':l,'field':f,'unit':u} for g,l,f,u in metrics],'network_monthly':network,'store_monthly':rows}
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'metrics':len(metrics),'months':len(months),'stores':len(data['scope']['stores'])},ensure_ascii=False))

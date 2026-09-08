from __future__ import annotations

import json
import statistics
from pathlib import Path

ROOT = Path('/home/ubuntu/retail_profit_audit_2026')
SOURCE = ROOT/'audit_2026'/'deep_operational_excl_s2'/'deep_analysis.json'
OUT = ROOT/'audit_2026'/'deep_operational_excl_s2'/'inventory_benchmarks.json'

data = json.loads(SOURCE.read_text(encoding='utf-8'))
stores = data['stores']
days = 243  # календарные дни января–августа 2026

for row in stores:
    revenue = row['revenue']
    row['stock_to_revenue'] = row['stock_close'] / revenue if revenue else 0
    row['stock_cover_days'] = row['stock_close'] / revenue * days if revenue else 0
    row['stock_change_to_revenue'] = row['stock_change'] / revenue if revenue else 0
    row['inventory_effect_to_revenue'] = row['inventory_effect'] / revenue if revenue else 0
    row['writeoff_total'] = row['writeoff_smoked'] + row['writeoff_frozen']
    row['writeoff_total_to_revenue'] = row['writeoff_total'] / revenue if revenue else 0

metrics = ['stock_to_revenue','stock_cover_days','stock_change_to_revenue','writeoff_frozen_share','writeoff_smoked_share','writeoff_total_to_revenue']
medians = {metric: statistics.median(row[metric] for row in stores) for metric in metrics}
quartiles = {}
for metric in metrics:
    ordered = sorted(row[metric] for row in stores)
    quartiles[metric] = {'p25': statistics.quantiles(ordered, n=4, method='inclusive')[0], 'p75': statistics.quantiles(ordered, n=4, method='inclusive')[2]}

for row in stores:
    row['stock_cover_rank'] = sorted(stores, key=lambda x:x['stock_cover_days'], reverse=True).index(row)+1
    row['stock_close_rank'] = sorted(stores, key=lambda x:x['stock_close'], reverse=True).index(row)+1
    row['frozen_writeoff_rank'] = sorted(stores, key=lambda x:x['writeoff_frozen_share'], reverse=True).index(row)+1
    row['smoked_writeoff_rank'] = sorted(stores, key=lambda x:x['writeoff_smoked_share'], reverse=True).index(row)+1
    flags=[]
    if row['stock_to_revenue'] > quartiles['stock_to_revenue']['p75']:
        flags.append('Высокий остаток относительно выручки')
    if row['stock_to_revenue'] < quartiles['stock_to_revenue']['p25']:
        flags.append('Низкий остаток относительно выручки')
    if row['writeoff_frozen_share'] > quartiles['writeoff_frozen_share']['p75']:
        flags.append('Высокие списания М. как расход P&L')
    if row['writeoff_smoked_share'] > quartiles['writeoff_smoked_share']['p75']:
        flags.append('Высокие списания К. как производственный сигнал')
    if row['stock_change'] > 0 and row['stock_change_to_revenue'] > quartiles['stock_change_to_revenue']['p75']:
        flags.append('Ускоренный прирост остатка')
    row['inventory_flags'] = flags or ['В пределах межквартильного диапазона по ключевым метрикам']

monthly = data['monthly_stores']
months = []
for number in range(1, 9):
    rows = [r for r in monthly if r['month_number']==number]
    months.append({
        'month': rows[0]['month'],
        'stock_open': sum(r['stock_open'] for r in rows),
        'stock_close': sum(r['stock_close'] for r in rows),
        'stock_change': sum(r['stock_close']-r['stock_open'] for r in rows),
        'movement': sum(r['movement'] for r in rows),
        'discount': sum(r['discount'] for r in rows),
        'revaluation': sum(r['revaluation'] for r in rows),
        'writeoff_smoked': sum(r['writeoff_smoked'] for r in rows),
        'writeoff_frozen': sum(r['writeoff_frozen'] for r in rows),
        'revenue': sum(r['revenue'] for r in rows),
    })

network = {
    'stock_open': sum(row['stock_open'] for row in stores),
    'stock_close': sum(row['stock_close'] for row in stores),
    'stock_change': sum(row['stock_change'] for row in stores),
    'movement': sum(row['movement'] for row in stores),
    'discount': sum(row['discount'] for row in stores),
    'revaluation': sum(row['revaluation'] for row in stores),
    'writeoff_smoked': sum(row['writeoff_smoked'] for row in stores),
    'writeoff_frozen': sum(row['writeoff_frozen'] for row in stores),
    'stock_to_revenue': sum(row['stock_close'] for row in stores) / sum(row['revenue'] for row in stores),
    'stock_cover_days': sum(row['stock_close'] for row in stores) / sum(row['revenue'] for row in stores) * days,
}

payload = {'days_in_period':days,'medians':medians,'quartiles':quartiles,'network':network,'monthly':months,'stores':stores}
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'network':network,'medians':medians,'high_stock':[r['store'] for r in stores if 'Высокий остаток' in r['inventory_flags']]},ensure_ascii=False,indent=2))

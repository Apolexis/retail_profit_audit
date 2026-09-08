from __future__ import annotations

import json
import statistics
from pathlib import Path

ROOT=Path('/home/ubuntu/retail_profit_audit_2026')
deep=json.loads((ROOT/'audit_2026'/'deep_operational_excl_s2'/'deep_analysis.json').read_text(encoding='utf-8'))
monthly=deep['monthly_stores']; annual=deep['stores']; stores={row['store']:row for row in annual}

categories=[
    {'id':'smoked','label':'Копченая продукция','purchase':'purchase_smoked','sales':'sales_smoked','markup':'smoked_markup'},
    {'id':'frozen','label':'Мороженая продукция','purchase':'purchase_frozen','sales':'sales_frozen','markup':'frozen_markup'},
]
result=[]
network_categories=[]
for cat in categories:
    marks=[row[cat['markup']] for row in annual]
    q1,q3=statistics.quantiles(marks,n=4,method='inclusive')[0],statistics.quantiles(marks,n=4,method='inclusive')[2]
    weighted=(sum(row[cat['sales']] for row in annual)/sum(row[cat['purchase']] for row in annual)-1) if sum(row[cat['purchase']] for row in annual) else 0
    network_categories.append({'id':cat['id'],'label':cat['label'],'weighted_markup':weighted,'median_markup':statistics.median(marks),'p25':q1,'p75':q3})
    network_rows={m:[r for r in monthly if r['month_number']==m] for m in range(1,9)}
    network_start=sum(r[cat['sales']] for m in (1,2) for r in network_rows[m]); network_end=sum(r[cat['sales']] for m in (7,8) for r in network_rows[m]); network_trend=(network_end/network_start-1) if network_start else 0
    for store, annual_row in stores.items():
        rows=sorted([r for r in monthly if r['store']==store],key=lambda x:x['month_number'])
        start=sum(r[cat['sales']] for r in rows[:2]); end=sum(r[cat['sales']] for r in rows[-2:]); trend=(end/start-1) if start else 0
        markup=annual_row[cat['markup']]
        net_margin=annual_row['net_margin']; gross_margin=annual_row['gross_margin'];
        relative_trend=trend-network_trend
        category_writeoff=annual_row['writeoff_smoked_share'] if cat['id']=='smoked' else annual_row['writeoff_frozen_share']
        if markup < q1 and gross_margin < deep['network']['gross_margin']:
            signal='Проверить повышение в пилоте'; rationale='наценка ниже нижнего квартиля сети и валовая маржа ниже сети'
        elif markup > q3 and relative_trend < -0.12:
            signal='Проверить снижение/промо в пилоте'; rationale='наценка выше верхнего квартиля, а продажи отстают от тренда сети'
        else:
            signal='Сохранить / тестировать точечно'; rationale='нет одновременного ценового и динамического сигнала для изменения'
        result.append({'store':store,'category':cat['id'],'label':cat['label'],'markup':markup,'median_markup':statistics.median(marks),'p25':q1,'p75':q3,'markup_gap_median':markup-statistics.median(marks),'sales_trend':trend,'network_sales_trend':network_trend,'relative_trend':relative_trend,'gross_margin':gross_margin,'net_margin':net_margin,'writeoff_share':category_writeoff,'signal':signal,'rationale':rationale})

payload={'network':network_categories,'stores':result,'methodology':'Сигналы не являются автоматической ценовой рекомендацией: в книге нет количества чеков, объема продаж в штуках и эластичности спроса. Изменение цен целесообразно проверять кратким пилотом с контролем маржи, количества чеков и списаний.'}
out=ROOT/'audit_2026'/'deep_operational_excl_s2'/'pricing_audit.json';out.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'signals':{x:sum(1 for r in result if r['signal']==x) for x in set(r['signal'] for r in result)}},ensure_ascii=False))

import json
from pathlib import Path

ROOT=Path('/home/ubuntu/retail_profit_audit_2026')
src=ROOT/'audit_2026'/'deep_operational_excl_s2'/'monthly_comparison.json'
target=ROOT/'client'/'src'/'data'/'monthlyComparisonData.ts'
data=json.loads(src.read_text(encoding='utf-8'))

definitions=data['metric_definitions']
network=[]
for row in data['network_monthly']:
    item={'month':row['month'][:3],'monthNumber':row['month_number']}
    for definition in definitions:
        f=definition['field']; divisor = 1 if definition['unit'] == 'percent' else 1_000
        item[f]=round(row[f]/divisor,3); item[f'{f}Median']=round(row[f'{f}_median']/divisor,3); item[f'{f}MedianShare']=round(row[f'{f}_median_share']*100,3)
    network.append(item)
store_map={}
for row in data['store_monthly']:
    item={'month':row['month'][:3],'monthNumber':row['month_number'],'revenue':round(row['revenue']/1_000,3)}
    for definition in definitions:
        f=definition['field']; divisor = 1 if definition['unit'] == 'percent' else 1_000; item[f]=round(row.get(f,0)/divisor,3)
    store_map.setdefault(row['store'],[]).append(item)

text='''/** Universal month-by-month comparison, corrected 2026.xlsx, Jan–Aug, 32 stores. */\n\n'''
text+='export const monthlyMetricDefinitions = '+json.dumps(definitions,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const monthlyNetwork = '+json.dumps(network,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const monthlyByStore = '+json.dumps(store_map,ensure_ascii=False,indent=2)+' as const;\n'
target.write_text(text,encoding='utf-8')
print(target)

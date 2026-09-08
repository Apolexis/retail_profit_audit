import json
from pathlib import Path

ROOT=Path('/home/ubuntu/retail_profit_audit_2026')
src=ROOT/'audit_2026'/'deep_operational_excl_s2'/'inventory_benchmarks.json'
target=ROOT/'client'/'src'/'data'/'inventoryData.ts'
data=json.loads(src.read_text(encoding='utf-8'))

def k(v): return round(v/1_000,1)
def p(v): return round(v*100,2)

network={key:(round(value,2) if 'days' in key or 'revenue' in key else k(value)) for key,value in data['network'].items()}
medians={key:(round(value,2) if 'days' in key else p(value)) for key,value in data['medians'].items()}
monthly=[]
for r in data['monthly']:
    monthly.append({'month':r['month'][:3],**{key:k(r[key]) for key in ['stock_open','stock_close','stock_change','movement','discount','revaluation','writeoff_smoked','writeoff_frozen','revenue']}})
stores=[]
for r in data['stores']:
    stores.append({'store':r['store'],'revenueK':k(r['revenue']),'stockOpenK':k(r['stock_open']),'stockCloseK':k(r['stock_close']),'stockChangeK':k(r['stock_change']),'stockShare':p(r['stock_to_revenue']),'coverDays':round(r['stock_cover_days'],1),'changeShare':p(r['stock_change_to_revenue']),'movementK':k(r['movement']),'discountK':k(r['discount']),'revaluationK':k(r['revaluation']),'writeoffSmokedK':k(r['writeoff_smoked']),'writeoffFrozenK':k(r['writeoff_frozen']),'writeoffSmokedShare':p(r['writeoff_smoked_share']),'writeoffFrozenShare':p(r['writeoff_frozen_share']),'stockRank':r['stock_close_rank'],'coverRank':r['stock_cover_rank'],'frozenWriteoffRank':r['frozen_writeoff_rank'],'smokedWriteoffRank':r['smoked_writeoff_rank'],'flags':r['inventory_flags']})
text='''/** Inventory analysis: corrected 2026.xlsx, Jan–Aug, 32 stores. Detailed values in thousand RUB. */\n\n'''
text+='export const inventoryNetwork = '+json.dumps(network,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const inventoryMedians = '+json.dumps(medians,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const inventoryMonthly = '+json.dumps(monthly,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const inventoryStores = '+json.dumps(stores,ensure_ascii=False,indent=2)+' as const;\n'
target.write_text(text,encoding='utf-8')
print(target)

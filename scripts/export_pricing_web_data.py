import json
from pathlib import Path

ROOT=Path('/home/ubuntu/retail_profit_audit_2026')
data=json.loads((ROOT/'audit_2026'/'deep_operational_excl_s2'/'pricing_audit.json').read_text(encoding='utf-8'))
out=[]
for r in data['stores']:
    out.append({**r,'markup':round(r['markup']*100,1),'medianMarkup':round(r['median_markup']*100,1),'p25':round(r['p25']*100,1),'p75':round(r['p75']*100,1),'gap':round(r['markup_gap_median']*100,1),'salesTrend':round(r['sales_trend']*100,1),'networkSalesTrend':round(r['network_sales_trend']*100,1),'relativeTrend':round(r['relative_trend']*100,1),'grossMargin':round(r['gross_margin']*100,1),'netMargin':round(r['net_margin']*100,1),'writeoffShare':round(r['writeoff_share']*100,2)})
network=[{**r,'weightedMarkup':round(r['weighted_markup']*100,1),'medianMarkup':round(r['median_markup']*100,1),'p25':round(r['p25']*100,1),'p75':round(r['p75']*100,1)} for r in data['network']]
text='''/** Pricing audit uses gross purchase/sales values and only surfaces pilot-test signals. */\n\n'''
text+='export const pricingNetwork = '+json.dumps(network,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const pricingByStore = '+json.dumps(out,ensure_ascii=False,indent=2)+' as const;\n\n'
text+='export const pricingMethodology = '+json.dumps(data['methodology'],ensure_ascii=False)+' as const;\n'
(ROOT/'client'/'src'/'data'/'pricingAuditData.ts').write_text(text,encoding='utf-8')
print(ROOT/'client'/'src'/'data'/'pricingAuditData.ts')

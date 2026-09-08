import json
import statistics
from pathlib import Path

ROOT = Path('/home/ubuntu/retail_profit_audit_2026')
src = ROOT/'audit_2026'/'deep_operational_excl_s2'/'deep_analysis.json'
target = ROOT/'client'/'src'/'data'/'deepAuditData.ts'
data = json.loads(src.read_text(encoding='utf-8'))

def million(v, digits=3): return round(v/1_000_000, digits)
def pct(v, digits=1): return round(v*100, digits)
def median_ratio(field):
    if field in data['median_ratios']:
        return data['median_ratios'][field]
    return statistics.median(item[field]/item['revenue'] for item in data['stores'] if item['revenue'])

colors=['#235C45','#4F826B','#80A993','#B08B4F','#8A7050','#737373','#C98272','#E34234','#A87466','#D1CDC5','#56766B','#A79470','#B9AFA1','#816F5E','#578064','#9C8D73','#B54437','#C1BBAF','#697F75','#987A60','#B26055']
categories=[]
for index, cat in enumerate(data['cost_categories']):
    categories.append({'label':cat['label'],'field':cat['field'],'amount':million(cat['amount']),'share':pct(cat['share_revenue']),'medianShare':pct(cat['median_ratio']),'color':colors[index % len(colors)]})
comparison_fields = [
    ('ФОТ: всего','payroll_total','#235C45'),
    ('Водитель: всего','driver_total','#4F826B'),
    ('Коммунальные: всего','utilities_total','#B08B4F'),
    ('Списания М.','writeoff_frozen','#E34234'),
    ('Аренда','rent','#8A7050'),
    ('Наличные операционные траты','cash_operating_total','#737373'),
]
comparison_categories = []
for label, field, color in comparison_fields:
    total = sum(item[field] for item in data['stores'])
    comparison_categories.append({'label':label,'field':field,'amount':million(total),'share':pct(total/data['network']['revenue']),'medianShare':pct(median_ratio(field)),'color':color})

monthly_by_store={}
for row in data['monthly_stores']:
    monthly_by_store.setdefault(row['store'],[]).append({
      'month':row['month'][:3],'revenue':million(row['revenue'],2),'grossProfit':million(row['gross_profit'],2),'netProfit':million(row['net_profit'],2),'grossMargin':pct(row['gross_profit']/row['revenue']) if row['revenue'] else 0,'netMargin':pct(row['net_profit']/row['revenue']) if row['revenue'] else 0
    })

stores=[]
for s in data['stores']:
    expenses=[]
    for cat in data['cost_categories']:
        f=cat['field']; expenses.append({'label':cat['label'],'field':f,'amount':million(s[f]),'share':pct(s[f]/s['revenue']) if s['revenue'] else 0,'medianShare':pct(data['median_ratios'][f]),'gap':million(s[f]-data['median_ratios'][f]*s['revenue'])})
    stores.append({
      'store':s['store'],'profitRank':s['profit_rank'],'marginRank':s['margin_rank'],'mixRank':s['mix_rank'],
      'revenue':million(s['revenue']),'grossProfit':million(s['gross_profit']),'netProfit':million(s['net_profit']),
      'grossMargin':pct(s['gross_margin']),'netMargin':pct(s['net_margin']),'bestMonth':s['best_month'],'worstMonth':s['worst_month'],'bestMonthProfit':million(s['best_month_profit'],2),'worstMonthProfit':million(s['worst_month_profit'],2),'lossMonths':s['loss_months'],
      'product':{'purchaseSmoked':million(s['purchase_smoked']),'purchaseFrozen':million(s['purchase_frozen']),'salesSmoked':million(s['sales_smoked']),'salesFrozen':million(s['sales_frozen']),'smokedMarkup':pct(s['smoked_markup']),'frozenMarkup':pct(s['frozen_markup']),'frozenSalesShare':pct(s['frozen_sales_share']),'frozenUplift':round(s['frozen_uplift_pp'],1)},
      'stock':{'open':million(s['stock_open']),'close':million(s['stock_close']),'change':million(s['stock_change']),'movement':million(s['movement']),'discount':million(s['discount']),'revaluation':million(s['revaluation']),'effect':million(s['inventory_effect']),'writeoffSmoked':million(s['writeoff_smoked']),'writeoffFrozen':million(s['writeoff_frozen']),'writeoffSmokedShare':pct(s['writeoff_smoked_share']),'writeoffFrozenShare':pct(s['writeoff_frozen_share'])},
      'expenses':expenses,'monthly':monthly_by_store[s['store']]
      ,'comparison':[
        {'label':label,'field':field,'amount':million(s[field]),'share':pct(s[field]/s['revenue']) if s['revenue'] else 0,'medianShare':pct(median_ratio(field)),'gap':million(s[field]-median_ratio(field)*s['revenue'])}
        for label,field,_ in comparison_fields
      ]
    })

network=data['network']
network_out={
  'revenue':million(network['revenue'],1),'grossProfit':million(network['gross_profit'],1),'netProfit':million(network['net_profit'],1),'grossMargin':pct(network['gross_margin']),'netMargin':pct(network['net_margin']),'stores':network['stores'],'lossStores':network['loss_stores'],'lossAmount':million(network['loss_amount'],1),'frozenMarkup':pct(network['frozen_markup']),'smokedMarkup':pct(network['smoked_markup']),'frozenShare':pct(network['frozen_sales_share']),'mixGrossCorrelation':round(network['frozen_share_gross_margin_correlation'],3),'mixNetCorrelation':round(network['frozen_share_net_margin_correlation'],3)
}
network_monthly=[{'month':r['month'][:3],'revenue':million(r['revenue'],1),'grossProfit':million(r['gross_profit'],2),'netProfit':million(r['net_profit'],2),'grossMargin':pct(r['gross_margin']),'netMargin':pct(r['net_margin']),'frozenShare':pct(r['frozen_sales_share'])} for r in data['monthly_network']]
ts='''/** Deep operational audit: corrected 2026.xlsx, Jan–Aug, without КА1/АЛА/МОЛ/С2/РЕЗ*. */\n\n'''
ts += 'export const network = '+json.dumps(network_out,ensure_ascii=False,indent=2)+' as const;\n\n'
ts += 'export const expenseCategories = '+json.dumps(categories,ensure_ascii=False,indent=2)+' as const;\n\n'
ts += 'export const comparisonCategories = '+json.dumps(comparison_categories,ensure_ascii=False,indent=2)+' as const;\n\n'
ts += 'export const networkMonthly = '+json.dumps(network_monthly,ensure_ascii=False,indent=2)+' as const;\n\n'
ts += 'export const stores = '+json.dumps(stores,ensure_ascii=False,indent=2)+' as const;\n'
target.write_text(ts,encoding='utf-8')
print(target)

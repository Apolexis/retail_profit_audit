"""Generate a compact but complete slide brief for each store, after excluding S2."""
import json
from pathlib import Path
import pandas as pd

ROOT = Path('/home/ubuntu/retail_profit_audit_2026')
WORK = ROOT/'audit_2026'/'audit_august_clean_excl_s2'
data = json.loads((WORK/'analysis_data.json').read_text(encoding='utf-8'))
monthly = pd.read_csv(WORK/'store_monthly.csv', encoding='utf-8-sig')
profiles = data['store_profiles']
by_profit = {x['store']: i+1 for i,x in enumerate(sorted(profiles,key=lambda r:r['net_profit'],reverse=True))}
by_margin = {x['store']: i+1 for i,x in enumerate(sorted(profiles,key=lambda r:r['net_margin'],reverse=True))}
network_margin = data['network_dashboard']['net_margin']
lines = ['## Cover','Супер-отчет: аудит прибыли магазинов','Январь–август 2026 · 32 магазина · без КА1, АЛА, МОЛ, С2 и РЕЗ*']
for title in ['Сеть: P&L и концентрация прибыли','Сезонность: прибыль, выручка и маржа','Матрица магазинов: выручка × маржа','Структура затрат и товарный остаток','Ловушки выручки и скрытые герои','Action Plan: деньги, сроки, владельцы','Аудит формул: контроль качества данных']:
    lines += ['','## Slide',f'### {title}']
for p in profiles:
    series = monthly[monthly['store']==p['store']].sort_values('month_number')['net_profit'].tolist()
    series_text=', '.join(f'{x/1_000_000:.2f}' for x in series)
    vs = (p['net_margin']-network_margin)*100
    lines += ['', '## Slide', f"### {p['store']} — отдельный сравнительный профиль", f"P&L: выручка {p['revenue']/1_000_000:.2f} млн; расходы {p['expenses']/1_000_000:.2f} млн; чистая прибыль {p['net_profit']/1_000_000:.2f} млн; чистая маржа {p['net_margin']*100:.1f}%.", f"Сравнение: ранг по прибыли {by_profit[p['store']]} из 32; ранг по марже {by_margin[p['store']]} из 32; отклонение от сети {vs:+.1f} п.п.", f"Сезонность: пик {p['best_month']} {p['best_month_profit']/1_000_000:.2f} млн; минимум {p['worst_month']} {p['worst_month_profit']/1_000_000:.2f} млн; месячная прибыль: {series_text} млн.", f"Драйвер: {p['narrative']}", f"Остаток: эффект {p['inventory_net_effect']/1_000_000:.2f} млн; перемещения {p['movement']/1_000_000:.2f}; уценка {p['discount']/1_000_000:.2f}; переоценка {p['revaluation']/1_000_000:.2f} млн."]
(ROOT/'deliverables'/'extended_presentation_content.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f"profiles={len(profiles)}")

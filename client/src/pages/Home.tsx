/**
 * AuditLine design reminder: editorial asymmetric layout; warm paper with forest-green
 * authority; bordeaux encodes risks; jade encodes confirmed improvement.
 */
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Copy, Download, Menu, Search, ShieldCheck, X } from "lucide-react";
import { actionPlan, auditChecks, costData, monthlyData, stores, type StoreProfile } from "@/data/auditData";

const heroImage = "/manus-storage/auditline-hero-2026_94861469.jpg";
const logoImage = "/manus-storage/auditline-logo_846ed825.png";

const fmtMoney = (n: number, digits = 1) => `${n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })} млн ₽`;
const fmtShort = (n: number) => `${n.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} млн`;

function Metric({ label, value, hint, risk = false }: { label: string; value: string; hint: string; risk?: boolean }) {
  return <article className={`metric ${risk ? "metric-risk" : ""}`}>
    <p>{label}</p><strong>{value}</strong><span>{hint}</span>
  </article>;
}

function StoreDrawer({ store, onClose }: { store: StoreProfile; onClose: () => void }) {
  const isLoss = store.netProfit < 0;
  return <div className="drawer-overlay" onClick={onClose} role="presentation">
    <aside className="store-drawer" onClick={(event) => event.stopPropagation()} aria-label={`Профиль магазина ${store.store}`}>
      <button className="icon-button" onClick={onClose} aria-label="Закрыть профиль"><X size={22} /></button>
      <p className="eyebrow">ПРОФИЛЬ МАГАЗИНА</p>
      <h2>{store.store}</h2>
      <div className={`drawer-outcome ${isLoss ? "negative" : "positive"}`}>
        <span>Чистая прибыль</span><strong>{fmtMoney(store.netProfit)}</strong><em>{store.netMargin.toFixed(1)}% чистая маржа</em>
      </div>
      <dl className="drawer-list">
        <div><dt>Выручка</dt><dd>{fmtMoney(store.revenue)}</dd></div>
        <div><dt>Валовая маржа</dt><dd>{store.grossMargin.toFixed(1)}%</dd></div>
        <div><dt>Лучший месяц</dt><dd>{store.bestMonth}</dd></div>
        <div><dt>Убыточных месяцев</dt><dd>{store.lossMonths}</dd></div>
        <div><dt>Главный резерв</dt><dd>{store.reserve}</dd></div>
        <div><dt>Резерв к медиане</dt><dd>{store.reserveAmount ? fmtMoney(store.reserveAmount) : "Не выявлен"}</dd></div>
      </dl>
      <div className="drawer-callout"><ShieldCheck size={20} /><p>{isLoss ? "Требуется индивидуальная траектория безубыточности с недельным P&L-контролем." : "Используйте как бенчмарк для точек сопоставимого формата и выручки."}</p></div>
    </aside>
  </div>;
}

export default function Home() {
  const [filter, setFilter] = useState<"all" | "leaders" | "losses" | "at-risk">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoreProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredStores = useMemo(() => stores.filter((store) => {
    const matchesQuery = store.store.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "leaders" && store.netMargin >= 5.3) || (filter === "losses" && store.netProfit < 0) || (filter === "at-risk" && store.netProfit >= 0 && store.netMargin < 2);
    return matchesQuery && matchesFilter;
  }).sort((a, b) => b.netProfit - a.netProfit), [filter, query]);

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true); window.setTimeout(() => setCopied(false), 1700);
  };

  return <main className="audit-page">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AuditLine, к началу отчета"><img src={logoImage} alt="" /><span>AuditLine</span></a>
      <nav className={menuOpen ? "nav nav-open" : "nav"} aria-label="Разделы отчета">
        <a href="#dynamics" onClick={() => setMenuOpen(false)}>Динамика</a>
        <a href="#portfolio" onClick={() => setMenuOpen(false)}>Портфель</a>
        <a href="#plan" onClick={() => setMenuOpen(false)}>План действий</a>
      </nav>
      <div className="topbar-actions">
        <button className="share-button" onClick={share}><Copy size={15} /> {copied ? "Ссылка скопирована" : "Поделиться"}</button>
        <button className="print-button" onClick={() => window.print()}><Download size={15} /> Сохранить</button>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню"><Menu size={20} /></button>
      </div>
    </header>

    <aside className="report-spine" aria-label="Корешок отчета">
      <a href="#top" className="spine-mark" aria-label="AuditLine, к началу"><img src={logoImage} alt="" /><span>AL</span></a>
      <div className="spine-rule" />
      <nav className="spine-nav" aria-label="Навигация отчета"><a href="#top"><b>00</b><span>Сводка</span></a><a href="#dynamics"><b>01</b><span>Динамика</span></a><a href="#portfolio"><b>03</b><span>Портфель</span></a><a href="#plan"><b>05</b><span>Действия</span></a></nav>
      <div className="spine-period"><span>ПЕРИОД</span><strong>2026</strong><small>ЯНВ–АВГ</small></div>
    </aside>

    <section id="top" className="hero">
      <img className="hero-photo" src={heroImage} alt="Аналитические материалы и график" />
      <div className="hero-content">
        <p className="eyebrow">РИТЕЙЛ-СЕТЬ · АУДИТ P&amp;L · ЯНВ–ИЮЛ 2026</p>
        <h1>Прибыль есть.<br /><em>Устойчивость — под вопросом.</em></h1>
        <p className="hero-lede">Очищенная сеть заработала <strong>26,9 млн ₽</strong> при выручке <strong>579,1 млн ₽</strong>. Однако 12 убыточных точек уже сформировали 4,7 млн ₽ потерь, а июльская маржа требует действий до следующего сезонного спада.</p>
        <a className="hero-link" href="#portfolio">Открыть портфель <ArrowDownRight size={18} /></a>
      </div>
      <div className="hero-note"><span>Период</span><strong>Январь–июль 2026</strong><small>Исключены РЕЗ*, АЛА и С2</small></div>
    </section>

    <section className="metrics-strip" aria-label="Ключевые показатели">
      <Metric label="Выручка" value="579,1 млн ₽" hint="январь–июль 2026" />
      <Metric label="Валовая прибыль" value="149,3 млн ₽" hint="маржа 25,8%" />
      <Metric label="Чистая прибыль" value="26,9 млн ₽" hint="маржа 4,6%" />
      <Metric label="Убыточные точки" value="12 из 34" hint="потери 4,7 млн ₽" risk />
    </section>

    <section className="section feature-grid traced" id="dynamics"><div className="audit-trail" aria-hidden="true"><span>ФАКТ</span><i/><span>РИСК</span><i/><span>ДЕЙСТВИЕ</span></div>
      <div className="section-intro">
        <p className="eyebrow">01 / ДИНАМИКА СЕТИ</p><h2>Продажи не гарантируют прибыль.</h2>
        <p>После марта сеть потеряла 19,9 млн ₽ выручки и 5,4 млн ₽ прибыли к маю. В июле чистая прибыль снизилась до 1,2 млн ₽ при чистой марже 1,6% — это операционный сигнал, а не статистический шум.</p>
        <div className="signal-list">
          <div><ArrowDownRight /><span>Провал: <strong>июль · 1,2 млн ₽</strong><small>чистая маржа 1,6%</small></span></div>
          <div><ArrowUpRight /><span>Пик: <strong>март · 6,7 млн ₽</strong><small>чистая маржа 7,0%</small></span></div>
        </div>
      </div>
      <div className="chart-panel trend-panel">
        <div className="panel-heading"><div><span className="tiny-label">ФАКТ ПО МЕСЯЦАМ</span><h3>Выручка и чистая прибыль</h3></div><span>млн ₽</span></div>
        <ResponsiveContainer width="100%" height={310}><AreaChart data={monthlyData} margin={{ top: 16, right: 6, left: -20, bottom: 0 }}>
          <defs><linearGradient id="profitFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#b6453d" stopOpacity={0.32}/><stop offset="95%" stopColor="#b6453d" stopOpacity={0}/></linearGradient></defs>
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b6964", fontSize: 12 }} /><YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: "#6b6964", fontSize: 11 }} /><YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#aa4439", fontSize: 11 }} />
          <Tooltip cursor={{ stroke: "#c8bfaf" }} contentStyle={{ border: "1px solid #d8d0c0", borderRadius: 0, background: "#fbf7ef" }} formatter={(value: number, name: string) => [`${value.toLocaleString("ru-RU")} млн ₽`, name]} />
          <Area yAxisId="left" type="monotone" dataKey="revenue" name="Выручка" stroke="#145b44" strokeWidth={2.5} fill="none" /><Area yAxisId="right" type="monotone" dataKey="profit" name="Чистая прибыль" stroke="#b6453d" strokeWidth={3} fill="url(#profitFill)" />
        </AreaChart></ResponsiveContainer>
        <p className="chart-footnote">Июль — минимальный месяц очищенного периода: валовая маржа снизилась до 23,9% против 26,6% в марте. Приоритет — закупочная цена, уценка, ассортимент и ФОТ.</p>
      </div>
    </section>

    <section className="section cost-section traced"><div className="audit-trail" aria-hidden="true"><span>ФАКТ</span><i/><span>ПРИЧИНА</span><i/><span>РЫЧАГ</span></div>
      <div className="cost-header"><p className="eyebrow">02 / СТРУКТУРА ЗАТРАТ</p><h2>После закупок главный рычаг — ФОТ.</h2></div>
      <div className="cost-layout">
        <div className="chart-panel donut-panel"><ResponsiveContainer width="100%" height={305}><PieChart><Pie data={costData} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={70} outerRadius={112} stroke="none" paddingAngle={2}>{costData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => `${value.toLocaleString("ru-RU")} млн ₽`} contentStyle={{ border: "1px solid #d8d0c0", borderRadius: 0, background: "#fbf7ef" }} /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-core"><span>ФОТ + налоги</span><strong>58,4</strong><small>млн ₽ · 9,0% выручки</small></div></div>
        <div className="cost-ledger">
          {costData.map((item, index) => <div className={index === 1 ? "cost-row highlighted" : "cost-row"} key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{fmtShort(item.value)}</strong><em>{((item.value / 648.1) * 100).toFixed(1)}%</em></div>)}
        <p>У <strong>7 из 12</strong> убыточных точек ФОТ и связанные налоги — крупнейший избыточный расход относительно медианы сети.</p>
        </div>
      </div>
    </section>

    <section className="section portfolio-section traced" id="portfolio"><div className="audit-trail" aria-hidden="true"><span>СЕТЬ</span><i/><span>ТОЧКА</span><i/><span>РЕЗЕРВ</span></div>
      <div className="portfolio-heading"><div><p className="eyebrow">03 / ПОРТФЕЛЬ МАГАЗИНОВ</p><h2>Сильные точки финансируют слабые.</h2></div><p>Три лидера — ПОРТ, КИР1 и А2 — создают <strong>59,6%</strong> чистой прибыли очищенной сети. Нажмите на строку, чтобы открыть профиль магазина.</p></div>
      <div className="rankings">
        <div className="ranking-card leader-card"><div className="card-top"><span>ЛИДЕРЫ ПО ПРИБЫЛИ</span><strong className="positive">16,0 млн ₽</strong></div>{stores.slice(0, 3).map((store, index) => <button key={store.store} onClick={() => setSelected(store)}><b>0{index + 1}</b><span>{store.store}</span><em>{fmtMoney(store.netProfit)}</em><i>{store.netMargin.toFixed(1)}%</i></button>)}</div>
        <div className="ranking-card risk-card"><div className="card-top"><span>САМЫЕ ГЛУБОКИЕ УБЫТКИ</span><strong className="negative">(2,2 млн ₽)</strong></div>{stores.slice(-3).reverse().map((store, index) => <button key={store.store} onClick={() => setSelected(store)}><b>0{index + 1}</b><span>{store.store}</span><em>{fmtMoney(store.netProfit)}</em><i>{store.netMargin.toFixed(1)}%</i></button>)}</div>
      </div>
      <div className="explorer">
        <div className="explorer-top"><div><span className="tiny-label">ИНТЕРАКТИВНЫЙ РЕЕСТР</span><h3>34 сопоставимые точки</h3></div><div className="explorer-controls"><label className="search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти магазин" /></label><div className="filter-group">{([["all", "Все"], ["leaders", "Выше сети"], ["losses", "Убыточные"], ["at-risk", "Риск"]] as const).map(([value, label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></div></div>
        <div className="store-table-wrap"><table><thead><tr><th>Магазин</th><th>Выручка</th><th>Чистая прибыль</th><th>Маржа</th><th>Лучший месяц</th><th>Главный резерв</th><th /></tr></thead><tbody>{filteredStores.map((store) => <tr key={store.store} onClick={() => setSelected(store)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(store)}><td><strong>{store.store}</strong>{store.lossMonths > 0 && <small>{store.lossMonths} убыточн. мес.</small>}</td><td>{fmtMoney(store.revenue)}</td><td className={store.netProfit < 0 ? "money-negative" : "money-positive"}>{fmtMoney(store.netProfit)}</td><td><span className={store.netMargin < 0 ? "margin-tag negative-tag" : store.netMargin >= 5.3 ? "margin-tag positive-tag" : "margin-tag"}>{store.netMargin.toFixed(1)}%</span></td><td>{store.bestMonth}</td><td><span className="reserve-name">{store.reserve}{store.reserveAmount > 0 && <small>{fmtMoney(store.reserveAmount)}</small>}</span></td><td><ArrowDownRight size={17}/></td></tr>)}</tbody></table></div>
      </div>
    </section>

    <section className="section anomaly-section traced"><div className="audit-trail" aria-hidden="true"><span>СИГНАЛ</span><i/><span>ПРИЧИНА</span><i/><span>ОТВЕТ</span></div><div className="anomaly-header"><p className="eyebrow">04 / АНОМАЛИИ</p><h2>Три ловушки выручки и один скрытый герой.</h2></div><div className="anomaly-grid"><article className="anomaly-card danger"><span className="tiny-label">ЛОВУШКА ВЫРУЧКИ</span><h3>П.ЗОР</h3><div className="anomaly-kpis"><strong>13,8 млн ₽<small>выручка</small></strong><strong>(128 тыс. ₽)<small>прибыль</small></strong><strong>(0,9%)<small>маржа</small></strong></div><p>Наличные операционные траты выше медианной доли выручки на <b>435 тыс. ₽</b>. Первый шаг — стоп нецелевых расходов и сверка первички.</p></article><article className="anomaly-card danger"><span className="tiny-label">ЛОВУШКА ВЫРУЧКИ</span><h3>МОН</h3><div className="anomaly-kpis"><strong>13,1 млн ₽<small>выручка</small></strong><strong>243 тыс. ₽<small>прибыль</small></strong><strong>1,9%<small>маржа</small></strong></div><p>ФОТ и налоги выше медианной доли выручки на <b>252 тыс. ₽</b>. Требуется пересборка графика и нормирование часов к трафику.</p></article><article className="anomaly-card hero-card"><span className="tiny-label">СКРЫТЫЙ ГЕРОЙ</span><h3>А3</h3><div className="anomaly-kpis"><strong>12,3 млн ₽<small>выручка</small></strong><strong>546 тыс. ₽<small>прибыль</small></strong><strong>4,4%<small>маржа</small></strong></div><p>Выручка ниже медианы очищенной сети, но маржа соответствует верхней трети распределения. Изучить SKU-матрицу, смены и закупочные условия.</p></article></div></section>

    <section id="plan" className="section plan-section traced"><div className="audit-trail" aria-hidden="true"><span>РЕШЕНИЕ</span><i/><span>ВЛАДЕЛЕЦ</span><i/><span>СРОК</span></div><div className="plan-lead"><p className="eyebrow">05 / ACTION PLAN</p><h2>Решения в первые 45 дней.</h2><p>Программа не заменяет проверку первичных документов и трафика. Она задает измеримые экономические развилки для дальнейшего решения по каждой точке.</p><div className="audit-checks">{auditChecks.map(([label, value]) => <div key={label}><CheckCircle2 size={16}/><span>{label}</span><strong>{value}</strong></div>)}</div></div><div className="action-list">{actionPlan.map((item, index) => <article key={item.point}><span>0{index + 1}</span><div><h3>{item.point}</h3><p>{item.action}</p></div><em>{item.owner}</em><b>{item.target}<small>{item.period}</small></b></article>)}</div></section>

    <section className="source-section"><div><p className="eyebrow">ПРОВЕРЕННЫЙ ИСТОЧНИК</p><h2>Формулы корректны.<br />Риск — в экономике точек.</h2></div><p>Проверено 516 месячных P&amp;L-блоков и 310 723 формульные ячейки. Ошибки формул и расхождения после независимого пересчета выше 0,15 ₽ не выявлены. Веб-срез ограничен январем–июлем и очищен от РЕЗ*, АЛА и С2.</p><a href="#top">Наверх <ArrowUpRight size={18}/></a></section>
    <footer><span>AuditLine · Супер-отчет по прибыли магазинов</span><span>Источник: учет2026.xlsm · Факт: январь–июль 2026 · без РЕЗ*, АЛА и С2</span></footer>
    {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
  </main>;
}

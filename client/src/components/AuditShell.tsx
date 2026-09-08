/** AuditLine shell: modern app navigation with an accessible mobile drawer. */
import { useState, type ReactNode } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAudit } from "@/contexts/AuditContext";
import "@/audit.css";

const logoImage = "/manus-storage/auditline-logo_846ed825.png";
const nav = [
  ["/", "00", "Сводка"], ["/months", "01", "Месяцы"], ["/pricing", "02", "Цены"],
  ["/expenses", "03", "Расходы"], ["/inventory", "04", "Остатки"], ["/stores", "05", "Магазины"],
  ["/compare", "06", "Сравнить"], ["/portfolio", "07", "Портфель"], ["/pilot", "08", "Пилот"],
] as const;

const recommendations: Record<string, { title:string; text:string; action:string }> = {
  "00": { title:"Сводка: куда смотреть сначала", text:"Сначала отделите рост выручки от роста маржи: прибыльный масштаб и запас должны двигаться согласованно.", action:"Откройте «Портфель» и выделите точки с отрицательной маржой или покрытием выше 20 дней." },
  "01": { title:"Месяцы: как читать отклонение", text:"Сравнивайте магазин не только с сетью, но и с месячной медианой — она исключает эффект общего сезонного подъема или спада.", action:"Выберите критичную статью и проверьте 2–3 месяца с наибольшим разрывом к медиане." },
  "02": { title:"Цены: только через пилот", text:"Наценка сама по себе не является решением: ее нужно читать вместе с объемом продаж, списаниями и чистой маржой.", action:"Проверяйте изменения цены на одной точке и одной категории не менее четырех недель." },
  "03": { title:"Расходы: находите источник разрыва", text:"Красное отклонение показывает превышение типичной точки. Это сигнал для проверки документа, а не автоматического сокращения.", action:"Сверьте с первичными документами три самые большие статьи выше медианы." },
  "04": { title:"Остатки: деньги должны работать", text:"Покрытие показывает, на сколько дней обычных продаж хватит остатка. Слишком высокий запас замораживает деньги, слишком низкий повышает риск отсутствия товара.", action:"Сначала проверьте точки выше 20 дней покрытия и с высокими списаниями М." },
  "05": { title:"Профиль: один магазин — одно решение", text:"Карточка объединяет P&L, товар и запас в одну точку принятия решения.", action:"Сравните выбранную точку с ее ближайшим конкурентом на странице «Сравнить»." },
  "06": { title:"Сравнение: ищите переносимую практику", text:"Разница между двумя магазинами полезна только если ее можно разложить на цену, расходы, запас или товарный поток.", action:"Меняйте показатель в селекторе и фиксируйте первопричину, а не только разрыв в прибыли." },
  "07": { title:"Портфель: баланс масштаба и запаса", text:"Карта показывает не рейтинг, а зоны управления: выручка, чистая маржа, покрытие и списания должны рассматриваться вместе.", action:"Сначала изучите точки с низкой маржой и одновременно высоким покрытием запаса." },
};

export function AuditShell({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  const [location] = useLocation();
  const {theme,toggleTheme,periodLabel,period,setPeriod}=useAudit();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const guidance=recommendations[kicker.slice(0,2)] ?? recommendations["00"];
  return <div className="packet"><aside className="packet-spine"><Link href="/" className="packet-mark"><img src={logoImage} alt="AuditLine"/><span>Audit</span><strong>LINE / 2026</strong></Link><div className="spine-caption">ОПЕРАЦИОННЫЙ<br/>АНАЛИЗ</div><nav className="packet-nav-list" aria-label="Разделы отчета">{nav.map(([href,number,label])=><Link key={href} href={href} className={location===href?"packet-nav active":"packet-nav"}><b>{number}</b><span>{label}</span></Link>)}</nav><div className="packet-period"><span>ПЕРИОД</span><strong>{periodLabel}</strong><small>2026</small></div></aside><header className="packet-top"><div><span className="packet-kicker">{kicker}</span><h1>{title}</h1></div><div className="packet-actions"><label className="period-control">Период<select value={period} onChange={event=>setPeriod(event.target.value as typeof period)}><option value="jan_aug">Янв–авг</option><option value="jan_apr">Янв–апр</option><option value="may_aug">Май–авг</option></select></label><button className="theme-button" aria-label="Переключить тему" onClick={toggleTheme}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}</button><button className="packet-mobile menu-button" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div></header>{menuOpen&&<button className="mobile-backdrop" aria-label="Закрыть меню" onClick={closeMenu}/>}<nav className={menuOpen?"mobile-drawer open":"mobile-drawer"} aria-label="Мобильная навигация"><div className="drawer-top"><span>НАВИГАЦИЯ</span><button aria-label="Закрыть меню" onClick={closeMenu}><X size={20}/></button></div>{nav.map(([href,number,label])=><Link key={href} href={href} onClick={closeMenu} className={location===href?"drawer-link active":"drawer-link"}><b>{number}</b><span>{label}</span></Link>)}<div className="drawer-period">Отчетный период: <strong>{periodLabel} 2026</strong></div></nav><main className="packet-main">{children}<aside className="section-recommendation"><span>УПРАВЛЕНЧЕСКИЙ ФОКУС</span><div><h3>{guidance.title}</h3><p>{guidance.text}</p></div><strong>{guidance.action}</strong></aside></main></div>;
}

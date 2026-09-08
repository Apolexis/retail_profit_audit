/** AuditLine shell: modern app navigation with an accessible mobile drawer. */
import { useState, type ReactNode } from "react";
import { Download, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import "@/audit.css";

const logoImage = "/manus-storage/auditline-logo_846ed825.png";
const nav = [
  ["/", "00", "Сводка"], ["/months", "01", "Месяцы"], ["/pricing", "02", "Цены"],
  ["/expenses", "03", "Расходы"], ["/inventory", "04", "Остатки"], ["/stores", "05", "Магазины"],
] as const;

export function AuditShell({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return <div className="packet"><aside className="packet-spine"><Link href="/" className="packet-mark"><img src={logoImage} alt="AuditLine"/><span>Audit</span><strong>LINE / 2026</strong></Link><div className="spine-caption">ОПЕРАЦИОННЫЙ<br/>АНАЛИЗ</div><nav className="packet-nav-list" aria-label="Разделы отчета">{nav.map(([href,number,label])=><Link key={href} href={href} className={location===href?"packet-nav active":"packet-nav"}><b>{number}</b><span>{label}</span></Link>)}</nav><div className="packet-period"><span>ПЕРИОД</span><strong>ЯНВ–АВГ</strong><small>2026</small></div></aside><header className="packet-top"><div><span className="packet-kicker">{kicker}</span><h1>{title}</h1></div><div className="packet-actions"><button className="save-button" onClick={()=>window.print()}><Download size={16}/>Экспорт</button><button className="packet-mobile menu-button" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div></header>{menuOpen&&<button className="mobile-backdrop" aria-label="Закрыть меню" onClick={closeMenu}/>}<nav className={menuOpen?"mobile-drawer open":"mobile-drawer"} aria-label="Мобильная навигация"><div className="drawer-top"><span>НАВИГАЦИЯ</span><button aria-label="Закрыть меню" onClick={closeMenu}><X size={20}/></button></div>{nav.map(([href,number,label])=><Link key={href} href={href} onClick={closeMenu} className={location===href?"drawer-link active":"drawer-link"}><b>{number}</b><span>{label}</span></Link>)}<div className="drawer-period">Отчетный период: <strong>январь–август 2026</strong></div></nav><main className="packet-main">{children}</main></div>;
}

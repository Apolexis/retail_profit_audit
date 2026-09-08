/** AuditLine shell: fixed report spine, utility top bar and page-specific analytical canvas. */
import type { ReactNode } from "react";
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
  return <div className="packet"><aside className="packet-spine"><Link href="/" className="packet-mark"><img src={logoImage} alt="AuditLine"/><span>AL</span><strong>AuditLine</strong></Link><span className="packet-rule"/>{nav.map(([href,number,label])=><Link key={href} href={href} className={location===href?"packet-nav active":"packet-nav"}><b>{number}</b><span>{label}</span></Link>)}<div className="packet-period"><span>ПЕРИОД</span><strong>2026</strong><small>ЯНВ–АВГ</small></div></aside><header className="packet-top"><div><span className="packet-kicker">{kicker}</span><h1>{title}</h1></div><div className="packet-actions"><button onClick={()=>window.print()}><Download size={15}/>Сохранить</button><button className="packet-mobile" aria-label="Навигация"><Menu size={17}/></button></div></header><main className="packet-main"><div className="packet-trail"><span>ФАКТ</span><i/><span>СРАВН.</span><i/><b>РИСК</b></div>{children}</main></div>;
}

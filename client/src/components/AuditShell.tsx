import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, BellRing, ChevronDown, Menu, Moon, RefreshCw, Sun, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import { DateRangeControl } from "@/components/DateRangeControl";
import "@/audit.css";
import "@/mobile-nav.css";

const compactBrandIcon={dark:"/manus-storage/rybny_pwa_dark_transparent_110da59a.png",light:"/manus-storage/rybny_pwa_light_transparent_d1223d9d.png"} as const;
export function BrandMark({theme}:{theme:"dark"|"light"}){return <span className="brand-mark-switch" aria-hidden="true">{(["dark","light"] as const).map(markTheme=><img key={markTheme} className={markTheme===theme?"brand-mark is-visible":"brand-mark"} src={compactBrandIcon[markTheme]} alt="" loading="eager" decoding="sync" draggable={false}/>)}</span>}
const navSections=[
  {title:"АНАЛИТИКА",items:[["/","00","Сводка",false],["/months","01","Месяцы",false],["/pricing","02","Цены",false],["/expenses","03","Расходы",false],["/inventory","04","Остатки",false],["/stores","05","Магазины",false],["/compare","06","Сравнить",false]]},
  {title:"РЕШЕНИЯ",items:[["/control","07","Динамика",false],["/cadence","08","Ритм",false],["/portfolio","09","Портфель",false],["/pilot","10","Пилот",false],["/forecast","19","Прогноз",false],["/planfact","11","План‑факт",false]]},
  {title:"УПРАВЛЕНИЕ",items:[["/notifications","17","Сигналы",false],["/reports","18","Отчеты",true],["/import","12","Импорт",true],["/manage","13","База",true],["/access","15","Доступ",true],["/history","16","Журнал",true]]},
] as const;
const profileItem=["/profile","14","Профиль",false] as const;

const recommendations:Record<string,{title:string;text:string;action:string}>={"00":{title:"Сводка: куда смотреть сначала",text:"Сначала отделите рост выручки от роста маржи: прибыльный масштаб и запас должны двигаться согласованно.",action:"Откройте «Портфель» и выделите точки с отрицательной маржой или покрытием выше 20 дней."},"01":{title:"Месяцы: как читать отклонение",text:"Сравнивайте магазин не только с сетью, но и с месячной медианой — она исключает эффект общего сезонного подъема или спада.",action:"Выберите критичную статью и проверьте 2–3 месяца с наибольшим разрывом к медиане."},"02":{title:"Цены: только через пилот",text:"Наценка сама по себе не является решением: ее нужно читать вместе с объемом продаж, списаниями и чистой маржой.",action:"Проверяйте изменения цены на одной точке и одной категории не менее четырех недель."},"03":{title:"Расходы: находите источник разрыва",text:"Красное отклонение показывает превышение типичной точки. Это сигнал для проверки документа, а не автоматического сокращения.",action:"Сверьте с первичными документами три самые большие статьи выше медианы."},"04":{title:"Остатки: деньги должны работать",text:"Покрытие показывает, на сколько дней обычных продаж хватит остатка. Слишком высокий запас замораживает деньги, слишком низкий повышает риск отсутствия товара.",action:"Сначала проверьте точки выше 20 дней покрытия и с высокими списаниями М."},"05":{title:"Профиль: один магазин — одно решение",text:"Карточка объединяет P&L, товар и запас в одну точку принятия решения.",action:"Сравните выбранную точку с ее ближайшим конкурентом на странице «Сравнить»."},"06":{title:"Сравнение: ищите переносимую практику",text:"Разница между двумя магазинами полезна только если ее можно разложить на цену, расходы, запас или товарный поток.",action:"Меняйте показатель в селекторе и фиксируйте первопричину, а не только разрыв в прибыли."},"07":{title:"Динамика: сравнивайте сопоставимые периоды",text:"Сравнение полезно, когда у периодов одинаковая длина и понятна база каждого из них.",action:"Сначала выберите два периода, затем смотрите абсолютное и процентное отклонение."},"08":{title:"Операционный ритм: первичные дни и ежемесячные статьи",text:"Продажи, закупки, списания и НДФЛ берутся из дневных строк. Согласованные месячные расходы материализуются по правилам импорта, а итоговая чистая прибыль — пропорционально фактической дневной расходной нагрузке.",action:"Для запаса и покрытия используйте «Остатки», для недельной динамики — этот раздел."},"09":{title:"Портфель: баланс масштаба и запаса",text:"Карта показывает не рейтинг, а зоны управления: выручка, чистая маржа, покрытие и списания должны рассматриваться вместе.",action:"Сначала изучите точки с низкой маржой и одновременно высоким покрытием запаса."},"10":{title:"Пилот: проверяйте предпосылки",text:"Сценарий показывает ориентировочный эффект допущений, а не гарантированный финансовый результат.",action:"Сопоставьте сценарий с фактом после полного периода работы."}};
recommendations["11"]={title:"План‑факт: управляйте ожиданиями",text:"Факт поступает из книги, а план вводится отдельно. Система не подставляет бюджет и не скрывает отсутствие плановых значений.",action:"Введите месячный план выручки и чистой прибыли для ключевых точек, затем оцените отклонение в выбранном срезе."};
recommendations["19"]={title:"Прогноз: сначала проверьте основу",text:"Прогноз масштабирует сезонность только по завершенным фактическим месяцам. Отсутствующие факты не заменяются усреднением.",action:"Сопоставьте ожидаемый месяц с планом, закупками и будущими операционными изменениями."};

export function AuditShell({title,kicker,children}:{title:string;kicker:string;children:ReactNode}){
  const [location,setLocation]=useLocation();
  const {theme,toggleTheme,rangeLabel,setSelectedStore}=useAudit();
  const me=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const notificationSummary=trpc.localAuth.notificationSummary.useQuery(undefined,{retry:false});
  const availableStores=trpc.audit.stores.useQuery(undefined,{retry:false});
  const [menuOpen,setMenuOpen]=useState(false);
  const [storeSearch,setStoreSearch]=useState("");
  const [showTop,setShowTop]=useState(false);
  const [expandedSections,setExpandedSections]=useState<Record<string,boolean>>({});
  const [standalone,setStandalone]=useState(()=>typeof window!=="undefined"&&(window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true));
  const gestureStart=useRef<number|null>(null);
  useEffect(()=>{const update=()=>setShowTop(window.scrollY>280);update();window.addEventListener("scroll",update,{passive:true});return()=>window.removeEventListener("scroll",update)},[]);
  useEffect(()=>{const media=window.matchMedia("(display-mode: standalone)");const update=()=>setStandalone(media.matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[]);
  const isAdmin=me.data?.role==="admin";
  const visibleNav=navSections.map(section=>({...section,items:section.items.filter(([, , ,adminOnly])=>!adminOnly||isAdmin)})).filter(section=>section.items.length>0);
  const closeMenu=()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();setMenuOpen(false)};
  const refreshApp=()=>{window.location.reload();};
  const matches=storeSearch.trim()?((availableStores.data??[]).filter(store=>store.name.toLowerCase().includes(storeSearch.trim().toLowerCase())).slice(0,6)):[];
  const chooseStore=(store:string)=>{setSelectedStore(store);setStoreSearch("");closeMenu();setLocation("/stores")};
  const guidance=recommendations[kicker.slice(0,2)]??recommendations["00"];
  const analyticsSection=!['12','13','14','15','16','17','18'].includes(kicker.slice(0,2));
  const unread=notificationSummary.data?.unread??0;
  const sectionIsActive=(items:readonly (readonly [string,string,string,boolean])[])=>items.some(([href])=>href===location);
  const sectionIsOpen=(section:{title:string;items:readonly (readonly [string,string,string,boolean])[]})=>Object.hasOwn(expandedSections,section.title)?Boolean(expandedSections[section.title]):sectionIsActive(section.items);
  const toggleSection=(title:string,defaultOpen:boolean)=>setExpandedSections(current=>{
    const open=Object.hasOwn(current,title)?Boolean(current[title]):defaultOpen;
    return {...current,[title]:!open};
  });

  return <div className="packet">
    <aside className="packet-spine">
      <Link href="/" className="packet-mark"><BrandMark theme={theme}/><span className="brand-title"><span>Аналитика</span><span>«Рыбный»</span></span></Link>
      <nav className="packet-nav-list" aria-label="Разделы системы">
        {visibleNav.map(section=>{const open=sectionIsOpen(section);return <section className={open?"nav-section is-open":"nav-section"} key={section.title}>
          <button type="button" className="nav-section-trigger" aria-expanded={open} onClick={()=>toggleSection(section.title,sectionIsActive(section.items))}><span className="nav-section-label">{section.title}</span><ChevronDown size={13}/></button>
          <div className="nav-section-links">{section.items.map(([href,,label])=><Link key={href} href={href} onClick={event=>event.currentTarget.blur()} className={location===href?"packet-nav active":"packet-nav"}><span>{label}</span>{href==="/notifications"&&unread>0&&<i className="nav-count">{unread>99?"99+":unread}</i>}</Link>)}</div>
        </section>})}<Link href={profileItem[0]} onClick={event=>event.currentTarget.blur()} className={location===profileItem[0]?"packet-nav packet-profile-link active":"packet-nav packet-profile-link"}><span>{profileItem[2]}</span></Link>
      </nav>
      <div className="packet-period"><span>АКТИВНЫЙ СРЕЗ</span><strong>{rangeLabel}</strong></div>
    </aside>
    <header className="packet-top"><div><span className="packet-kicker">{kicker.replace(/^\d+\s*\/\s*/,"")}</span><h1>{title}</h1></div><div className="packet-actions"><Link href="/notifications" className="alert-link" aria-label={`Уведомления${unread?`, ${unread} непрочитанных`:""}`}><BellRing size={17}/>{unread>0&&<i>{unread>99?"99+":unread}</i>}</Link><button className="theme-button" aria-label="Переключить тему" onClick={toggleTheme}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}</button><button className="packet-mobile menu-button" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} onClick={event=>{event.currentTarget.blur();setMenuOpen(value=>!value)}}>{menuOpen?<X size={18}/>:<Menu size={18}/>}</button></div></header>
    {menuOpen&&<button className="mobile-backdrop" aria-label="Закрыть меню" onClick={closeMenu}/>}<nav className={menuOpen?"mobile-drawer open":"mobile-drawer"} aria-label="Мобильная навигация" onPointerDown={event=>{gestureStart.current=event.clientX}} onPointerUp={event=>{if(gestureStart.current!==null&&event.clientX-gestureStart.current>60)closeMenu();gestureStart.current=null}}>
      <div className="drawer-top"><span>НАВИГАЦИЯ</span><button aria-label="Закрыть меню" onClick={closeMenu}><X size={20}/></button></div>
      <div className="drawer-search"><input value={storeSearch} onChange={event=>setStoreSearch(event.target.value)} placeholder="Найти назначенный магазин…"/>{matches.length>0&&<div>{matches.map(store=><button key={store.id} onClick={()=>chooseStore(store.name)}>{store.name}</button>)}</div>}</div>
      <div className="drawer-scroll">{visibleNav.map(section=>{const open=sectionIsOpen(section);return <section className={open?"nav-drawer-section is-open":"nav-drawer-section"} key={section.title}>
        <button type="button" className="nav-drawer-section-trigger" aria-expanded={open} onClick={()=>toggleSection(section.title,sectionIsActive(section.items))}><span className="nav-section-label">{section.title}</span><ChevronDown size={14}/></button>
        <div className="nav-drawer-section-links">{section.items.map(([href,,label])=><Link key={href} href={href} onClick={event=>{event.currentTarget.blur();closeMenu();}} className={location===href?"drawer-link active":"drawer-link"}><span>{label}</span>{href==="/notifications"&&unread>0&&<i className="nav-count">{unread>99?"99+":unread}</i>}</Link>)}</div>
      </section>})}<Link href={profileItem[0]} onClick={event=>{event.currentTarget.blur();closeMenu();}} className={location===profileItem[0]?"drawer-link drawer-profile-link active":"drawer-link drawer-profile-link"}><span>{profileItem[2]}</span></Link></div><div className="drawer-period">Активный срез:<strong>{rangeLabel}</strong></div>
    </nav>
    <main className="packet-main">{analyticsSection&&<section className={`analysis-filter${kicker.startsWith("00")?" summary-period-filter":""}`}><div className="analysis-filter-copy"><span>ОБЩИЙ СРЕЗ</span><strong>{rangeLabel}</strong><small>Применяется ко всем графикам, сравнениям и итогам текущего раздела.</small></div><DateRangeControl/></section>}{children}<aside className="section-recommendation"><span>УПРАВЛЕНЧЕСКИЙ ФОКУС</span><div><h3>{guidance.title}</h3><p>{guidance.text}</p></div><strong>{guidance.action}</strong></aside></main>
    {standalone&&<nav className="mobile-quick-nav" aria-label="Быстрые действия">
      <button type="button" className="mobile-quick-action mobile-quick-back" onClick={()=>{window.history.length>1?window.history.back():setLocation("/")}} aria-label="Назад"><ArrowLeft size={16}/><span>Назад</span></button>
      <button type="button" className="mobile-quick-action mobile-quick-forward" onClick={()=>window.history.forward()} aria-label="Вперёд"><ArrowRight size={16}/><span>Вперёд</span></button>
      <button type="button" className="mobile-quick-action mobile-quick-refresh" onClick={refreshApp} aria-label="Обновить данные"><RefreshCw size={16}/><span>Обновить</span></button>
    </nav>}
    {showTop&&!menuOpen&&<button className="scroll-top" aria-label="Вернуться к началу страницы" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><ArrowUp size={18}/></button>}
  </div>;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, BellRing, ChevronDown, Menu, Moon, Presentation, RefreshCw, Sun, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import { DateRangeControl } from "@/components/DateRangeControl";
import "@/audit.css";
import "@/mobile-nav.css";

const compactBrandIcon={dark:"/manus-storage/rybny_pwa_dark_transparent_110da59a.png",light:"/manus-storage/rybny_pwa_light_transparent_d1223d9d.png"} as const;
const quickRouteStorageKey="audit-quick-route-history";
export function BrandMark({theme}:{theme:"dark"|"light"}){return <span className="brand-mark-switch" aria-hidden="true">{(["dark","light"] as const).map(markTheme=><img key={markTheme} className={markTheme===theme?"brand-mark is-visible":"brand-mark"} src={compactBrandIcon[markTheme]} alt="" loading="eager" decoding="sync" draggable={false}/>)}</span>}
const isStandalonePwa=()=>typeof window!=="undefined"&&(window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true||document.documentElement.dataset.pwaStandalone==="true");
type NavAccess = boolean | "price" | "operations" | "revenue";
type NavItem = readonly [string, string, string, NavAccess];
type NavGroup = { title?: string; items: readonly NavItem[] };
type NavSection = { title: string; groups: readonly NavGroup[] };

const navSections: readonly NavSection[] = [
  { title: "УПРАВЛЕНИЕ МАГАЗИНАМИ", groups: [{ items: [["/revenue", "23", "Выручка", "revenue"], ["/stock-control", "24", "Остатки", "operations"], ["/inventory-control", "25", "Инвентаризации", "operations"], ["/catalog-control", "26", "Номенклатура", true], ["/warehouse-control", "27", "Склады", true], ["/print-settings", "31", "Настройки печати", true], ["/requests", "30", "Заявки", "operations"]] }] },
  { title: "АНАЛИЗ МАГАЗИНОВ", groups: [
    { title: "АНАЛИТИКА", items: [["/", "00", "Сводка", false], ["/months", "01", "Месяцы", false], ["/pricing", "02", "Цены", false], ["/expenses", "03", "Расходы", false], ["/inventory", "04", "Остатки", false], ["/stores", "05", "Магазины", false], ["/compare", "06", "Сравнить", false], ["/evotor-sales/metrics", "28", "Показатели Эвотор", true], ["/evotor-sales/products", "29", "Проданные товары", true]] },
    { title: "РЕШЕНИЯ", items: [["/control", "07", "Динамика", false], ["/cadence", "08", "Ритм", false], ["/portfolio", "09", "Портфель", false], ["/pilot", "10", "Пилот", false], ["/forecast", "19", "Прогноз", false], ["/planfact", "11", "План‑факт", false]] },
    { title: "УПРАВЛЕНИЕ", items: [["/import", "12", "Импорт", true], ["/manage", "13", "База", true]] },
  ] },
  { title: "ПРАЙС‑КОНТРОЛЬ", groups: [{ items: [["/price-control", "20", "Сравнение", "price"], ["/price-control/import", "21", "Импорт прайсов", "price"], ["/price-control/directory", "22", "Справочник", "price"]] }] },
  { title: "УПРАВЛЕНИЕ", groups: [{ items: [["/notifications", "17", "Сигналы", false], ["/reports", "18", "Отчеты", true], ["/access", "15", "Доступ", true], ["/history", "16", "Журнал", true]] }] },
];
const profileItem=["/profile","14","Профиль",false] as const;

const recommendations:Record<string,{title:string;text:string;action:string}>={"00":{title:"Сводка: куда смотреть сначала",text:"Сначала отделите рост выручки от роста маржи: прибыльный масштаб и запас должны двигаться согласованно.",action:"Откройте «Портфель» и выделите точки с отрицательной маржой или покрытием выше 20 дней."},"01":{title:"Месяцы: как читать отклонение",text:"Сравнивайте магазин не только с сетью, но и с месячной медианой — она исключает эффект общего сезонного подъема или спада.",action:"Выберите критичную статью и проверьте 2–3 месяца с наибольшим разрывом к медиане."},"02":{title:"Цены: только через пилот",text:"Наценка сама по себе не является решением: ее нужно читать вместе с объемом продаж, списаниями и чистой маржой.",action:"Проверяйте изменения цены на одной точке и одной категории не менее четырех недель."},"03":{title:"Расходы: находите источник разрыва",text:"Красное отклонение показывает превышение типичной точки. Это сигнал для проверки документа, а не автоматического сокращения.",action:"Сверьте с первичными документами три самые большие статьи выше медианы."},"04":{title:"Остатки: деньги должны работать",text:"Покрытие показывает, на сколько дней обычных продаж хватит остатка. Слишком высокий запас замораживает деньги, слишком низкий повышает риск отсутствия товара.",action:"Сначала проверьте точки выше 20 дней покрытия и с высокими списаниями М."},"05":{title:"Профиль: один магазин — одно решение",text:"Карточка объединяет P&L, товар и запас в одну точку принятия решения.",action:"Сравните выбранную точку с ее ближайшим конкурентом на странице «Сравнить»."},"06":{title:"Сравнение: ищите переносимую практику",text:"Разница между двумя магазинами полезна только если ее можно разложить на цену, расходы, запас или товарный поток.",action:"Меняйте показатель в селекторе и фиксируйте первопричину, а не только разрыв в прибыли."},"07":{title:"Динамика: сравнивайте сопоставимые периоды",text:"Сравнение полезно, когда у периодов одинаковая длина и понятна база каждого из них.",action:"Сначала выберите два периода, затем смотрите абсолютное и процентное отклонение."},"08":{title:"Операционный ритм: первичные дни и ежемесячные статьи",text:"Продажи, закупки, списания и НДФЛ берутся из дневных строк. Согласованные месячные расходы материализуются по правилам импорта, а итоговая чистая прибыль — пропорционально фактической дневной расходной нагрузке.",action:"Для запаса и покрытия используйте «Остатки», для недельной динамики — этот раздел."},"09":{title:"Портфель: баланс масштаба и запаса",text:"Карта показывает не рейтинг, а зоны управления: выручка, чистая маржа, покрытие и списания должны рассматриваться вместе.",action:"Сначала изучите точки с низкой маржой и одновременно высоким покрытием запаса."},"10":{title:"Пилот: проверяйте предпосылки",text:"Сценарий показывает ориентировочный эффект допущений, а не гарантированный финансовый результат.",action:"Сопоставьте сценарий с фактом после полного периода работы."}};
recommendations["11"]={title:"План‑факт: управляйте ожиданиями",text:"Факт поступает из книги, а план вводится отдельно. Система не подставляет бюджет и не скрывает отсутствие плановых значений.",action:"Введите месячный план выручки и чистой прибыли для ключевых точек, затем оцените отклонение в выбранном срезе."};
recommendations["19"]={title:"Прогноз: сначала проверьте основу",text:"Прогноз масштабирует сезонность только по завершенным фактическим месяцам. Отсутствующие факты не заменяются усреднением.",action:"Сопоставьте ожидаемый месяц с планом, закупками и будущими операционными изменениями."};
recommendations["20"]={title:"Прайс‑контроль: сравнивайте сопоставимое",text:"Низкая цена полезна только при одинаковом товаре, фасовке и условиях. Сначала подтвердите связь поставщика с внутренним товаром, затем выбирайте лучшее предложение.",action:"Проверьте строки на сопоставление и закрепите только подтвержденные соответствия поставщиков."};
recommendations["23"]={title:"Выручка: передавайте фактический день",text:"Наличные расходы должны быть разнесены по строкам. Пояснение обязательно для нецелевых трат, но не требуется для зарплаты, премии, отпускных и коммунальных платежей. Это операционный реестр, который не заменяет финансовый факт и не меняет P&L.",action:"Перед передачей проверьте итог и пояснения к тем расходам, для которых они нужны."};
recommendations["24"]={title:"Остатки: точность важнее видимости",text:"Учетный остаток существует только после закрытого пересчета или подтвержденного движения. Значение «Не посчитан» нельзя подменять нулем.",action:"Выберите точку или товар, затем перейдите к ревизии только для реально посчитанной позиции."};
recommendations["25"]={title:"Инвентаризация: сначала подтверждайте физический факт",text:"Пересчет фиксирует то, что реально есть в магазине. До закрытия строки можно исправить; после закрытия корректировка остается отдельным неизменяемым движением.",action:"Откройте пересчет по своей точке, внесите только посчитанные позиции и передайте черновик руководителю на закрытие."};
recommendations["26"]={title:"Номенклатура: только через рабочий справочник",text:"Каталог Эвотор читается только для сопоставленной точки. Ручные позиции и внутренняя себестоимость остаются внутри операционного контура и не отправляются в кассу.",action:"Сначала выберите точку и проверьте ее каталог, затем подтверждайте или корректируйте рабочую номенклатуру."};
recommendations["27"]={title:"Склады: назначайте цену, а не дублируйте товар",text:"У магазина есть назначенный вид продажной цены, а товарный справочник остается единым для сети. Связь с Эвотором остается только для чтения.",action:"Назначьте активный вид цены складу, затем заполните цены товаров в общей номенклатуре."};
recommendations["28"]={title:"Показатели Эвотор: сначала источник",text:"Экран показывает только уже нормализованные read-only чеки Эвотор. Он не дополняет и не заменяет финансовый P&L из исходной книги.",action:"Выберите общий срез или конкретные магазины, затем сравните сумму, число и средний чек по времени."};
recommendations["29"]={title:"Проданные товары: от динамики к составу",text:"График показывает ритм товарного потока, а таблица под ним — состав проданных строк за выбранный период. Внутренняя себестоимость сюда не попадает.",action:"Сначала оцените общую динамику, затем найдите товарные позиции с наибольшей суммой и количеством."};
recommendations["30"]={title:"Заявки: сначала потребность, затем печать",text:"Черновик помогает магазину собрать потребность без изменения остатков. После закрытия строки становятся снимком для печатных групп.",action:"Добавьте товары и количество, передайте черновик руководителю, затем распечатайте закрытые заявки по группе и категории."};
recommendations["31"]={title:"Настройки печати: сначала состав",text:"Группы магазинов и категории товаров настраиваются отдельно от самих заявок. История закрытых заявок остается неизменяемой.",action:"Назначьте видимые магазины в группу, затем добавьте категории номенклатуры в нужные подборки."};

export function AuditShell({title,kicker,children}:{title:string;kicker:string;children:ReactNode}){
  const [location,setLocation]=useLocation();
  const {theme,toggleTheme,demoMode,toggleDemoMode,rangeLabel,setSelectedStore}=useAudit();
  const me=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const notificationSummary=trpc.localAuth.notificationSummary.useQuery(undefined,{retry:false});
  const availableStores=trpc.audit.stores.useQuery(undefined,{retry:false});
  const [menuOpen,setMenuOpen]=useState(false);
  const [storeSearch,setStoreSearch]=useState("");
  const [showTop,setShowTop]=useState(false);
  const [expandedSections,setExpandedSections]=useState<Record<string,boolean>>({});
  const [standalone,setStandalone]=useState(isStandalonePwa);
  const [fixedEpoch,setFixedEpoch]=useState(0);
  const [isRefreshing,setIsRefreshing]=useState(false);
  const [historyMotion,setHistoryMotion]=useState<"back"|"forward"|null>(null);
  const gestureStart=useRef<number|null>(null);
  const quickRouteHistoryRef=useRef<string[]>([]);
  const quickRouteCursorRef=useRef(0);
  useEffect(()=>{const update=()=>setShowTop(window.scrollY>280);update();window.addEventListener("scroll",update,{passive:true});return()=>window.removeEventListener("scroll",update)},[]);
  useEffect(()=>{const media=window.matchMedia("(display-mode: standalone)");const update=()=>setStandalone(isStandalonePwa());update();media.addEventListener("change",update);window.addEventListener("pageshow",update);document.addEventListener("visibilitychange",update);return()=>{media.removeEventListener("change",update);window.removeEventListener("pageshow",update);document.removeEventListener("visibilitychange",update)}},[]);
  useEffect(()=>{
    const persist=()=>{try{window.sessionStorage.setItem(quickRouteStorageKey,JSON.stringify({paths:quickRouteHistoryRef.current,cursor:quickRouteCursorRef.current}))}catch{}};
    if(quickRouteHistoryRef.current.length===0){
      try{
        const saved=JSON.parse(window.sessionStorage.getItem(quickRouteStorageKey)??"null") as {paths?:unknown;cursor?:unknown}|null;
        const paths=Array.isArray(saved?.paths)?saved.paths.filter((path):path is string=>typeof path==="string"&&path.startsWith("/")):[];
        if(paths.length>0&&typeof saved?.cursor==="number"&&saved.cursor>=0&&saved.cursor<paths.length){quickRouteHistoryRef.current=paths;quickRouteCursorRef.current=saved.cursor;}
      }catch{}
      if(quickRouteHistoryRef.current.length===0){quickRouteHistoryRef.current=[location];quickRouteCursorRef.current=0;}
    }
    const paths=quickRouteHistoryRef.current;
    const cursor=quickRouteCursorRef.current;
    if(paths[cursor]!==location){
      const knownCursor=paths.lastIndexOf(location);
      if(knownCursor>=0)quickRouteCursorRef.current=knownCursor;
      else {paths.splice(cursor+1);paths.push(location);quickRouteCursorRef.current=paths.length-1;}
    }
    persist();
  },[location]);
  useEffect(()=>{if(!standalone)return;let firstFrame:number|undefined;let secondFrame:number|undefined;let settleTimer:number|undefined;const refreshFixedControls=()=>{if(document.visibilityState==="hidden")return;if(firstFrame!==undefined)window.cancelAnimationFrame(firstFrame);if(secondFrame!==undefined)window.cancelAnimationFrame(secondFrame);if(settleTimer!==undefined)window.clearTimeout(settleTimer);document.documentElement.classList.add("pwa-fixed-reflow");firstFrame=window.requestAnimationFrame(()=>{secondFrame=window.requestAnimationFrame(()=>{setFixedEpoch(epoch=>epoch+1);settleTimer=window.setTimeout(()=>{setFixedEpoch(epoch=>epoch+1);document.documentElement.classList.remove("pwa-fixed-reflow");},220);});});};const viewport=window.visualViewport;const onVisible=()=>{if(document.visibilityState==="visible")refreshFixedControls();};refreshFixedControls();window.addEventListener("pageshow",refreshFixedControls);window.addEventListener("focus",refreshFixedControls);window.addEventListener("orientationchange",refreshFixedControls);document.addEventListener("visibilitychange",onVisible);viewport?.addEventListener("resize",refreshFixedControls);viewport?.addEventListener("scroll",refreshFixedControls);return()=>{if(firstFrame!==undefined)window.cancelAnimationFrame(firstFrame);if(secondFrame!==undefined)window.cancelAnimationFrame(secondFrame);if(settleTimer!==undefined)window.clearTimeout(settleTimer);document.documentElement.classList.remove("pwa-fixed-reflow");window.removeEventListener("pageshow",refreshFixedControls);window.removeEventListener("focus",refreshFixedControls);window.removeEventListener("orientationchange",refreshFixedControls);document.removeEventListener("visibilitychange",onVisible);viewport?.removeEventListener("resize",refreshFixedControls);viewport?.removeEventListener("scroll",refreshFixedControls);};},[standalone]);
  const isAdmin=me.data?.role==="admin";
  const isSeller=me.data?.role==="seller";
  const isManager=me.data?.role==="manager";
  const hasPriceAccess=isAdmin||Boolean(me.data?.priceAccessLevel&&me.data.priceAccessLevel!=="none");
  const visibleNav=navSections.map(section=>({...section,groups:section.groups.map(group=>({...group,items:group.items.filter(([, , ,access])=>access==="revenue"?(isAdmin||isSeller):access==="operations"?(isAdmin||isSeller||isManager):(isSeller||isManager)?false:access===true?isAdmin:access==="price"?hasPriceAccess:true)})).filter(group=>group.items.length>0)})).filter(section=>section.groups.length>0);
  const closeMenu=()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();setMenuOpen(false)};
  const refreshPage=async()=>{
    if(isRefreshing)return;
    setIsRefreshing(true);
    // Два кадра гарантируют, что пользователь увидит отклик действия до обновления страницы.
    await new Promise<void>(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve())));
    await new Promise<void>(resolve=>window.setTimeout(resolve,320));
    window.location.reload();
  };
  const moveHistory=(direction:"back"|"forward")=>{
    if(historyMotion)return;
    const paths=quickRouteHistoryRef.current;
    const cursor=quickRouteCursorRef.current;
    let target:string|null=null;
    if(direction==="back"){
      if(cursor>0)target=paths[cursor-1];
      else if(location!=="/"){
        paths.unshift("/");
        quickRouteCursorRef.current=1;
        try{window.sessionStorage.setItem(quickRouteStorageKey,JSON.stringify({paths,cursor:1}))}catch{}
        target="/";
      }
    }else if(cursor<paths.length-1)target=paths[cursor+1];
    if(!target||target===location)return;
    setHistoryMotion(direction);
    window.setTimeout(()=>{
      setLocation(target);
      setHistoryMotion(null);
    },180);
  };
  const toggleDemo=()=>{toggleDemoMode();};
  const matches=storeSearch.trim()?((availableStores.data??[]).filter(store=>store.name.toLowerCase().includes(storeSearch.trim().toLowerCase())).slice(0,6)):[];
  const chooseStore=(store:string)=>{setSelectedStore(store);setStoreSearch("");closeMenu();setLocation("/stores")};
  const guidance=recommendations[kicker.slice(0,2)]??recommendations["00"];
  const analyticsSection=!['12','13','14','15','16','17','18','20','21','22','23','24','25','26','27','28','29','30','31'].includes(kicker.slice(0,2));
  const unread=notificationSummary.data?.unread??0;
  const routeIsActive=(href:string)=>href===location||(href==="/catalog-control"&&location.startsWith("/catalog-control/"));
  const sectionIsActive=(groups:readonly NavGroup[])=>groups.some(group=>group.items.some(([href])=>routeIsActive(href)));
  const sectionIsOpen=(section:NavSection)=>Object.hasOwn(expandedSections,section.title)?Boolean(expandedSections[section.title]):sectionIsActive(section.groups);
  const toggleSection=(title:string,defaultOpen:boolean)=>setExpandedSections(current=>{
    const open=Object.hasOwn(current,title)?Boolean(current[title]):defaultOpen;
    return {...current,[title]:!open};
  });

  return <div className={standalone?"packet pwa-standalone":"packet"} data-demo-mode={demoMode?"true":"false"}>
    <aside className="packet-spine">
      <Link href="/" className="packet-mark"><BrandMark theme={theme}/><span className="brand-title"><span>Аналитика</span><span>«Рыбный»</span></span></Link>
      <nav className="packet-nav-list" aria-label="Разделы системы">
        {visibleNav.map(section=>{const open=sectionIsOpen(section);return <section className={open?"nav-section is-open":"nav-section"} key={section.title}>
          <button type="button" className="nav-section-trigger" aria-expanded={open} onClick={()=>toggleSection(section.title,sectionIsActive(section.groups))}><span className="nav-section-label">{section.title}</span><ChevronDown size={13}/></button>
          <div className="nav-section-links">{section.groups.map(group=><div className="nav-subsection" key={group.title??"root"}>{group.title&&<span className="nav-subsection-label">{group.title}</span>}<div className="nav-subsection-links">{group.items.map(([href,,label])=><Link key={href} href={href} onClick={event=>event.currentTarget.blur()} className={location===href?"packet-nav active":"packet-nav"}><span>{label}</span>{href==="/notifications"&&unread>0&&<i className="nav-count">{unread>99?"99+":unread}</i>}</Link>)}</div></div>)}</div>
        </section>})}<Link href={profileItem[0]} onClick={event=>event.currentTarget.blur()} className={location===profileItem[0]?"packet-nav packet-profile-link active":"packet-nav packet-profile-link"}><span>{profileItem[2]}</span></Link>
      </nav>
      <button className={demoMode?"packet-demo-toggle is-active":"packet-demo-toggle"} type="button" aria-pressed={demoMode} onClick={toggleDemo}><Presentation size={15}/><span>Демо‑режим</span><em>{demoMode?"Включен":"Выключен"}</em></button>
      <div className="packet-period"><span>АКТИВНЫЙ СРЕЗ</span><strong>{rangeLabel}</strong></div>
    </aside>
    <header key={`packet-top-${theme}`} className="packet-top" data-audit-theme={theme} style={{backgroundColor:theme==="dark"?"#0c0b12":"#ffffff",colorScheme:theme}}><div><span className="packet-kicker">{kicker.replace(/^\d+\s*\/\s*/,"")}</span><h1>{title}</h1></div><div className="packet-actions">{!isSeller&&!isManager&&<Link href="/notifications" className="alert-link" aria-label={`Уведомления${unread?`, ${unread} непрочитанных`:""}`}><BellRing size={17}/>{unread>0&&<i>{unread>99?"99+":unread}</i>}</Link>}<button className="theme-button" aria-label="Переключить тему" onClick={toggleTheme}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}</button><button className="packet-mobile menu-button" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} onClick={event=>{event.currentTarget.blur();setMenuOpen(value=>!value)}}>{menuOpen?<X size={18}/>:<Menu size={18}/>}</button></div></header>
    {menuOpen&&<button className="mobile-backdrop" aria-label="Закрыть меню" onClick={closeMenu}/>}<nav className={menuOpen?"mobile-drawer open":"mobile-drawer"} aria-label="Мобильная навигация" onPointerDown={event=>{gestureStart.current=event.clientX}} onPointerUp={event=>{if(gestureStart.current!==null&&event.clientX-gestureStart.current>60)closeMenu();gestureStart.current=null}}>
      <div className="drawer-top"><span>НАВИГАЦИЯ</span><button aria-label="Закрыть меню" onClick={closeMenu}><X size={20}/></button></div>
      <div className="drawer-search"><input value={storeSearch} onChange={event=>setStoreSearch(event.target.value)} placeholder="Найти назначенный магазин…"/>{matches.length>0&&<div>{matches.map(store=><button key={store.id} onClick={()=>chooseStore(store.name)}>{store.name}</button>)}</div>}</div>
      <div className="drawer-scroll">{visibleNav.map(section=>{const open=sectionIsOpen(section);return <section className={open?"nav-drawer-section is-open":"nav-drawer-section"} key={section.title}>
        <button type="button" className="nav-drawer-section-trigger" aria-expanded={open} onClick={()=>toggleSection(section.title,sectionIsActive(section.groups))}><span className="nav-section-label">{section.title}</span><ChevronDown size={14}/></button>
        <div className="nav-drawer-section-links">{section.groups.map(group=><div className="nav-drawer-subsection" key={group.title??"root"}>{group.title&&<span className="nav-drawer-subsection-label">{group.title}</span>}<div>{group.items.map(([href,,label])=><Link key={href} href={href} onClick={event=>{event.currentTarget.blur();closeMenu();}} className={location===href?"drawer-link active":"drawer-link"}><span>{label}</span>{href==="/notifications"&&unread>0&&<i className="nav-count">{unread>99?"99+":unread}</i>}</Link>)}</div></div>)}</div>
      </section>})}<Link href={profileItem[0]} onClick={event=>{event.currentTarget.blur();closeMenu();}} className={location===profileItem[0]?"drawer-link drawer-profile-link active":"drawer-link drawer-profile-link"}><span>{profileItem[2]}</span></Link></div><button className={demoMode?"drawer-demo-toggle is-active":"drawer-demo-toggle"} type="button" aria-pressed={demoMode} onClick={toggleDemo}><Presentation size={16}/><span>Демо‑режим</span><em>{demoMode?"Включен":"Выключен"}</em></button><div className="drawer-period">Активный срез:<strong>{rangeLabel}</strong></div>
    </nav>
    <main className="packet-main">{analyticsSection&&<section className={`analysis-filter${kicker.startsWith("00")?" summary-period-filter":""}`}><div className="analysis-filter-copy"><span>ОБЩИЙ СРЕЗ</span><strong>{rangeLabel}</strong><small>Применяется ко всем графикам, сравнениям и итогам текущего раздела.</small></div><DateRangeControl/></section>}{children}<aside className="section-recommendation"><span>УПРАВЛЕНЧЕСКИЙ ФОКУС</span><div><h3>{guidance.title}</h3><p>{guidance.text}</p></div><strong>{guidance.action}</strong></aside></main>
    {standalone&&!menuOpen&&<nav key={`mobile-quick-nav-${fixedEpoch}`} className="mobile-quick-nav" aria-label="Быстрые действия">
      <button type="button" className={historyMotion==="back"?"mobile-quick-action mobile-quick-back is-navigating":"mobile-quick-action mobile-quick-back"} onClick={()=>moveHistory("back")} disabled={historyMotion!==null} aria-label="Назад"><ArrowLeft size={16}/><span>Назад</span></button>
      <button type="button" className={historyMotion==="forward"?"mobile-quick-action mobile-quick-forward is-navigating":"mobile-quick-action mobile-quick-forward"} onClick={()=>moveHistory("forward")} disabled={historyMotion!==null} aria-label="Вперёд"><ArrowRight size={16}/><span>Вперёд</span></button>
      <button type="button" className={isRefreshing?"mobile-quick-action mobile-quick-refresh is-refreshing":"mobile-quick-action mobile-quick-refresh"} onClick={refreshPage} disabled={isRefreshing} aria-label="Обновить страницу"><span className="mobile-quick-refresh-icon" aria-hidden="true"><RefreshCw size={16}/></span><span>{isRefreshing?"Обновляем":"Обновить"}</span></button>
    </nav>}
    {showTop&&!menuOpen&&<button key={`scroll-top-${fixedEpoch}`} className="scroll-top" aria-label="Вернуться к началу страницы" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><ArrowUp size={18}/></button>}
  </div>;
}

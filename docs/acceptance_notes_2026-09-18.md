# Проверка приёмки — 18.09.2026

В авторизованном dev-preview вручную проверены изменения прайс-контроля. Во вкладке «Связи» карточка показывает заголовок только имени связи, а входящие товары — отдельным вторичным списком; у первой связи отображалось три самостоятельных товара. Отметка группы выводит панель массовых действий «Скрыть выбранные» и «Снять выбор» без выполнения операции. В редакторе существующего товара видны раздельные поля «Имя связи» с внутренним поиском и «Новое имя связи», а код подписан как «Код товара».

В сравнении проверен двухэтапный сценарий: выбранное имя связи открывает товар этой связи, затем выбор товара определяет заголовок и историю предложений. В живой тёмной теме нет белых маркеров или вертикального hover-курсора на графике. Консоль браузера не показала ошибок. Скриншоты без авторизованной сессии показывают вход и не используются как оценка страниц прайс-контроля.

Проверка регулярной синхронизации: два Heartbeat-задания зарегистрированы и включены. Однако журнал первой задачи документов зафиксировал timeout, поэтому прежний пакетный запуск нельзя считать рабочим. Код изменён на работу с одним закреплённым складом на callback, с восьмисекундным внешним timeout и ротацией очереди; требуется публикация версии и проверка следующего запуска в production.


После преобразования строк остатков в карточки для ширины до 760 px в авторизованном desktop-preview подтверждены: данные-label присутствуют у всех девяти ячеек, действие «Изменить в пересчете» — flex-row с иконкой слева, горизонтального переполнения страницы нет. На широком экране таблица сохраняет drag-scroll как оправданная таблица девяти показателей; фактическая ширина таблицы 1622 px остается внутри прокручиваемого контейнера.


В авторизованном preview найдена незакрытая регрессия light-темы инвентаризации: карточка имеет тёмную границу `rgb(59,36,53)`, а primary-кнопка — тёмный фон `rgb(38,19,29)` при синем тексте. Это конфликтующий поздний override, а не принятый цветовой контракт; он будет удалён/переопределён в изолированных стилях перед приёмкой блока.


CSSOM trace for the affected inventory primary action found several competing late generic `.packet .packet-link` rules, including an unconditional dark `#26131d` background, after prior component-level rules. This confirms that the mismatch is a cascade conflict; the next edit will scope the operating actions after all generic layers rather than introduce a new color family.


После точечной коррекции в последнем тематическом слое повторная проверка light-темы инвентаризации подтвердила: у рабочей карточки фон `rgb(247,251,255)` и голубая граница `rgb(199,226,255)`, у primary-действия — ровный `rgb(10,132,255)` без градиента, белый контрастный текст и расположение иконки слева.


В live-preview каталога подтверждено, что отображаемый номер — последовательный бизнес-номер, а не PK. Одновременно найдено несоответствие: UI показывает 812 активных строк вместо подтвержденных 816, потому что запрос списка исключает архивные позиции. Это будет исправлено показом всех 816 строк с явной меткой и действием «Вернуть» для неактивной позиции, без удаления данных.


Повторная live-проверка после корректировки подтверждает полный общий каталог: **816 товаров**. В таблице отображается бизнес-номер («№ / ID / артикул») с последовательными значениями; внутренний PK не выводится. Четыре позиции с нераспознанной единицей не скрываются, а честно отмечены «Уточнить» до ручной корректировки карточки.


В live-preview склада после завершения запросов подтверждены **32** нескрытых склада, их назначения видов цен, печатной группы и статус read-only закрепления Эвотор без адресов/технических ID. Ручные кнопки чтения каталога и документов отсутствуют; в выбранной настройке отражены будущие автоматические интервалы 15/10 минут. Начальная «0 склада / загрузка» — обычное состояние до завершения пяти параллельных запросов, ошибок запросов не выявлено.


По новой приемке найдены и исправлены две визуальные регрессии. В «Выручке» поля суммы и сами input теперь имеют три различимых уровня light-поверхности (карточка → секция → поле) и отдельный глубокий input в dark-теме; focus остается только контуром. В dark-теме «Складов» outer-card, шапка и zebra-строки приведены к нейтральной палитре «Анализа магазинов» (`#16101a` / `#1c1420` / `#1b121c`) с коралловым контуром, вместо серо-синих поверхностей. Также удален вывод имени автора у строки выручки, поскольку фактическое значение могло содержать логин/телефон.


В dark live-preview «Выручки» проверена конечная иерархия редактора: нейтральная outer-card `#16101a`, секция `#110d14`, плитка суммы `#19131d`, ввод `#0e0a11` с контуром `#4b2c3c`. Поля больше не сливаются с фоном. В реестре автора больше не выводится: повторная проверка DOM подтвердила отсутствие ранее обнаруженного телефонного/логиноподобного значения.


При диагностике dark-стиля вручную менялся только атрибут HTML, что искусственно рассинхронизировало `data-audit-theme` и `data-pwa-theme`. Для корректной приемки состояние возвращено через `localStorage.audit-theme` и полную перезагрузку; последующие проверки проводятся только через штатный переключатель/новую загрузку.


После штатной перезагрузки в light-теме оба theme-атрибута синхронны. Форму «Выручки» проверено по вычисленным стилям: секция `#edf6ff`, плитка суммы `#f8fcff`, input `#fff` с голубым контуром `#9dcbed`; поля читаемо отделены от окружающих блоков без кораллового акцента.


В live-preview «Складов» редактор существующей группы печати содержит отдельные действия «Сохранить», «Скрыть», «Удалить», «Отмена». Удаление требует явного браузерного подтверждения и на сервере отсоединяет только склады; товар, цена, документ и история печати не затрагиваются. Действие не выполнялось в приемке, чтобы не менять пользовательскую конфигурацию.


В live-preview карточки товара подтверждены: «К списку» — обычная ссылка с иконкой слева; НДС — компактное поле; штрихкоды — одно широкое поле, без горизонтального выхода; при выборе «Маркированное пиво» появляются алкокод, controlled-select кода вида АП (ФСРАР), крепость и объем тары. Добавлен read-only вывод документированного кода типа товара Эвотор: `NORMAL` или `ALCOHOL_MARKED`; это информационное соответствие для будущего согласованного контракта, не операция записи в Эвотор. В live после HMR для текущего товара БАД отображается `NORMAL`.


Для безопасной проверки login без выхода из авторизованного dev-preview открыт публичный домен. В этот момент страница вернула только title без DOM, поэтому визуальная проверка на опубликованном домене не засчитывается и изменение сессии в рабочем preview не выполнялось. Контракт входа подтвержден исходным кодом и 6 целевыми тестами; полноценную live-проверку login следует повторить после доступности public DOM либо в отдельной неавторизованной сессии.


Изолированный mobile-capture 375×812 открывает неавторизованный экран входа для всех запрошенных маршрутов, что подтвердило фактический iOS-подобный переключатель входа для магазинов в dark-теме: pill 38×22, круглый thumb, без видимой browser-checkbox. Иконка темы в dark имеет желтый цвет. Проверка light-значения остается контрактной (`#20202a`), так как screenshot-service начинает новую неавторизованную dark-сессию для каждого маршрута.


Live desktop inspection of `/stock-control` exposed the remaining light-table issue: although the outer working card was white, the stock table used `#f7fbff` for odd rows and `#edf6ff` for even rows, so a large table looked solid blue. The next correction will retain iOS-blue as a card/contour accent but make the tabular body a near-white zebra, consistent with «Ритм». At this inspection, page-level horizontal overflow was zero.


After the table correction, live light `/stock-control` styles are: outer card `#f7fbff`, table frame white, odd row white, even row `#fafcff`, header `#f2f8ff`, and page overflow 0 px. This retains the requested iOS-blue hierarchy outside the data body while restoring the near-white zebra rhythm.


Live dark `/stock-control` inspection confirms the shared neutral/coral hierarchy: outer card and odd rows `#16101a`, header and even rows `#1c1420`, with no peach fill or moving-row hover. Page overflow remains 0 px.


Live dark `/inventory-control` inspection confirms zero page overflow and the requested neutral/coral hierarchy: new-counting card `#16101a`, history row `#17111b`, and the main action `#26131d` with coral contour/text, without a peach fill or secondary square hover tile.


Live light `/inventory-control` inspection confirms zero page overflow: create card `#f7fbff`, history row white, and primary action iOS-blue `#0a84ff` with white text. The visual system therefore has the same blue/near-white hierarchy as the corrected stock screen.


Live light `/catalog-control` inspection exposed the same overly-blue striped data body and then confirmed the correction: outer card `#f7fbff`, white table frame and odd rows, `#fafcff` even rows, `#f2f8ff` header, and 0 px page overflow. The business catalog count remained 816; visible identifiers are sequential business numbers rather than database primary keys.


The two new admin-only Evotor sales routes were opened in the authenticated preview. Their navigation appears under «Управление магазинами»; the store chooser is collapsed by default, has 0 px horizontal overflow, and the empty state explicitly states that it waits only for automatic read-only document loading. The dark product page uses the existing neutral/coral contour pattern, with no added palette. At this moment there are no normalized receipts in the selected 2026 range, so the graph/table’s populated state cannot honestly be visually accepted until the production scheduler executes successfully.


Live desktop acceptance of `/catalog-control` confirmed the general catalog still contains 816 items, the visible business number begins from 1, and the technical primary key is not printed. The table’s edit control is now a 32px icon-only semantic link: it has no visual text, retains the full accessible label and tooltip, and the page has 0 px horizontal overflow outside of its dedicated table wrapper.


Live acceptance of the warehouse list after the surface correction confirmed 32 visible warehouses. In the dark theme the list card is `#16101a` and table heading `#1c1420`; after the standard theme toggle, the light page has the blue operational hierarchy while table rows remain near-white. The page has 0 px horizontal overflow outside its dedicated table structure. Open settings and request-print category cards now use the same warehouse surface tokens instead of generic grey panels.


The isolated 375×812 screenshot runner was used for eight operating and price routes. It correctly reaches the compact login surface for each route but does not share the authenticated browser session, so it cannot be used to falsely claim visual acceptance of protected operating data. The compact login itself fits within the viewport with the iOS-like store switch and left-aligned icons. Protected-page mobile behavior remains covered by the explicit per-page responsive CSS/contract suite; final visual acceptance of authenticated tables must use a real signed-in narrow device session.


The browser diagnostic view after the current dashboard and warehouse changes contains no console errors. The previous Vite transform messages were historical development output; current TypeScript verification and the live browser session are clean.


В рамках приёмки компоновки прайс-контроля и «Управления магазинами» выровнены базовые поверхности интерактивных полей. На светлой теме рабочая карточка использует `#f7fbff` с контуром `#c7e2ff`, вложенные input/select — белую поверхность с тем же голубым контуром; в темной теме рабочая карточка — `#16101a`, вложенные input/select — `#110d14`, а контур — `#3b2435`. Коралловый `#ff765f` оставлен только для выбора, фокуса и hover, не как заливка таблиц или карточек.

В живом desktop-preview на `/warehouse-control` подтверждены 32 склада, отсутствие горизонтального переполнения, активный mouse-drag на таблице и корректная тематическая иерархия. В light вычисленные значения: карточка и обертка таблицы `#f7fbff`, поля/селекты белые, все границы `#c7e2ff`; в dark: карточка/таблица `#16101a`, поля/селекты `#110d14`, границы `#3b2435`. В живом `/price-control` подтверждено отсутствие горизонтального переполнения и та же иерархия для основного блока сравнения.

Для ширины 761–1120 px строки сохраненного preview прайса перестроены: название занимает независимую широкую левую область, а цены и связь — правую. До 760 px каждая строка становится вертикальной карточкой, поэтому длинное название, селекты и кнопки не сдавливают друг друга и не требуют боковой прокрутки. Основные подтверждающие действия могут занимать полную строку только на узком экране; вторичные controls остаются компактными.

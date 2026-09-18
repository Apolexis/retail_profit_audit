# Справка о типах товара Эвотор V2 — 18.09.2026

Источник: [официальная документация Эвотор «Схемы товаров»](https://developer.evotor.ru/docs/rest_api_get_schemas_products.html), прочитана 18.09.2026.

В документации перечислены типы товара, включая `NORMAL`, `DAIRY_MARKED`, `WATER_MARKED`, `ALCOHOL_NOT_MARKED`, `ALCOHOL_MARKED`, `NOT_ALCOHOL_BEER_MARKED`, `BEER_MARKED_KEG`, `BEER_MARKED`, `DIETARY_SUPPLEMENTS_MARKED`, `JUICE_MARKED`, `CAVIAR_MARKED` и `GROCERIES_MARKED`. Эти коды должны быть единственным источником соответствия между управляемым селектом маркировки и будущим типом товара Эвотор.

Для текущего read-only контура это справочное соответствие. Исходящий вызов или выгрузка в Эвотор не выполняются.

## Проверенные правила V2

Дополнительно изучены [общий обзор Cloud API V2](https://developer.evotor.ru/docs/rest_overview.html), [руководство по V2](https://developer.evotor.ru/docs/rest_api_v2_migration_guide.html) и [список документов магазина](https://developer.evotor.ru/docs/rest_api_get_store_documents.html).

Cloud API использует явный заголовок `application/vnd.evotor.v2+json`. Пагинируемые ответы содержат до 1 000 элементов и `paging.next_cursor`; следующая страница передаётся как query-параметр `cursor`. Лимиты не фиксированы в документации: API возвращает их в заголовках `X-RateLimit-Limit`, `X-RateLimit-Remaining` и `X-RateLimit-Reset`, поэтому фоновая синхронизация должна последовательно обрабатывать закрепленные магазины и ограничивать работу одной cursor-страницей за callback.

V2 отличает товары и товарные группы. Любая будущая обратная перезапись отдельна от текущего read-only контура, поскольку документация предупреждает, что перезапись номенклатуры удаляет старые данные.

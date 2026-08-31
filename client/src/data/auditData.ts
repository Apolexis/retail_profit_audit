/**
 * AuditLine design reminder: warm-paper editorial report, forest-green authority,
 * bordeaux for risk, jade for verified improvement. Basis: Jan–Jul 2026, exclusions applied.
 */
export type StoreProfile = { store: string; revenue: number; netProfit: number; netMargin: number; grossMargin: number; bestMonth: string; lossMonths: number; reserve: string; reserveAmount: number; };

export const monthlyData = [
  {
    "month": "Янв",
    "revenue": 77.7,
    "profit": 5.33,
    "margin": 6.9
  },
  {
    "month": "Фев",
    "revenue": 85.6,
    "profit": 5.32,
    "margin": 6.2
  },
  {
    "month": "Мар",
    "revenue": 96.1,
    "profit": 6.72,
    "margin": 7.0
  },
  {
    "month": "Апр",
    "revenue": 90.7,
    "profit": 4.5,
    "margin": 5.0
  },
  {
    "month": "Май",
    "revenue": 76.2,
    "profit": 1.32,
    "margin": 1.7
  },
  {
    "month": "Июн",
    "revenue": 75.6,
    "profit": 2.47,
    "margin": 3.3
  },
  {
    "month": "Июл",
    "revenue": 77.2,
    "profit": 1.21,
    "margin": 1.6
  }
];

export const costData = [
  {
    "name": "Закупки",
    "value": 429.8,
    "color": "#145b44"
  },
  {
    "name": "ФОТ + налоги",
    "value": 54.8,
    "color": "#aa4439"
  },
  {
    "name": "Аренда",
    "value": 19.0,
    "color": "#b4985f"
  },
  {
    "name": "Налог",
    "value": 17.9,
    "color": "#6f746c"
  },
  {
    "name": "Банковская комиссия",
    "value": 9.9,
    "color": "#3d8b79"
  },
  {
    "name": "Коммунальные платежи за наличные",
    "value": 6.5,
    "color": "#d7cebb"
  },
  {
    "name": "Операционные траты за наличные",
    "value": 6.4,
    "color": "#879d94"
  },
  {
    "name": "Списания",
    "value": 6.2,
    "color": "#c7bfae"
  },
  {
    "name": "Уценка",
    "value": 0.9,
    "color": "#e1b6a5"
  }
];

export const stores: StoreProfile[] = [
  {
    "store": "ПОРТ",
    "revenue": 87.825,
    "netProfit": 7.509,
    "netMargin": 8.5,
    "grossMargin": 22.2,
    "bestMonth": "Июль",
    "lossMonths": 0,
    "reserve": "Банковская комиссия",
    "reserveAmount": 0.056
  },
  {
    "store": "КИР1",
    "revenue": 42.388,
    "netProfit": 4.33,
    "netMargin": 10.2,
    "grossMargin": 25.8,
    "bestMonth": "Апрель",
    "lossMonths": 0,
    "reserve": "Банковская комиссия",
    "reserveAmount": 0.002
  },
  {
    "store": "А2",
    "revenue": 39.155,
    "netProfit": 4.168,
    "netMargin": 10.6,
    "grossMargin": 26.7,
    "bestMonth": "Март",
    "lossMonths": 0,
    "reserve": "Налог с валовой прибыли",
    "reserveAmount": 0.022
  },
  {
    "store": "ОЛЕ",
    "revenue": 23.48,
    "netProfit": 2.008,
    "netMargin": 8.6,
    "grossMargin": 26.6,
    "bestMonth": "Февраль",
    "lossMonths": 0,
    "reserve": "Операционные траты за наличные",
    "reserveAmount": 0.148
  },
  {
    "store": "А1",
    "revenue": 25.419,
    "netProfit": 1.955,
    "netMargin": 7.7,
    "grossMargin": 27.4,
    "bestMonth": "Март",
    "lossMonths": 0,
    "reserve": "Аренда",
    "reserveAmount": 0.092
  },
  {
    "store": "КИР3",
    "revenue": 17.029,
    "netProfit": 1.475,
    "netMargin": 8.7,
    "grossMargin": 26.1,
    "bestMonth": "Апрель",
    "lossMonths": 1,
    "reserve": "Банковская комиссия",
    "reserveAmount": 0.012
  },
  {
    "store": "КОВ",
    "revenue": 23.877,
    "netProfit": 1.316,
    "netMargin": 5.5,
    "grossMargin": 28.1,
    "bestMonth": "Март",
    "lossMonths": 1,
    "reserve": "Аренда",
    "reserveAmount": 0.498
  },
  {
    "store": "ПОЛ",
    "revenue": 14.457,
    "netProfit": 1.307,
    "netMargin": 9.0,
    "grossMargin": 27.5,
    "bestMonth": "Март",
    "lossMonths": 1,
    "reserve": "Списания",
    "reserveAmount": 0.097
  },
  {
    "store": "КА2",
    "revenue": 12.413,
    "netProfit": 1.18,
    "netMargin": 9.5,
    "grossMargin": 29.6,
    "bestMonth": "Март",
    "lossMonths": 0,
    "reserve": "Налог с валовой прибыли",
    "reserveAmount": 0.049
  },
  {
    "store": "ЗАП",
    "revenue": 19.392,
    "netProfit": 1.104,
    "netMargin": 5.7,
    "grossMargin": 26.2,
    "bestMonth": "Апрель",
    "lossMonths": 1,
    "reserve": "Списания",
    "reserveAmount": 0.053
  },
  {
    "store": "С1",
    "revenue": 21.829,
    "netProfit": 0.917,
    "netMargin": 4.2,
    "grossMargin": 25.2,
    "bestMonth": "Июнь",
    "lossMonths": 0,
    "reserve": "Списания",
    "reserveAmount": 0.203
  },
  {
    "store": "КНИП",
    "revenue": 26.459,
    "netProfit": 0.854,
    "netMargin": 3.2,
    "grossMargin": 24.4,
    "bestMonth": "Февраль",
    "lossMonths": 2,
    "reserve": "Аренда",
    "reserveAmount": 0.362
  },
  {
    "store": "ГС2",
    "revenue": 14.812,
    "netProfit": 0.753,
    "netMargin": 5.1,
    "grossMargin": 25.8,
    "bestMonth": "Март",
    "lossMonths": 1,
    "reserve": "Коммунальные платежи за наличные",
    "reserveAmount": 0.108
  },
  {
    "store": "К49",
    "revenue": 15.439,
    "netProfit": 0.582,
    "netMargin": 3.8,
    "grossMargin": 26.1,
    "bestMonth": "Январь",
    "lossMonths": 2,
    "reserve": "Аренда",
    "reserveAmount": 0.244
  },
  {
    "store": "А3",
    "revenue": 12.299,
    "netProfit": 0.546,
    "netMargin": 4.4,
    "grossMargin": 26.6,
    "bestMonth": "Июнь",
    "lossMonths": 1,
    "reserve": "Аренда",
    "reserveAmount": 0.403
  },
  {
    "store": "СНЕЖ",
    "revenue": 10.707,
    "netProfit": 0.435,
    "netMargin": 4.1,
    "grossMargin": 26.3,
    "bestMonth": "Январь",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.069
  },
  {
    "store": "Л76",
    "revenue": 10.907,
    "netProfit": 0.392,
    "netMargin": 3.6,
    "grossMargin": 24.3,
    "bestMonth": "Январь",
    "lossMonths": 2,
    "reserve": "Списания",
    "reserveAmount": 0.092
  },
  {
    "store": "К80",
    "revenue": 10.168,
    "netProfit": 0.275,
    "netMargin": 2.7,
    "grossMargin": 26.2,
    "bestMonth": "Январь",
    "lossMonths": 2,
    "reserve": "Списания",
    "reserveAmount": 0.369
  },
  {
    "store": "ГС1",
    "revenue": 15.222,
    "netProfit": 0.257,
    "netMargin": 1.7,
    "grossMargin": 26.3,
    "bestMonth": "Февраль",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.363
  },
  {
    "store": "МОН",
    "revenue": 14.472,
    "netProfit": 0.13,
    "netMargin": 0.9,
    "grossMargin": 25.9,
    "bestMonth": "Апрель",
    "lossMonths": 4,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.258
  },
  {
    "store": "ЗАО",
    "revenue": 9.516,
    "netProfit": 0.054,
    "netMargin": 0.6,
    "grossMargin": 26.6,
    "bestMonth": "Март",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.447
  },
  {
    "store": "ПЗ2",
    "revenue": 10.641,
    "netProfit": 0.027,
    "netMargin": 0.3,
    "grossMargin": 25.8,
    "bestMonth": "Февраль",
    "lossMonths": 4,
    "reserve": "Аренда",
    "reserveAmount": 0.314
  },
  {
    "store": "КИР2",
    "revenue": 10.428,
    "netProfit": -0.023,
    "netMargin": -0.2,
    "grossMargin": 27.0,
    "bestMonth": "Март",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.253
  },
  {
    "store": "РОС",
    "revenue": 9.139,
    "netProfit": -0.117,
    "netMargin": -1.3,
    "grossMargin": 26.8,
    "bestMonth": "Март",
    "lossMonths": 4,
    "reserve": "Коммунальные платежи за наличные",
    "reserveAmount": 0.252
  },
  {
    "store": "МИРА",
    "revenue": 7.632,
    "netProfit": -0.221,
    "netMargin": -2.9,
    "grossMargin": 27.1,
    "bestMonth": "Март",
    "lossMonths": 4,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.399
  },
  {
    "store": "П.ЗОР",
    "revenue": 14.509,
    "netProfit": -0.227,
    "netMargin": -1.6,
    "grossMargin": 27.9,
    "bestMonth": "Февраль",
    "lossMonths": 3,
    "reserve": "Операционные траты за наличные",
    "reserveAmount": 0.442
  },
  {
    "store": "ПЗ1",
    "revenue": 9.151,
    "netProfit": -0.272,
    "netMargin": -3.0,
    "grossMargin": 25.0,
    "bestMonth": "Март",
    "lossMonths": 6,
    "reserve": "Аренда",
    "reserveAmount": 0.333
  },
  {
    "store": "МАК",
    "revenue": 7.098,
    "netProfit": -0.341,
    "netMargin": -4.8,
    "grossMargin": 27.0,
    "bestMonth": "Март",
    "lossMonths": 5,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.391
  },
  {
    "store": "МОЛ",
    "revenue": 1.369,
    "netProfit": -0.419,
    "netMargin": -30.6,
    "grossMargin": 19.7,
    "bestMonth": "Апрель",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.201
  },
  {
    "store": "УМБА",
    "revenue": 7.142,
    "netProfit": -0.461,
    "netMargin": -6.5,
    "grossMargin": 26.4,
    "bestMonth": "Июнь",
    "lossMonths": 6,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.441
  },
  {
    "store": "КА1",
    "revenue": 6.865,
    "netProfit": -0.475,
    "netMargin": -6.9,
    "grossMargin": 28.6,
    "bestMonth": "Январь",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.684
  },
  {
    "store": "С3",
    "revenue": 7.175,
    "netProfit": -0.481,
    "netMargin": -6.7,
    "grossMargin": 25.6,
    "bestMonth": "Март",
    "lossMonths": 6,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.491
  },
  {
    "store": "НИК",
    "revenue": 8.945,
    "netProfit": -0.688,
    "netMargin": -7.7,
    "grossMargin": 25.7,
    "bestMonth": "Январь",
    "lossMonths": 7,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 0.374
  },
  {
    "store": "Н95",
    "revenue": 11.762,
    "netProfit": -0.981,
    "netMargin": -8.3,
    "grossMargin": 27.1,
    "bestMonth": "Март",
    "lossMonths": 7,
    "reserve": "ФОТ и налоги на персонал",
    "reserveAmount": 1.038
  }
];

export const actionPlan = [
  {
    "point": "Н95",
    "owner": "Операции · HR",
    "period": "20 дней",
    "target": "1.038 млн ₽",
    "action": "Переразвернуть смены и роли; привязать ФОТ к трафику."
  },
  {
    "point": "КА1",
    "owner": "Операции · HR",
    "period": "30 дней",
    "target": "0.684 млн ₽",
    "action": "Нормировать штатные часы и подтвердить экономику формата."
  },
  {
    "point": "МОЛ",
    "owner": "Операции · развитие",
    "period": "45 дней",
    "target": "0.201 млн ₽",
    "action": "Подтвердить безубыточность; при отсутствии эффекта — закрыть или релокировать."
  },
  {
    "point": "ПЗ1",
    "owner": "Развитие · коммерция",
    "period": "45 дней",
    "target": "0.333 млн ₽",
    "action": "Переговоры по аренде; при отказе — релокационный сценарий."
  },
  {
    "point": "П.ЗОР",
    "owner": "Финансы · розница",
    "period": "10 дней",
    "target": "0.442 млн ₽",
    "action": "Сверить наличные траты с первичкой и установить месячные лимиты."
  }
];

export const auditChecks = [["Проверено исходных листов", "43"], ["Проверено месячных P&L-блоков", "516"], ["Сверено формульных ячеек", "310 723"], ["Ошибки и расхождения > 0,15 руб.", "0"]] as const;

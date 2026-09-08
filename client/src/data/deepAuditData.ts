/** Deep operational audit: corrected 2026.xlsx, Jan–Aug, without КА1/АЛА/МОЛ/С2/РЕЗ*. */

export const network = {
  "revenue": 655.1,
  "grossProfit": 167.7,
  "netProfit": 31.8,
  "grossMargin": 25.6,
  "netMargin": 4.9,
  "stores": 32,
  "lossStores": 10,
  "lossAmount": 4.2,
  "frozenMarkup": 45.4,
  "smokedMarkup": 26.2,
  "frozenShare": 46.4,
  "mixGrossCorrelation": 0.935,
  "mixNetCorrelation": 0.025
} as const;

export const expenseCategories = [
  {
    "label": "Аренда",
    "field": "rent",
    "amount": 22.164,
    "share": 3.4,
    "medianShare": 3.8,
    "color": "#235C45"
  },
  {
    "label": "Налог с валовой прибыли",
    "field": "gross_profit_tax",
    "amount": 20.126,
    "share": 3.1,
    "medianShare": 3.1,
    "color": "#4F826B"
  },
  {
    "label": "Зарплата (наличные)",
    "field": "salary_cash",
    "amount": 19.503,
    "share": 3.0,
    "medianShare": 2.8,
    "color": "#80A993"
  },
  {
    "label": "Зарплата (безнал)",
    "field": "salary_cashless",
    "amount": 19.219,
    "share": 2.9,
    "medianShare": 3.7,
    "color": "#B08B4F"
  },
  {
    "label": "Банковская комиссия",
    "field": "bank_fee",
    "amount": 11.075,
    "share": 1.7,
    "medianShare": 1.7,
    "color": "#8A7050"
  },
  {
    "label": "Налоги на ФОТ",
    "field": "payroll_tax",
    "amount": 8.658,
    "share": 1.3,
    "medianShare": 1.6,
    "color": "#737373"
  },
  {
    "label": "Коммунальные (безнал)",
    "field": "utilities_cashless",
    "amount": 7.42,
    "share": 1.1,
    "medianShare": 1.2,
    "color": "#C98272"
  },
  {
    "label": "Водитель (безнал)",
    "field": "driver_cashless",
    "amount": 6.572,
    "share": 1.0,
    "medianShare": 1.1,
    "color": "#E34234"
  },
  {
    "label": "НДФЛ",
    "field": "personal_income_tax",
    "amount": 5.956,
    "share": 0.9,
    "medianShare": 0.8,
    "color": "#A87466"
  },
  {
    "label": "Отпускные (безнал)",
    "field": "vacation_cashless",
    "amount": 3.974,
    "share": 0.6,
    "medianShare": 0.7,
    "color": "#D1CDC5"
  },
  {
    "label": "Выслуга",
    "field": "service_bonus",
    "amount": 2.259,
    "share": 0.3,
    "medianShare": 0.3,
    "color": "#56766B"
  },
  {
    "label": "Налоги на отпускные",
    "field": "vacation_tax",
    "amount": 1.967,
    "share": 0.3,
    "medianShare": 0.3,
    "color": "#A79470"
  },
  {
    "label": "Списания М.",
    "field": "writeoff_frozen",
    "amount": 1.71,
    "share": 0.3,
    "medianShare": 0.1,
    "color": "#B9AFA1"
  },
  {
    "label": "Уборка",
    "field": "cleaning",
    "amount": 1.587,
    "share": 0.2,
    "medianShare": 0.3,
    "color": "#816F5E"
  },
  {
    "label": "Премия",
    "field": "bonus",
    "amount": 0.866,
    "share": 0.1,
    "medianShare": 0.2,
    "color": "#578064"
  },
  {
    "label": "Отпускные (наличные)",
    "field": "vacation_cash",
    "amount": 0.686,
    "share": 0.1,
    "medianShare": 0.0,
    "color": "#9C8D73"
  },
  {
    "label": "Хоз. нужды",
    "field": "household",
    "amount": 0.636,
    "share": 0.1,
    "medianShare": 0.1,
    "color": "#B54437"
  },
  {
    "label": "Коммунальные (наличные)",
    "field": "utilities_cash",
    "amount": 0.535,
    "share": 0.1,
    "medianShare": 0.0,
    "color": "#C1BBAF"
  },
  {
    "label": "Водитель (наличные)",
    "field": "driver_cash",
    "amount": 0.397,
    "share": 0.1,
    "medianShare": 0.0,
    "color": "#697F75"
  },
  {
    "label": "Прочие наличные расходы",
    "field": "other_cash_expenses",
    "amount": 0.292,
    "share": 0.0,
    "medianShare": 0.0,
    "color": "#987A60"
  },
  {
    "label": "Доставка",
    "field": "delivery",
    "amount": 0.197,
    "share": 0.0,
    "medianShare": 0.0,
    "color": "#B26055"
  },
  {
    "label": "Доплата",
    "field": "extra_pay",
    "amount": 0.116,
    "share": 0.0,
    "medianShare": 0.0,
    "color": "#235C45"
  }
] as const;

export const comparisonCategories = [
  {
    "label": "ФОТ: всего",
    "field": "payroll_total",
    "amount": 59.962,
    "share": 9.2,
    "medianShare": 9.7,
    "color": "#235C45"
  },
  {
    "label": "Водитель: всего",
    "field": "driver_total",
    "amount": 6.969,
    "share": 1.1,
    "medianShare": 1.1,
    "color": "#4F826B"
  },
  {
    "label": "Коммунальные: всего",
    "field": "utilities_total",
    "amount": 7.955,
    "share": 1.2,
    "medianShare": 1.3,
    "color": "#B08B4F"
  },
  {
    "label": "Списания М.",
    "field": "writeoff_frozen",
    "amount": 1.71,
    "share": 0.3,
    "medianShare": 0.1,
    "color": "#E34234"
  },
  {
    "label": "Аренда",
    "field": "rent",
    "amount": 22.164,
    "share": 3.4,
    "medianShare": 3.8,
    "color": "#8A7050"
  },
  {
    "label": "Наличные операционные траты",
    "field": "cash_operating_total",
    "amount": 6.883,
    "share": 1.1,
    "medianShare": 1.0,
    "color": "#737373"
  }
] as const;

export const networkMonthly = [
  {
    "month": "Янв",
    "revenue": 76.1,
    "grossProfit": 20.47,
    "netProfit": 5.42,
    "grossMargin": 26.9,
    "netMargin": 7.1,
    "frozenShare": 53.0
  },
  {
    "month": "Фев",
    "revenue": 83.7,
    "grossProfit": 22.51,
    "netProfit": 5.44,
    "grossMargin": 26.9,
    "netMargin": 6.5,
    "frozenShare": 52.1
  },
  {
    "month": "Мар",
    "revenue": 94.2,
    "grossProfit": 25.07,
    "netProfit": 6.82,
    "grossMargin": 26.6,
    "netMargin": 7.2,
    "frozenShare": 49.8
  },
  {
    "month": "Апр",
    "revenue": 89.5,
    "grossProfit": 22.87,
    "netProfit": 4.52,
    "grossMargin": 25.6,
    "netMargin": 5.1,
    "frozenShare": 44.1
  },
  {
    "month": "Май",
    "revenue": 75.1,
    "grossProfit": 18.92,
    "netProfit": 1.43,
    "grossMargin": 25.2,
    "netMargin": 1.9,
    "frozenShare": 43.4
  },
  {
    "month": "Июн",
    "revenue": 75.1,
    "grossProfit": 18.73,
    "netProfit": 2.53,
    "grossMargin": 24.9,
    "netMargin": 3.4,
    "frozenShare": 42.1
  },
  {
    "month": "Июл",
    "revenue": 77.2,
    "grossProfit": 18.49,
    "netProfit": 0.87,
    "grossMargin": 23.9,
    "netMargin": 1.1,
    "frozenShare": 40.8
  },
  {
    "month": "Авг",
    "revenue": 84.2,
    "grossProfit": 20.65,
    "netProfit": 4.77,
    "grossMargin": 24.5,
    "netMargin": 5.7,
    "frozenShare": 44.8
  }
] as const;

export const stores = [
  {
    "store": "ПОРТ",
    "profitRank": 1,
    "marginRank": 6,
    "mixRank": 32,
    "revenue": 105.191,
    "grossProfit": 23.241,
    "netProfit": 9.258,
    "grossMargin": 22.1,
    "netMargin": 8.8,
    "bestMonth": "Август",
    "worstMonth": "Январь",
    "bestMonthProfit": 1.75,
    "worstMonthProfit": 0.76,
    "lossMonths": 0,
    "product": {
      "purchaseSmoked": 63.497,
      "purchaseFrozen": 18.453,
      "salesSmoked": 78.658,
      "salesFrozen": 26.534,
      "smokedMarkup": 23.9,
      "frozenMarkup": 43.8,
      "frozenSalesShare": 25.2,
      "frozenUplift": 19.9
    },
    "stock": {
      "open": 2.208,
      "close": 2.418,
      "change": 0.21,
      "movement": -0.028,
      "discount": 0.081,
      "revaluation": 0.034,
      "effect": -0.075,
      "writeoffSmoked": 0.433,
      "writeoffFrozen": 0.673,
      "writeoffSmokedShare": 0.4,
      "writeoffFrozenShare": 0.6
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.571,
        "share": 0.5,
        "medianShare": 3.8,
        "gap": -3.388
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 2.789,
        "share": 2.7,
        "medianShare": 3.1,
        "gap": -0.505
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 2.307,
        "share": 2.2,
        "medianShare": 2.8,
        "gap": -0.645
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 2.105,
        "share": 2.0,
        "medianShare": 3.7,
        "gap": -1.816
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 1.829,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.071
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 1.145,
        "share": 1.1,
        "medianShare": 1.6,
        "gap": -0.525
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.4,
        "share": 0.4,
        "medianShare": 1.2,
        "gap": -0.874
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.1,
        "medianShare": 1.1,
        "gap": -1.01
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.636,
        "share": 0.6,
        "medianShare": 0.8,
        "gap": -0.258
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.558,
        "share": 0.5,
        "medianShare": 0.7,
        "gap": -0.126
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.32,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.041
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.279,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.063
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.673,
        "share": 0.6,
        "medianShare": 0.1,
        "gap": 0.575
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.056,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.214
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.084,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.079
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.05,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.053
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.07,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.064
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.004,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.004
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 9.49,
        "grossProfit": 2.19,
        "netProfit": 0.76,
        "grossMargin": 23.0,
        "netMargin": 8.0
      },
      {
        "month": "Фев",
        "revenue": 10.08,
        "grossProfit": 2.31,
        "netProfit": 0.93,
        "grossMargin": 22.9,
        "netMargin": 9.2
      },
      {
        "month": "Мар",
        "revenue": 11.57,
        "grossProfit": 2.57,
        "netProfit": 0.99,
        "grossMargin": 22.2,
        "netMargin": 8.6
      },
      {
        "month": "Апр",
        "revenue": 12.29,
        "grossProfit": 2.65,
        "netProfit": 0.98,
        "grossMargin": 21.5,
        "netMargin": 8.0
      },
      {
        "month": "Май",
        "revenue": 11.9,
        "grossProfit": 2.67,
        "netProfit": 0.8,
        "grossMargin": 22.4,
        "netMargin": 6.7
      },
      {
        "month": "Июн",
        "revenue": 15.55,
        "grossProfit": 3.49,
        "netProfit": 1.34,
        "grossMargin": 22.5,
        "netMargin": 8.6
      },
      {
        "month": "Июл",
        "revenue": 16.95,
        "grossProfit": 3.62,
        "netProfit": 1.71,
        "grossMargin": 21.4,
        "netMargin": 10.1
      },
      {
        "month": "Авг",
        "revenue": 17.37,
        "grossProfit": 3.75,
        "netProfit": 1.75,
        "grossMargin": 21.6,
        "netMargin": 10.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 7.031,
        "share": 6.7,
        "medianShare": 9.7,
        "gap": -3.126
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.1,
        "medianShare": 1.1,
        "gap": -1.014
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.4,
        "share": 0.4,
        "medianShare": 1.3,
        "gap": -0.956
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.673,
        "share": 0.6,
        "medianShare": 0.1,
        "gap": 0.575
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.571,
        "share": 0.5,
        "medianShare": 3.8,
        "gap": -3.388
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.585,
        "share": 0.6,
        "medianShare": 1.0,
        "gap": -0.43
      }
    ]
  },
  {
    "store": "А2",
    "profitRank": 2,
    "marginRank": 1,
    "mixRank": 11,
    "revenue": 44.81,
    "grossProfit": 11.919,
    "netProfit": 4.586,
    "grossMargin": 26.6,
    "netMargin": 10.2,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.77,
    "worstMonthProfit": 0.3,
    "lossMonths": 0,
    "product": {
      "purchaseSmoked": 16.305,
      "purchaseFrozen": 16.586,
      "salesSmoked": 20.805,
      "salesFrozen": 24.006,
      "smokedMarkup": 27.6,
      "frozenMarkup": 44.7,
      "frozenSalesShare": 53.6,
      "frozenUplift": 17.1
    },
    "stock": {
      "open": 1.764,
      "close": 1.832,
      "change": 0.068,
      "movement": -0.01,
      "discount": 0.05,
      "revaluation": 0.078,
      "effect": 0.018,
      "writeoffSmoked": 0.094,
      "writeoffFrozen": 0.034,
      "writeoffSmokedShare": 0.2,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.52,
        "share": 3.4,
        "medianShare": 3.8,
        "gap": -0.166
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 1.43,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.027
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 1.104,
        "share": 2.5,
        "medianShare": 2.8,
        "gap": -0.154
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.763,
        "share": 1.7,
        "medianShare": 3.7,
        "gap": -0.908
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.743,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": -0.006
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.263,
        "share": 0.6,
        "medianShare": 1.6,
        "gap": -0.448
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.383,
        "share": 0.9,
        "medianShare": 1.2,
        "gap": -0.159
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 0.5,
        "medianShare": 1.1,
        "gap": -0.251
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.312,
        "share": 0.7,
        "medianShare": 0.8,
        "gap": -0.068
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 0.4,
        "medianShare": 0.7,
        "gap": -0.105
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.075,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.079
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.053,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.092
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.034,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.008
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.114,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.001
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.032,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.038
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.04,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.056,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.053
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 5.09,
        "grossProfit": 1.43,
        "netProfit": 0.6,
        "grossMargin": 28.0,
        "netMargin": 11.8
      },
      {
        "month": "Фев",
        "revenue": 5.93,
        "grossProfit": 1.66,
        "netProfit": 0.69,
        "grossMargin": 28.0,
        "netMargin": 11.7
      },
      {
        "month": "Мар",
        "revenue": 6.52,
        "grossProfit": 1.78,
        "netProfit": 0.77,
        "grossMargin": 27.3,
        "netMargin": 11.8
      },
      {
        "month": "Апр",
        "revenue": 6.57,
        "grossProfit": 1.72,
        "netProfit": 0.72,
        "grossMargin": 26.2,
        "netMargin": 10.9
      },
      {
        "month": "Май",
        "revenue": 4.86,
        "grossProfit": 1.28,
        "netProfit": 0.56,
        "grossMargin": 26.3,
        "netMargin": 11.4
      },
      {
        "month": "Июн",
        "revenue": 5.11,
        "grossProfit": 1.33,
        "netProfit": 0.53,
        "grossMargin": 26.1,
        "netMargin": 10.4
      },
      {
        "month": "Июл",
        "revenue": 5.08,
        "grossProfit": 1.28,
        "netProfit": 0.3,
        "grossMargin": 25.2,
        "netMargin": 6.0
      },
      {
        "month": "Авг",
        "revenue": 5.66,
        "grossProfit": 1.45,
        "netProfit": 0.42,
        "grossMargin": 25.6,
        "netMargin": 7.4
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.682,
        "share": 6.0,
        "medianShare": 9.7,
        "gap": -1.644
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.224,
        "share": 0.5,
        "medianShare": 1.1,
        "gap": -0.252
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.383,
        "share": 0.9,
        "medianShare": 1.3,
        "gap": -0.195
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.034,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.008
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.52,
        "share": 3.4,
        "medianShare": 3.8,
        "gap": -0.166
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.316,
        "share": 0.7,
        "medianShare": 1.0,
        "gap": -0.116
      }
    ]
  },
  {
    "store": "КИР1",
    "profitRank": 3,
    "marginRank": 4,
    "mixRank": 19,
    "revenue": 47.934,
    "grossProfit": 12.42,
    "netProfit": 4.339,
    "grossMargin": 25.9,
    "netMargin": 9.1,
    "bestMonth": "Апрель",
    "worstMonth": "Июнь",
    "bestMonthProfit": 1.13,
    "worstMonthProfit": -0.02,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 19.286,
      "purchaseFrozen": 16.228,
      "salesSmoked": 24.286,
      "salesFrozen": 23.648,
      "smokedMarkup": 25.9,
      "frozenMarkup": 45.7,
      "frozenSalesShare": 49.3,
      "frozenUplift": 19.8
    },
    "stock": {
      "open": 1.462,
      "close": 2.035,
      "change": 0.573,
      "movement": 0.008,
      "discount": 0.042,
      "revaluation": 0.133,
      "effect": 0.099,
      "writeoffSmoked": 0.071,
      "writeoffFrozen": 0.006,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.68,
        "share": 3.5,
        "medianShare": 3.8,
        "gap": -0.124
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 1.49,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.01
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 2.331,
        "share": 4.9,
        "medianShare": 2.8,
        "gap": 0.986
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 3.7,
        "gap": -1.787
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.795,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": -0.006
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.263,
        "share": 0.5,
        "medianShare": 1.6,
        "gap": -0.498
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.58
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 0.5,
        "medianShare": 1.1,
        "gap": -0.284
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.645,
        "share": 1.3,
        "medianShare": 0.8,
        "gap": 0.238
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.7,
        "gap": -0.312
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.086,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.078
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.046,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.11
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.039
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.101,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.022
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.018,
        "share": 0.0,
        "medianShare": 0.2,
        "gap": -0.056
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.186,
        "share": 0.4,
        "medianShare": 0.0,
        "gap": 0.186
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.033,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.014
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.039,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.039
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.025,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.022
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.113,
        "share": 0.2,
        "medianShare": 0.0,
        "gap": 0.113
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 5.83,
        "grossProfit": 1.6,
        "netProfit": 0.69,
        "grossMargin": 27.4,
        "netMargin": 11.8
      },
      {
        "month": "Фев",
        "revenue": 6.41,
        "grossProfit": 1.67,
        "netProfit": 0.66,
        "grossMargin": 26.0,
        "netMargin": 10.2
      },
      {
        "month": "Мар",
        "revenue": 8.96,
        "grossProfit": 2.31,
        "netProfit": 0.98,
        "grossMargin": 25.8,
        "netMargin": 10.9
      },
      {
        "month": "Апр",
        "revenue": 9.93,
        "grossProfit": 2.5,
        "netProfit": 1.13,
        "grossMargin": 25.2,
        "netMargin": 11.4
      },
      {
        "month": "Май",
        "revenue": 4.58,
        "grossProfit": 1.18,
        "netProfit": 0.29,
        "grossMargin": 25.7,
        "netMargin": 6.4
      },
      {
        "month": "Июн",
        "revenue": 2.94,
        "grossProfit": 0.76,
        "netProfit": -0.02,
        "grossMargin": 25.7,
        "netMargin": -0.5
      },
      {
        "month": "Июл",
        "revenue": 3.75,
        "grossProfit": 0.94,
        "netProfit": 0.16,
        "grossMargin": 25.1,
        "netMargin": 4.4
      },
      {
        "month": "Авг",
        "revenue": 5.55,
        "grossProfit": 1.47,
        "netProfit": 0.45,
        "grossMargin": 26.5,
        "netMargin": 8.0
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 3.472,
        "share": 7.2,
        "medianShare": 9.7,
        "gap": -1.156
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.263,
        "share": 0.5,
        "medianShare": 1.1,
        "gap": -0.247
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.3,
        "gap": -0.618
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.039
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.68,
        "share": 3.5,
        "medianShare": 3.8,
        "gap": -0.124
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.414,
        "share": 0.9,
        "medianShare": 1.0,
        "gap": -0.048
      }
    ]
  },
  {
    "store": "ОЛЕ",
    "profitRank": 4,
    "marginRank": 5,
    "mixRank": 14,
    "revenue": 27.156,
    "grossProfit": 7.205,
    "netProfit": 2.429,
    "grossMargin": 26.5,
    "netMargin": 8.9,
    "bestMonth": "Февраль",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.5,
    "worstMonthProfit": 0.05,
    "lossMonths": 0,
    "product": {
      "purchaseSmoked": 10.652,
      "purchaseFrozen": 9.299,
      "salesSmoked": 13.631,
      "salesFrozen": 13.525,
      "smokedMarkup": 28.0,
      "frozenMarkup": 45.5,
      "frozenSalesShare": 49.8,
      "frozenUplift": 17.5
    },
    "stock": {
      "open": 1.29,
      "close": 1.476,
      "change": 0.186,
      "movement": -0.003,
      "discount": 0.037,
      "revaluation": 0.036,
      "effect": -0.004,
      "writeoffSmoked": 0.111,
      "writeoffFrozen": 0.028,
      "writeoffSmokedShare": 0.4,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.246,
        "share": 0.9,
        "medianShare": 3.8,
        "gap": -0.776
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.865,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.014
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.247,
        "share": 0.9,
        "medianShare": 2.8,
        "gap": -0.515
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 1.233,
        "share": 4.5,
        "medianShare": 3.7,
        "gap": 0.22
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.464,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.01
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.485,
        "share": 1.8,
        "medianShare": 1.6,
        "gap": 0.054
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.105,
        "share": 0.4,
        "medianShare": 1.2,
        "gap": -0.224
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.064
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.153,
        "share": 0.6,
        "medianShare": 0.8,
        "gap": -0.078
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 0.7,
        "medianShare": 0.7,
        "gap": 0.01
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.16,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.067
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.093,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.005
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.028,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.002
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.118,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.049
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.051,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.009
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.016,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.01
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.025,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.023
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.077,
        "share": 0.3,
        "medianShare": 0.0,
        "gap": 0.077
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.95,
        "grossProfit": 0.81,
        "netProfit": 0.33,
        "grossMargin": 27.6,
        "netMargin": 11.3
      },
      {
        "month": "Фев",
        "revenue": 3.92,
        "grossProfit": 1.06,
        "netProfit": 0.5,
        "grossMargin": 27.1,
        "netMargin": 12.8
      },
      {
        "month": "Мар",
        "revenue": 3.6,
        "grossProfit": 0.99,
        "netProfit": 0.39,
        "grossMargin": 27.5,
        "netMargin": 10.7
      },
      {
        "month": "Апр",
        "revenue": 3.1,
        "grossProfit": 0.82,
        "netProfit": 0.24,
        "grossMargin": 26.5,
        "netMargin": 7.6
      },
      {
        "month": "Май",
        "revenue": 3.4,
        "grossProfit": 0.88,
        "netProfit": 0.14,
        "grossMargin": 25.9,
        "netMargin": 4.2
      },
      {
        "month": "Июн",
        "revenue": 3.42,
        "grossProfit": 0.88,
        "netProfit": 0.36,
        "grossMargin": 25.8,
        "netMargin": 10.6
      },
      {
        "month": "Июл",
        "revenue": 3.1,
        "grossProfit": 0.81,
        "netProfit": 0.05,
        "grossMargin": 26.1,
        "netMargin": 1.5
      },
      {
        "month": "Авг",
        "revenue": 3.68,
        "grossProfit": 0.95,
        "netProfit": 0.42,
        "grossMargin": 25.9,
        "netMargin": 11.5
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.397,
        "share": 8.8,
        "medianShare": 9.7,
        "gap": -0.225
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.224,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.065
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.105,
        "share": 0.4,
        "medianShare": 1.3,
        "gap": -0.245
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.028,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.002
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.246,
        "share": 0.9,
        "medianShare": 3.8,
        "gap": -0.776
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.447,
        "share": 1.6,
        "medianShare": 1.0,
        "gap": 0.186
      }
    ]
  },
  {
    "store": "А1",
    "profitRank": 5,
    "marginRank": 8,
    "mixRank": 3,
    "revenue": 28.373,
    "grossProfit": 7.724,
    "netProfit": 1.989,
    "grossMargin": 27.2,
    "netMargin": 7.0,
    "bestMonth": "Март",
    "worstMonth": "Август",
    "bestMonthProfit": 0.52,
    "worstMonthProfit": 0.03,
    "lossMonths": 0,
    "product": {
      "purchaseSmoked": 8.97,
      "purchaseFrozen": 11.68,
      "salesSmoked": 11.365,
      "salesFrozen": 17.008,
      "smokedMarkup": 26.7,
      "frozenMarkup": 45.6,
      "frozenSalesShare": 59.9,
      "frozenUplift": 18.9
    },
    "stock": {
      "open": 0.84,
      "close": 0.898,
      "change": 0.058,
      "movement": 0.01,
      "discount": 0.033,
      "revaluation": 0.039,
      "effect": 0.016,
      "writeoffSmoked": 0.021,
      "writeoffFrozen": 0.006,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.16,
        "share": 4.1,
        "medianShare": 3.8,
        "gap": 0.092
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.927,
        "share": 3.3,
        "medianShare": 3.1,
        "gap": 0.038
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.762,
        "share": 2.7,
        "medianShare": 2.8,
        "gap": -0.034
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.748,
        "share": 2.6,
        "medianShare": 3.7,
        "gap": -0.31
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.463,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.012
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.315,
        "share": 1.1,
        "medianShare": 1.6,
        "gap": -0.136
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.247,
        "share": 0.9,
        "medianShare": 1.2,
        "gap": -0.097
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.076
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.247,
        "share": 0.9,
        "medianShare": 0.8,
        "gap": 0.006
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.186,
        "share": 0.7,
        "medianShare": 0.7,
        "gap": 0.001
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.148,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.051
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.093,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.0
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.021
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.112,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.039
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.036,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.008
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.02
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.039,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.039
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.002,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.015
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 3.64,
        "grossProfit": 1.0,
        "netProfit": 0.28,
        "grossMargin": 27.4,
        "netMargin": 7.8
      },
      {
        "month": "Фев",
        "revenue": 3.67,
        "grossProfit": 1.06,
        "netProfit": 0.36,
        "grossMargin": 28.9,
        "netMargin": 9.9
      },
      {
        "month": "Мар",
        "revenue": 4.62,
        "grossProfit": 1.3,
        "netProfit": 0.52,
        "grossMargin": 28.2,
        "netMargin": 11.2
      },
      {
        "month": "Апр",
        "revenue": 3.68,
        "grossProfit": 1.0,
        "netProfit": 0.28,
        "grossMargin": 27.1,
        "netMargin": 7.7
      },
      {
        "month": "Май",
        "revenue": 2.96,
        "grossProfit": 0.79,
        "netProfit": 0.16,
        "grossMargin": 26.6,
        "netMargin": 5.4
      },
      {
        "month": "Июн",
        "revenue": 3.27,
        "grossProfit": 0.88,
        "netProfit": 0.28,
        "grossMargin": 26.8,
        "netMargin": 8.6
      },
      {
        "month": "Июл",
        "revenue": 3.58,
        "grossProfit": 0.94,
        "netProfit": 0.07,
        "grossMargin": 26.3,
        "netMargin": 1.9
      },
      {
        "month": "Авг",
        "revenue": 2.95,
        "grossProfit": 0.76,
        "netProfit": 0.03,
        "grossMargin": 25.7,
        "netMargin": 1.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.349,
        "share": 8.3,
        "medianShare": 9.7,
        "gap": -0.39
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.263,
        "share": 0.9,
        "medianShare": 1.1,
        "gap": -0.039
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.247,
        "share": 0.9,
        "medianShare": 1.3,
        "gap": -0.119
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.021
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.16,
        "share": 4.1,
        "medianShare": 3.8,
        "gap": 0.092
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.36,
        "share": 1.3,
        "medianShare": 1.0,
        "gap": 0.086
      }
    ]
  },
  {
    "store": "ПОЛ",
    "profitRank": 6,
    "marginRank": 3,
    "mixRank": 13,
    "revenue": 16.469,
    "grossProfit": 4.463,
    "netProfit": 1.51,
    "grossMargin": 27.1,
    "netMargin": 9.2,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.41,
    "worstMonthProfit": -0.02,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 6.155,
      "purchaseFrozen": 5.852,
      "salesSmoked": 7.955,
      "salesFrozen": 8.514,
      "smokedMarkup": 29.2,
      "frozenMarkup": 45.5,
      "frozenSalesShare": 51.7,
      "frozenUplift": 16.3
    },
    "stock": {
      "open": 0.784,
      "close": 0.973,
      "change": 0.188,
      "movement": 0.003,
      "discount": 0.028,
      "revaluation": 0.0,
      "effect": -0.025,
      "writeoffSmoked": 0.344,
      "writeoffFrozen": 0.031,
      "writeoffSmokedShare": 2.1,
      "writeoffFrozenShare": 0.2
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.41,
        "share": 2.5,
        "medianShare": 3.8,
        "gap": -0.209
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.536,
        "share": 3.3,
        "medianShare": 3.1,
        "gap": 0.02
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.482,
        "share": 2.9,
        "medianShare": 2.8,
        "gap": 0.02
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.368,
        "share": 2.2,
        "medianShare": 3.7,
        "gap": -0.245
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.282,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.007
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.158,
        "share": 1.0,
        "medianShare": 1.6,
        "gap": -0.104
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.199
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.3,
        "share": 1.8,
        "medianShare": 1.1,
        "gap": 0.126
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.131,
        "share": 0.8,
        "medianShare": 0.8,
        "gap": -0.009
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.6,
        "medianShare": 0.7,
        "gap": -0.014
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.044,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.012
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.007
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.031,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.015
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.01
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.022,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.003
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.001
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.26,
        "grossProfit": 0.63,
        "netProfit": 0.29,
        "grossMargin": 27.7,
        "netMargin": 12.9
      },
      {
        "month": "Фев",
        "revenue": 2.07,
        "grossProfit": 0.58,
        "netProfit": 0.21,
        "grossMargin": 27.8,
        "netMargin": 10.4
      },
      {
        "month": "Мар",
        "revenue": 2.32,
        "grossProfit": 0.81,
        "netProfit": 0.41,
        "grossMargin": 34.8,
        "netMargin": 17.5
      },
      {
        "month": "Апр",
        "revenue": 2.16,
        "grossProfit": 0.56,
        "netProfit": 0.17,
        "grossMargin": 25.9,
        "netMargin": 7.8
      },
      {
        "month": "Май",
        "revenue": 1.99,
        "grossProfit": 0.51,
        "netProfit": 0.16,
        "grossMargin": 25.7,
        "netMargin": 7.8
      },
      {
        "month": "Июн",
        "revenue": 1.67,
        "grossProfit": 0.43,
        "netProfit": 0.12,
        "grossMargin": 25.9,
        "netMargin": 6.9
      },
      {
        "month": "Июл",
        "revenue": 2.0,
        "grossProfit": 0.47,
        "netProfit": -0.02,
        "grossMargin": 23.7,
        "netMargin": -1.0
      },
      {
        "month": "Авг",
        "revenue": 2.01,
        "grossProfit": 0.48,
        "netProfit": 0.18,
        "grossMargin": 23.9,
        "netMargin": 8.9
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.28,
        "share": 7.8,
        "medianShare": 9.7,
        "gap": -0.31
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.3,
        "share": 1.8,
        "medianShare": 1.1,
        "gap": 0.125
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.3,
        "gap": -0.212
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.031,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.015
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.41,
        "share": 2.5,
        "medianShare": 3.8,
        "gap": -0.209
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.114,
        "share": 0.7,
        "medianShare": 1.0,
        "gap": -0.045
      }
    ]
  },
  {
    "store": "КОВ",
    "profitRank": 7,
    "marginRank": 10,
    "mixRank": 2,
    "revenue": 26.892,
    "grossProfit": 7.489,
    "netProfit": 1.507,
    "grossMargin": 27.8,
    "netMargin": 5.6,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.38,
    "worstMonthProfit": -0.03,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 8.474,
      "purchaseFrozen": 10.929,
      "salesSmoked": 10.744,
      "salesFrozen": 16.148,
      "smokedMarkup": 26.8,
      "frozenMarkup": 47.8,
      "frozenSalesShare": 60.0,
      "frozenUplift": 21.0
    },
    "stock": {
      "open": 0.588,
      "close": 1.02,
      "change": 0.432,
      "movement": -0.025,
      "discount": 0.007,
      "revaluation": 0.012,
      "effect": -0.02,
      "writeoffSmoked": 0.023,
      "writeoffFrozen": 0.0,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.56,
        "share": 5.8,
        "medianShare": 3.8,
        "gap": 0.548
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.899,
        "share": 3.3,
        "medianShare": 3.1,
        "gap": 0.057
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.641,
        "share": 2.4,
        "medianShare": 2.8,
        "gap": -0.114
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.7,
        "share": 2.6,
        "medianShare": 3.7,
        "gap": -0.302
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.443,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.006
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.298,
        "share": 1.1,
        "medianShare": 1.6,
        "gap": -0.129
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.267,
        "share": 1.0,
        "medianShare": 1.2,
        "gap": -0.059
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.57,
        "share": 2.1,
        "medianShare": 1.1,
        "gap": 0.285
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.199,
        "share": 0.7,
        "medianShare": 0.8,
        "gap": -0.029
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.3,
        "medianShare": 0.7,
        "gap": -0.081
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.075,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.017
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.041
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.025
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.038,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.031
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.018,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.024
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.045,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.018
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.084,
        "share": 0.3,
        "medianShare": 0.0,
        "gap": 0.084
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.004
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 3.39,
        "grossProfit": 0.96,
        "netProfit": 0.26,
        "grossMargin": 28.4,
        "netMargin": 7.7
      },
      {
        "month": "Фев",
        "revenue": 3.65,
        "grossProfit": 1.08,
        "netProfit": 0.3,
        "grossMargin": 29.6,
        "netMargin": 8.3
      },
      {
        "month": "Мар",
        "revenue": 4.21,
        "grossProfit": 1.2,
        "netProfit": 0.38,
        "grossMargin": 28.6,
        "netMargin": 9.1
      },
      {
        "month": "Апр",
        "revenue": 3.86,
        "grossProfit": 1.07,
        "netProfit": 0.32,
        "grossMargin": 27.6,
        "netMargin": 8.3
      },
      {
        "month": "Май",
        "revenue": 3.15,
        "grossProfit": 0.86,
        "netProfit": 0.06,
        "grossMargin": 27.4,
        "netMargin": 1.9
      },
      {
        "month": "Июн",
        "revenue": 2.81,
        "grossProfit": 0.76,
        "netProfit": 0.06,
        "grossMargin": 27.1,
        "netMargin": 2.1
      },
      {
        "month": "Июл",
        "revenue": 2.82,
        "grossProfit": 0.77,
        "netProfit": -0.03,
        "grossMargin": 27.4,
        "netMargin": -1.1
      },
      {
        "month": "Авг",
        "revenue": 3.01,
        "grossProfit": 0.78,
        "netProfit": 0.15,
        "grossMargin": 25.9,
        "netMargin": 5.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.978,
        "share": 7.4,
        "medianShare": 9.7,
        "gap": -0.618
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.654,
        "share": 2.4,
        "medianShare": 1.1,
        "gap": 0.368
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.267,
        "share": 1.0,
        "medianShare": 1.3,
        "gap": -0.08
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.025
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.56,
        "share": 5.8,
        "medianShare": 3.8,
        "gap": 0.548
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.266,
        "share": 1.0,
        "medianShare": 1.0,
        "gap": 0.006
      }
    ]
  },
  {
    "store": "КИР3",
    "profitRank": 8,
    "marginRank": 7,
    "mixRank": 18,
    "revenue": 17.029,
    "grossProfit": 4.445,
    "netProfit": 1.475,
    "grossMargin": 26.1,
    "netMargin": 8.7,
    "bestMonth": "Апрель",
    "worstMonth": "Май",
    "bestMonthProfit": 0.45,
    "worstMonthProfit": -0.01,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 6.85,
      "purchaseFrozen": 5.734,
      "salesSmoked": 8.625,
      "salesFrozen": 8.404,
      "smokedMarkup": 25.9,
      "frozenMarkup": 46.6,
      "frozenSalesShare": 49.4,
      "frozenUplift": 20.6
    },
    "stock": {
      "open": 1.031,
      "close": 0.29,
      "change": -0.741,
      "movement": -0.115,
      "discount": 0.031,
      "revaluation": 0.005,
      "effect": -0.14,
      "writeoffSmoked": 0.058,
      "writeoffFrozen": 0.015,
      "writeoffSmokedShare": 0.3,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.55,
        "share": 3.2,
        "medianShare": 3.8,
        "gap": -0.091
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.533,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": 0.0
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.717,
        "share": 4.2,
        "medianShare": 2.8,
        "gap": 0.239
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.053,
        "share": 0.3,
        "medianShare": 3.7,
        "gap": -0.582
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.299,
        "share": 1.8,
        "medianShare": 1.7,
        "gap": 0.014
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.079,
        "share": 0.5,
        "medianShare": 1.6,
        "gap": -0.191
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.188,
        "share": 1.1,
        "medianShare": 1.2,
        "gap": -0.018
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.19,
        "share": 1.1,
        "medianShare": 1.1,
        "gap": 0.01
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.166,
        "share": 1.0,
        "medianShare": 0.8,
        "gap": 0.022
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.5,
        "medianShare": 0.7,
        "gap": -0.017
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.058
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.009
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.001
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.03,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.014
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.2,
        "gap": -0.026
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.013
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.005
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.45,
        "grossProfit": 0.68,
        "netProfit": 0.22,
        "grossMargin": 27.8,
        "netMargin": 9.1
      },
      {
        "month": "Фев",
        "revenue": 2.85,
        "grossProfit": 0.77,
        "netProfit": 0.29,
        "grossMargin": 27.0,
        "netMargin": 10.1
      },
      {
        "month": "Мар",
        "revenue": 4.08,
        "grossProfit": 1.05,
        "netProfit": 0.44,
        "grossMargin": 25.8,
        "netMargin": 10.7
      },
      {
        "month": "Апр",
        "revenue": 4.4,
        "grossProfit": 1.1,
        "netProfit": 0.45,
        "grossMargin": 25.0,
        "netMargin": 10.3
      },
      {
        "month": "Май",
        "revenue": 2.23,
        "grossProfit": 0.58,
        "netProfit": -0.01,
        "grossMargin": 26.1,
        "netMargin": -0.4
      },
      {
        "month": "Июн",
        "revenue": 0.92,
        "grossProfit": 0.23,
        "netProfit": 0.07,
        "grossMargin": 25.6,
        "netMargin": 7.8
      },
      {
        "month": "Июл",
        "revenue": 0.1,
        "grossProfit": 0.02,
        "netProfit": 0.01,
        "grossMargin": 24.3,
        "netMargin": 10.6
      },
      {
        "month": "Авг",
        "revenue": 0.0,
        "grossProfit": 0.0,
        "netProfit": 0.0,
        "grossMargin": 0,
        "netMargin": 0
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.156,
        "share": 6.8,
        "medianShare": 9.7,
        "gap": -0.489
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.19,
        "share": 1.1,
        "medianShare": 1.1,
        "gap": 0.009
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.188,
        "share": 1.1,
        "medianShare": 1.3,
        "gap": -0.031
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.001
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.55,
        "share": 3.2,
        "medianShare": 3.8,
        "gap": -0.091
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.039,
        "share": 0.2,
        "medianShare": 1.0,
        "gap": -0.125
      }
    ]
  },
  {
    "store": "КА2",
    "profitRank": 9,
    "marginRank": 2,
    "mixRank": 1,
    "revenue": 14.448,
    "grossProfit": 4.234,
    "netProfit": 1.426,
    "grossMargin": 29.3,
    "netMargin": 9.9,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.26,
    "worstMonthProfit": 0.03,
    "lossMonths": 0,
    "product": {
      "purchaseSmoked": 2.796,
      "purchaseFrozen": 7.418,
      "salesSmoked": 3.693,
      "salesFrozen": 10.755,
      "smokedMarkup": 32.1,
      "frozenMarkup": 45.0,
      "frozenSalesShare": 74.4,
      "frozenUplift": 12.9
    },
    "stock": {
      "open": 0.946,
      "close": 1.211,
      "change": 0.265,
      "movement": 0.362,
      "discount": 0.028,
      "revaluation": 0.0,
      "effect": 0.334,
      "writeoffSmoked": 0.033,
      "writeoffFrozen": 0.005,
      "writeoffSmokedShare": 0.2,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.48,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.064
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.508,
        "share": 3.5,
        "medianShare": 3.1,
        "gap": 0.056
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.121,
        "share": 0.8,
        "medianShare": 2.8,
        "gap": -0.285
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.7,
        "share": 4.8,
        "medianShare": 3.7,
        "gap": 0.162
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.223,
        "share": 1.5,
        "medianShare": 1.7,
        "gap": -0.019
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.284,
        "share": 2.0,
        "medianShare": 1.6,
        "gap": 0.055
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.175
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.16,
        "share": 1.1,
        "medianShare": 1.1,
        "gap": 0.007
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.055,
        "share": 0.4,
        "medianShare": 0.8,
        "gap": -0.068
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.6,
        "medianShare": 0.7,
        "gap": -0.0
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.028,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.022
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.0
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.005,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.037,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.0
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.018,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.004
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.021,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.007
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.02,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.02
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.002
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.003
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.79,
        "grossProfit": 0.53,
        "netProfit": 0.23,
        "grossMargin": 29.7,
        "netMargin": 13.0
      },
      {
        "month": "Фев",
        "revenue": 1.92,
        "grossProfit": 0.59,
        "netProfit": 0.23,
        "grossMargin": 30.5,
        "netMargin": 12.1
      },
      {
        "month": "Мар",
        "revenue": 2.06,
        "grossProfit": 0.62,
        "netProfit": 0.26,
        "grossMargin": 30.3,
        "netMargin": 12.7
      },
      {
        "month": "Апр",
        "revenue": 1.83,
        "grossProfit": 0.56,
        "netProfit": 0.21,
        "grossMargin": 30.5,
        "netMargin": 11.5
      },
      {
        "month": "Май",
        "revenue": 1.66,
        "grossProfit": 0.5,
        "netProfit": 0.14,
        "grossMargin": 30.0,
        "netMargin": 8.5
      },
      {
        "month": "Июн",
        "revenue": 1.39,
        "grossProfit": 0.39,
        "netProfit": 0.07,
        "grossMargin": 27.8,
        "netMargin": 4.9
      },
      {
        "month": "Июл",
        "revenue": 1.76,
        "grossProfit": 0.49,
        "netProfit": 0.03,
        "grossMargin": 27.8,
        "netMargin": 1.9
      },
      {
        "month": "Авг",
        "revenue": 2.04,
        "grossProfit": 0.56,
        "netProfit": 0.25,
        "grossMargin": 27.5,
        "netMargin": 12.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.301,
        "share": 9.0,
        "medianShare": 9.7,
        "gap": -0.094
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.18,
        "share": 1.2,
        "medianShare": 1.1,
        "gap": 0.026
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.3,
        "gap": -0.186
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.005,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.48,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.064
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.13,
        "share": 0.9,
        "medianShare": 1.0,
        "gap": -0.009
      }
    ]
  },
  {
    "store": "ЗАП",
    "profitRank": 10,
    "marginRank": 9,
    "mixRank": 25,
    "revenue": 22.327,
    "grossProfit": 5.812,
    "netProfit": 1.423,
    "grossMargin": 26.0,
    "netMargin": 6.4,
    "bestMonth": "Апрель",
    "worstMonth": "Июнь",
    "bestMonthProfit": 0.26,
    "worstMonthProfit": -0.02,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 9.734,
      "purchaseFrozen": 6.781,
      "salesSmoked": 12.445,
      "salesFrozen": 9.882,
      "smokedMarkup": 27.9,
      "frozenMarkup": 45.7,
      "frozenSalesShare": 44.3,
      "frozenUplift": 17.9
    },
    "stock": {
      "open": 1.106,
      "close": 1.194,
      "change": 0.087,
      "movement": 0.001,
      "discount": 0.041,
      "revaluation": 0.052,
      "effect": 0.012,
      "writeoffSmoked": 0.301,
      "writeoffFrozen": 0.013,
      "writeoffSmokedShare": 1.3,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.761,
        "share": 3.4,
        "medianShare": 3.8,
        "gap": -0.08
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.697,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.002
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.47,
        "share": 2.1,
        "medianShare": 2.8,
        "gap": -0.156
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.716,
        "share": 3.2,
        "medianShare": 3.7,
        "gap": -0.117
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.39,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.017
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.274,
        "share": 1.2,
        "medianShare": 1.6,
        "gap": -0.08
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.256,
        "share": 1.1,
        "medianShare": 1.2,
        "gap": -0.014
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.324,
        "share": 1.5,
        "medianShare": 1.1,
        "gap": 0.088
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.158,
        "share": 0.7,
        "medianShare": 0.8,
        "gap": -0.032
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.054,
        "share": 0.2,
        "medianShare": 0.7,
        "gap": -0.091
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.061,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.016
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.027,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.046
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.013,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.008
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.05,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.008
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.03,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.005
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.028,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.006
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.049,
        "share": 0.2,
        "medianShare": 0.0,
        "gap": 0.048
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.031,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.031
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.6,
        "grossProfit": 0.73,
        "netProfit": 0.23,
        "grossMargin": 28.2,
        "netMargin": 8.8
      },
      {
        "month": "Фев",
        "revenue": 3.04,
        "grossProfit": 0.81,
        "netProfit": 0.21,
        "grossMargin": 26.6,
        "netMargin": 6.8
      },
      {
        "month": "Мар",
        "revenue": 2.99,
        "grossProfit": 0.79,
        "netProfit": 0.13,
        "grossMargin": 26.5,
        "netMargin": 4.2
      },
      {
        "month": "Апр",
        "revenue": 3.32,
        "grossProfit": 0.89,
        "netProfit": 0.26,
        "grossMargin": 26.8,
        "netMargin": 7.8
      },
      {
        "month": "Май",
        "revenue": 2.64,
        "grossProfit": 0.67,
        "netProfit": 0.19,
        "grossMargin": 25.3,
        "netMargin": 7.1
      },
      {
        "month": "Июн",
        "revenue": 2.17,
        "grossProfit": 0.55,
        "netProfit": -0.02,
        "grossMargin": 25.2,
        "netMargin": -1.0
      },
      {
        "month": "Июл",
        "revenue": 2.63,
        "grossProfit": 0.64,
        "netProfit": 0.19,
        "grossMargin": 24.5,
        "netMargin": 7.2
      },
      {
        "month": "Авг",
        "revenue": 2.93,
        "grossProfit": 0.73,
        "netProfit": 0.25,
        "grossMargin": 25.0,
        "netMargin": 8.4
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.699,
        "share": 7.6,
        "medianShare": 9.7,
        "gap": -0.457
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.324,
        "share": 1.5,
        "medianShare": 1.1,
        "gap": 0.087
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.256,
        "share": 1.1,
        "medianShare": 1.3,
        "gap": -0.031
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.013,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.008
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.761,
        "share": 3.4,
        "medianShare": 3.8,
        "gap": -0.08
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.248,
        "share": 1.1,
        "medianShare": 1.0,
        "gap": 0.033
      }
    ]
  },
  {
    "store": "КНИП",
    "profitRank": 11,
    "marginRank": 16,
    "mixRank": 30,
    "revenue": 30.645,
    "grossProfit": 7.453,
    "netProfit": 1.13,
    "grossMargin": 24.3,
    "netMargin": 3.7,
    "bestMonth": "Февраль",
    "worstMonth": "Июнь",
    "bestMonthProfit": 0.3,
    "worstMonthProfit": -0.12,
    "lossMonths": 2,
    "product": {
      "purchaseSmoked": 14.609,
      "purchaseFrozen": 8.583,
      "salesSmoked": 18.245,
      "salesFrozen": 12.4,
      "smokedMarkup": 24.9,
      "frozenMarkup": 44.5,
      "frozenSalesShare": 40.5,
      "frozenUplift": 19.6
    },
    "stock": {
      "open": 1.231,
      "close": 1.144,
      "change": -0.087,
      "movement": -0.004,
      "discount": 0.023,
      "revaluation": 0.057,
      "effect": 0.029,
      "writeoffSmoked": 0.401,
      "writeoffFrozen": 0.262,
      "writeoffSmokedShare": 1.3,
      "writeoffFrozenShare": 0.9
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.512,
        "share": 4.9,
        "medianShare": 3.8,
        "gap": 0.359
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.894,
        "share": 2.9,
        "medianShare": 3.1,
        "gap": -0.065
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 1.24,
        "share": 4.0,
        "medianShare": 2.8,
        "gap": 0.38
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.421,
        "share": 1.4,
        "medianShare": 3.7,
        "gap": -0.721
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.535,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.023
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.264,
        "share": 0.9,
        "medianShare": 1.6,
        "gap": -0.223
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.4,
        "share": 1.3,
        "medianShare": 1.2,
        "gap": 0.029
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.3,
        "medianShare": 1.1,
        "gap": -0.221
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.323,
        "share": 1.1,
        "medianShare": 0.8,
        "gap": 0.062
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 0.3,
        "medianShare": 0.7,
        "gap": -0.106
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.101,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.004
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.053
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.262,
        "share": 0.9,
        "medianShare": 0.1,
        "gap": 0.234
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.064,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.015
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.036,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.012
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.026,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.002
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 4.33,
        "grossProfit": 1.1,
        "netProfit": 0.29,
        "grossMargin": 25.5,
        "netMargin": 6.7
      },
      {
        "month": "Фев",
        "revenue": 4.13,
        "grossProfit": 1.06,
        "netProfit": 0.3,
        "grossMargin": 25.7,
        "netMargin": 7.1
      },
      {
        "month": "Мар",
        "revenue": 4.0,
        "grossProfit": 1.0,
        "netProfit": 0.21,
        "grossMargin": 25.1,
        "netMargin": 5.3
      },
      {
        "month": "Апр",
        "revenue": 3.2,
        "grossProfit": 0.77,
        "netProfit": -0.05,
        "grossMargin": 24.1,
        "netMargin": -1.4
      },
      {
        "month": "Май",
        "revenue": 3.85,
        "grossProfit": 0.92,
        "netProfit": 0.13,
        "grossMargin": 24.0,
        "netMargin": 3.3
      },
      {
        "month": "Июн",
        "revenue": 3.5,
        "grossProfit": 0.81,
        "netProfit": -0.12,
        "grossMargin": 23.2,
        "netMargin": -3.5
      },
      {
        "month": "Июл",
        "revenue": 3.45,
        "grossProfit": 0.77,
        "netProfit": 0.1,
        "grossMargin": 22.4,
        "netMargin": 2.9
      },
      {
        "month": "Авг",
        "revenue": 4.19,
        "grossProfit": 1.01,
        "netProfit": 0.28,
        "grossMargin": 24.0,
        "netMargin": 6.6
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.388,
        "share": 7.8,
        "medianShare": 9.7,
        "gap": -0.571
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.3,
        "medianShare": 1.1,
        "gap": -0.222
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.4,
        "share": 1.3,
        "medianShare": 1.3,
        "gap": 0.005
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.262,
        "share": 0.9,
        "medianShare": 0.1,
        "gap": 0.234
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 1.512,
        "share": 4.9,
        "medianShare": 3.8,
        "gap": 0.359
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.227,
        "share": 0.7,
        "medianShare": 1.0,
        "gap": -0.069
      }
    ]
  },
  {
    "store": "ГС2",
    "profitRank": 12,
    "marginRank": 11,
    "mixRank": 15,
    "revenue": 16.897,
    "grossProfit": 4.344,
    "netProfit": 0.926,
    "grossMargin": 25.7,
    "netMargin": 5.5,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.26,
    "worstMonthProfit": -0.04,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 6.716,
      "purchaseFrozen": 5.836,
      "salesSmoked": 8.489,
      "salesFrozen": 8.408,
      "smokedMarkup": 26.4,
      "frozenMarkup": 44.1,
      "frozenSalesShare": 49.8,
      "frozenUplift": 17.7
    },
    "stock": {
      "open": 1.311,
      "close": 1.073,
      "change": -0.238,
      "movement": 0.0,
      "discount": 0.014,
      "revaluation": 0.022,
      "effect": 0.008,
      "writeoffSmoked": 0.255,
      "writeoffFrozen": 0.004,
      "writeoffSmokedShare": 1.5,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.52,
        "share": 3.1,
        "medianShare": 3.8,
        "gap": -0.116
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.521,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.008
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.615,
        "share": 3.6,
        "medianShare": 2.8,
        "gap": 0.141
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.422,
        "share": 2.5,
        "medianShare": 3.7,
        "gap": -0.207
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.283,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.001
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.204,
        "share": 1.2,
        "medianShare": 1.6,
        "gap": -0.064
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.344,
        "share": 2.0,
        "medianShare": 1.2,
        "gap": 0.139
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.075
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.158,
        "share": 0.9,
        "medianShare": 0.8,
        "gap": 0.014
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.6,
        "medianShare": 0.7,
        "gap": -0.016
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.001,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.057
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.008
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.004,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.012
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.04,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.003
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.022,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.004
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.032,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.015
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.005
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.001,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.001
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.36,
        "grossProfit": 0.34,
        "netProfit": 0.05,
        "grossMargin": 25.3,
        "netMargin": 4.0
      },
      {
        "month": "Фев",
        "revenue": 2.07,
        "grossProfit": 0.56,
        "netProfit": 0.13,
        "grossMargin": 27.0,
        "netMargin": 6.5
      },
      {
        "month": "Мар",
        "revenue": 2.43,
        "grossProfit": 0.67,
        "netProfit": 0.26,
        "grossMargin": 27.4,
        "netMargin": 10.7
      },
      {
        "month": "Апр",
        "revenue": 1.99,
        "grossProfit": 0.52,
        "netProfit": 0.02,
        "grossMargin": 26.3,
        "netMargin": 1.2
      },
      {
        "month": "Май",
        "revenue": 2.2,
        "grossProfit": 0.55,
        "netProfit": 0.14,
        "grossMargin": 25.1,
        "netMargin": 6.4
      },
      {
        "month": "Июн",
        "revenue": 2.41,
        "grossProfit": 0.62,
        "netProfit": 0.18,
        "grossMargin": 25.7,
        "netMargin": 7.3
      },
      {
        "month": "Июл",
        "revenue": 2.35,
        "grossProfit": 0.56,
        "netProfit": -0.04,
        "grossMargin": 23.9,
        "netMargin": -1.6
      },
      {
        "month": "Авг",
        "revenue": 2.08,
        "grossProfit": 0.52,
        "netProfit": 0.17,
        "grossMargin": 24.8,
        "netMargin": 8.3
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.54,
        "share": 9.1,
        "medianShare": 9.7,
        "gap": -0.092
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.076
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.344,
        "share": 2.0,
        "medianShare": 1.3,
        "gap": 0.126
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.004,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.012
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.52,
        "share": 3.1,
        "medianShare": 3.8,
        "gap": -0.116
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.102,
        "share": 0.6,
        "medianShare": 1.0,
        "gap": -0.061
      }
    ]
  },
  {
    "store": "С1",
    "profitRank": 13,
    "marginRank": 17,
    "mixRank": 31,
    "revenue": 24.543,
    "grossProfit": 6.152,
    "netProfit": 0.848,
    "grossMargin": 25.1,
    "netMargin": 3.5,
    "bestMonth": "Июнь",
    "worstMonth": "Август",
    "bestMonthProfit": 0.24,
    "worstMonthProfit": -0.07,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 12.335,
      "purchaseFrozen": 6.057,
      "salesSmoked": 15.679,
      "salesFrozen": 8.864,
      "smokedMarkup": 27.1,
      "frozenMarkup": 46.4,
      "frozenSalesShare": 36.1,
      "frozenUplift": 19.2
    },
    "stock": {
      "open": 1.464,
      "close": 1.017,
      "change": -0.447,
      "movement": 0.339,
      "discount": 0.049,
      "revaluation": 0.018,
      "effect": 0.309,
      "writeoffSmoked": 0.464,
      "writeoffFrozen": 0.034,
      "writeoffSmokedShare": 1.9,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 3.1,
        "medianShare": 3.8,
        "gap": -0.164
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.738,
        "share": 3.0,
        "medianShare": 3.1,
        "gap": -0.03
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.9,
        "share": 3.7,
        "medianShare": 2.8,
        "gap": 0.212
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.681,
        "share": 2.8,
        "medianShare": 3.7,
        "gap": -0.234
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.436,
        "share": 1.8,
        "medianShare": 1.7,
        "gap": 0.025
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.304,
        "share": 1.2,
        "medianShare": 1.6,
        "gap": -0.086
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.28,
        "share": 1.1,
        "medianShare": 1.2,
        "gap": -0.017
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.19,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.07
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.314,
        "share": 1.3,
        "medianShare": 0.8,
        "gap": 0.106
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 0.4,
        "medianShare": 0.7,
        "gap": -0.066
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.16,
        "share": 0.7,
        "medianShare": 0.3,
        "gap": 0.076
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.033
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.034,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.011
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.097,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.034
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.051,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.013
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.164,
        "share": 0.7,
        "medianShare": 0.0,
        "gap": 0.164
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.052,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.028
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.002
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.52,
        "grossProfit": 0.65,
        "netProfit": 0.1,
        "grossMargin": 25.9,
        "netMargin": 4.1
      },
      {
        "month": "Фев",
        "revenue": 3.16,
        "grossProfit": 0.82,
        "netProfit": 0.18,
        "grossMargin": 25.9,
        "netMargin": 5.6
      },
      {
        "month": "Мар",
        "revenue": 3.11,
        "grossProfit": 0.84,
        "netProfit": 0.15,
        "grossMargin": 27.1,
        "netMargin": 4.8
      },
      {
        "month": "Апр",
        "revenue": 2.96,
        "grossProfit": 0.74,
        "netProfit": 0.09,
        "grossMargin": 24.8,
        "netMargin": 3.0
      },
      {
        "month": "Май",
        "revenue": 3.41,
        "grossProfit": 0.85,
        "netProfit": 0.12,
        "grossMargin": 25.0,
        "netMargin": 3.5
      },
      {
        "month": "Июн",
        "revenue": 3.45,
        "grossProfit": 0.86,
        "netProfit": 0.24,
        "grossMargin": 24.9,
        "netMargin": 7.0
      },
      {
        "month": "Июл",
        "revenue": 3.21,
        "grossProfit": 0.75,
        "netProfit": 0.04,
        "grossMargin": 23.3,
        "netMargin": 1.2
      },
      {
        "month": "Авг",
        "revenue": 2.71,
        "grossProfit": 0.65,
        "netProfit": -0.07,
        "grossMargin": 23.8,
        "netMargin": -2.5
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.503,
        "share": 10.2,
        "medianShare": 9.7,
        "gap": 0.133
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.19,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.071
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.28,
        "share": 1.1,
        "medianShare": 1.3,
        "gap": -0.036
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.034,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.011
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 3.1,
        "medianShare": 3.8,
        "gap": -0.164
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.364,
        "share": 1.5,
        "medianShare": 1.0,
        "gap": 0.127
      }
    ]
  },
  {
    "store": "К49",
    "profitRank": 14,
    "marginRank": 15,
    "mixRank": 17,
    "revenue": 17.529,
    "grossProfit": 4.558,
    "netProfit": 0.667,
    "grossMargin": 26.0,
    "netMargin": 3.8,
    "bestMonth": "Январь",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.22,
    "worstMonthProfit": -0.1,
    "lossMonths": 2,
    "product": {
      "purchaseSmoked": 7.036,
      "purchaseFrozen": 5.935,
      "salesSmoked": 8.872,
      "salesFrozen": 8.657,
      "smokedMarkup": 26.1,
      "frozenMarkup": 45.9,
      "frozenSalesShare": 49.4,
      "frozenUplift": 19.8
    },
    "stock": {
      "open": 0.687,
      "close": 0.874,
      "change": 0.186,
      "movement": -0.004,
      "discount": 0.028,
      "revaluation": 0.028,
      "effect": -0.005,
      "writeoffSmoked": 0.165,
      "writeoffFrozen": 0.01,
      "writeoffSmokedShare": 0.9,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.92,
        "share": 5.2,
        "medianShare": 3.8,
        "gap": 0.26
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.547,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.002
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.162,
        "share": 0.9,
        "medianShare": 2.8,
        "gap": -0.33
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.7,
        "share": 4.0,
        "medianShare": 3.7,
        "gap": 0.047
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.286,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.006
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.298,
        "share": 1.7,
        "medianShare": 1.6,
        "gap": 0.019
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.347,
        "share": 2.0,
        "medianShare": 1.2,
        "gap": 0.135
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.082
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.072,
        "share": 0.4,
        "medianShare": 0.8,
        "gap": -0.077
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.073
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.068,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.008
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.093,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.036
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.01,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.056,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.011
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.024,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.003
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.009,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.008
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.37,
        "grossProfit": 0.64,
        "netProfit": 0.22,
        "grossMargin": 26.9,
        "netMargin": 9.4
      },
      {
        "month": "Фев",
        "revenue": 2.31,
        "grossProfit": 0.64,
        "netProfit": 0.17,
        "grossMargin": 27.6,
        "netMargin": 7.4
      },
      {
        "month": "Мар",
        "revenue": 2.52,
        "grossProfit": 0.67,
        "netProfit": 0.2,
        "grossMargin": 26.8,
        "netMargin": 8.0
      },
      {
        "month": "Апр",
        "revenue": 2.17,
        "grossProfit": 0.56,
        "netProfit": 0.09,
        "grossMargin": 25.7,
        "netMargin": 4.3
      },
      {
        "month": "Май",
        "revenue": 2.15,
        "grossProfit": 0.55,
        "netProfit": 0.08,
        "grossMargin": 25.4,
        "netMargin": 3.9
      },
      {
        "month": "Июн",
        "revenue": 1.96,
        "grossProfit": 0.49,
        "netProfit": -0.09,
        "grossMargin": 25.2,
        "netMargin": -4.6
      },
      {
        "month": "Июл",
        "revenue": 1.96,
        "grossProfit": 0.49,
        "netProfit": -0.1,
        "grossMargin": 24.8,
        "netMargin": -5.2
      },
      {
        "month": "Авг",
        "revenue": 2.09,
        "grossProfit": 0.53,
        "netProfit": 0.08,
        "grossMargin": 25.1,
        "netMargin": 4.0
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.512,
        "share": 8.6,
        "medianShare": 9.7,
        "gap": -0.18
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.082
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.347,
        "share": 2.0,
        "medianShare": 1.3,
        "gap": 0.121
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.01,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.92,
        "share": 5.2,
        "medianShare": 3.8,
        "gap": 0.26
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.165,
        "share": 0.9,
        "medianShare": 1.0,
        "gap": -0.004
      }
    ]
  },
  {
    "store": "Л76",
    "profitRank": 15,
    "marginRank": 12,
    "mixRank": 28,
    "revenue": 13.241,
    "grossProfit": 3.219,
    "netProfit": 0.605,
    "grossMargin": 24.3,
    "netMargin": 4.6,
    "bestMonth": "Август",
    "worstMonth": "Май",
    "bestMonthProfit": 0.21,
    "worstMonthProfit": -0.03,
    "lossMonths": 2,
    "product": {
      "purchaseSmoked": 6.307,
      "purchaseFrozen": 3.716,
      "salesSmoked": 7.866,
      "salesFrozen": 5.375,
      "smokedMarkup": 24.7,
      "frozenMarkup": 44.7,
      "frozenSalesShare": 40.6,
      "frozenUplift": 19.9
    },
    "stock": {
      "open": 0.795,
      "close": 0.701,
      "change": -0.094,
      "movement": 0.0,
      "discount": 0.005,
      "revaluation": 0.0,
      "effect": -0.005,
      "writeoffSmoked": 0.284,
      "writeoffFrozen": 0.006,
      "writeoffSmokedShare": 2.1,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.4,
        "share": 3.0,
        "medianShare": 3.8,
        "gap": -0.098
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.386,
        "share": 2.9,
        "medianShare": 3.1,
        "gap": -0.028
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.429,
        "share": 3.2,
        "medianShare": 2.8,
        "gap": 0.058
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.421,
        "share": 3.2,
        "medianShare": 3.7,
        "gap": -0.072
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.233,
        "share": 1.8,
        "medianShare": 1.7,
        "gap": 0.011
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.184,
        "share": 1.4,
        "medianShare": 1.6,
        "gap": -0.026
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.24,
        "share": 1.8,
        "medianShare": 1.2,
        "gap": 0.08
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.036
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.115,
        "share": 0.9,
        "medianShare": 0.8,
        "gap": 0.003
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.7,
        "gap": -0.086
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.02,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.025
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.043
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.002
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.027,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.006
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.002
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.63,
        "grossProfit": 0.45,
        "netProfit": 0.15,
        "grossMargin": 27.8,
        "netMargin": 9.2
      },
      {
        "month": "Фев",
        "revenue": 1.25,
        "grossProfit": 0.29,
        "netProfit": -0.01,
        "grossMargin": 23.2,
        "netMargin": -0.8
      },
      {
        "month": "Мар",
        "revenue": 1.98,
        "grossProfit": 0.48,
        "netProfit": 0.14,
        "grossMargin": 24.2,
        "netMargin": 6.9
      },
      {
        "month": "Апр",
        "revenue": 1.45,
        "grossProfit": 0.36,
        "netProfit": 0.03,
        "grossMargin": 24.5,
        "netMargin": 1.7
      },
      {
        "month": "Май",
        "revenue": 1.27,
        "grossProfit": 0.27,
        "netProfit": -0.03,
        "grossMargin": 21.5,
        "netMargin": -2.2
      },
      {
        "month": "Июн",
        "revenue": 1.59,
        "grossProfit": 0.39,
        "netProfit": 0.06,
        "grossMargin": 24.4,
        "netMargin": 3.7
      },
      {
        "month": "Июл",
        "revenue": 1.73,
        "grossProfit": 0.41,
        "netProfit": 0.06,
        "grossMargin": 23.6,
        "netMargin": 3.4
      },
      {
        "month": "Авг",
        "revenue": 2.33,
        "grossProfit": 0.57,
        "netProfit": 0.21,
        "grossMargin": 24.4,
        "netMargin": 9.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.15,
        "share": 8.7,
        "medianShare": 9.7,
        "gap": -0.129
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.037
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.24,
        "share": 1.8,
        "medianShare": 1.3,
        "gap": 0.069
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.4,
        "share": 3.0,
        "medianShare": 3.8,
        "gap": -0.098
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.094,
        "share": 0.7,
        "medianShare": 1.0,
        "gap": -0.033
      }
    ]
  },
  {
    "store": "А3",
    "profitRank": 16,
    "marginRank": 14,
    "mixRank": 7,
    "revenue": 13.836,
    "grossProfit": 3.661,
    "netProfit": 0.582,
    "grossMargin": 26.5,
    "netMargin": 4.2,
    "bestMonth": "Июнь",
    "worstMonth": "Май",
    "bestMonthProfit": 0.12,
    "worstMonthProfit": -0.0,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 4.804,
      "purchaseFrozen": 5.37,
      "salesSmoked": 6.054,
      "salesFrozen": 7.781,
      "smokedMarkup": 26.0,
      "frozenMarkup": 44.9,
      "frozenSalesShare": 56.2,
      "frozenUplift": 18.9
    },
    "stock": {
      "open": 0.812,
      "close": 0.79,
      "change": -0.022,
      "movement": 0.0,
      "discount": 0.029,
      "revaluation": 0.015,
      "effect": -0.013,
      "writeoffSmoked": 0.053,
      "writeoffFrozen": 0.039,
      "writeoffSmokedShare": 0.4,
      "writeoffFrozenShare": 0.3
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.85,
        "share": 6.1,
        "medianShare": 3.8,
        "gap": 0.329
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.439,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.006
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.692,
        "share": 5.0,
        "medianShare": 2.8,
        "gap": 0.303
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.053,
        "share": 0.4,
        "medianShare": 3.7,
        "gap": -0.463
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.222,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.009
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.6,
        "gap": -0.22
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.291,
        "share": 2.1,
        "medianShare": 1.2,
        "gap": 0.123
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 1.6,
        "medianShare": 1.1,
        "gap": 0.077
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.173,
        "share": 1.3,
        "medianShare": 0.8,
        "gap": 0.056
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.7,
        "gap": -0.09
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.044
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.045
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.039,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.026
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.048,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.012
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.024,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.003
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.02,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.006
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.002,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.002
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.95,
        "grossProfit": 0.54,
        "netProfit": 0.04,
        "grossMargin": 27.8,
        "netMargin": 2.1
      },
      {
        "month": "Фев",
        "revenue": 1.82,
        "grossProfit": 0.5,
        "netProfit": 0.05,
        "grossMargin": 27.5,
        "netMargin": 2.6
      },
      {
        "month": "Мар",
        "revenue": 2.21,
        "grossProfit": 0.61,
        "netProfit": 0.11,
        "grossMargin": 27.3,
        "netMargin": 5.1
      },
      {
        "month": "Апр",
        "revenue": 2.35,
        "grossProfit": 0.62,
        "netProfit": 0.12,
        "grossMargin": 26.2,
        "netMargin": 4.9
      },
      {
        "month": "Май",
        "revenue": 1.44,
        "grossProfit": 0.37,
        "netProfit": -0.0,
        "grossMargin": 25.6,
        "netMargin": -0.0
      },
      {
        "month": "Июн",
        "revenue": 1.43,
        "grossProfit": 0.37,
        "netProfit": 0.12,
        "grossMargin": 25.8,
        "netMargin": 8.5
      },
      {
        "month": "Июл",
        "revenue": 1.09,
        "grossProfit": 0.27,
        "netProfit": 0.02,
        "grossMargin": 24.8,
        "netMargin": 2.1
      },
      {
        "month": "Авг",
        "revenue": 1.54,
        "grossProfit": 0.39,
        "netProfit": 0.12,
        "grossMargin": 25.2,
        "netMargin": 7.8
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 0.918,
        "share": 6.6,
        "medianShare": 9.7,
        "gap": -0.418
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.224,
        "share": 1.6,
        "medianShare": 1.1,
        "gap": 0.077
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.291,
        "share": 2.1,
        "medianShare": 1.3,
        "gap": 0.112
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.039,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.026
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.85,
        "share": 6.1,
        "medianShare": 3.8,
        "gap": 0.329
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.097,
        "share": 0.7,
        "medianShare": 1.0,
        "gap": -0.037
      }
    ]
  },
  {
    "store": "СНЕЖ",
    "profitRank": 17,
    "marginRank": 13,
    "mixRank": 26,
    "revenue": 12.105,
    "grossProfit": 3.157,
    "netProfit": 0.545,
    "grossMargin": 26.1,
    "netMargin": 4.5,
    "bestMonth": "Январь",
    "worstMonth": "Май",
    "bestMonthProfit": 0.2,
    "worstMonthProfit": -0.11,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 5.383,
      "purchaseFrozen": 3.564,
      "salesSmoked": 6.862,
      "salesFrozen": 5.243,
      "smokedMarkup": 27.5,
      "frozenMarkup": 47.1,
      "frozenSalesShare": 43.3,
      "frozenUplift": 19.6
    },
    "stock": {
      "open": 0.959,
      "close": 1.106,
      "change": 0.148,
      "movement": 0.0,
      "discount": 0.053,
      "revaluation": 0.076,
      "effect": 0.024,
      "writeoffSmoked": 0.059,
      "writeoffFrozen": 0.024,
      "writeoffSmokedShare": 0.5,
      "writeoffFrozenShare": 0.2
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.04,
        "share": 0.3,
        "medianShare": 3.8,
        "gap": -0.416
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.379,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.0
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.126,
        "share": 1.0,
        "medianShare": 2.8,
        "gap": -0.213
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.684,
        "share": 5.7,
        "medianShare": 3.7,
        "gap": 0.233
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.217,
        "share": 1.8,
        "medianShare": 1.7,
        "gap": 0.015
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.289,
        "share": 2.4,
        "medianShare": 1.6,
        "gap": 0.097
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.237,
        "share": 2.0,
        "medianShare": 1.2,
        "gap": 0.09
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.3,
        "share": 2.5,
        "medianShare": 1.1,
        "gap": 0.172
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.055,
        "share": 0.5,
        "medianShare": 0.8,
        "gap": -0.048
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.092,
        "share": 0.8,
        "medianShare": 0.7,
        "gap": 0.014
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.046,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.004
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.046,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.007
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.024,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.012
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.04,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.009
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.024,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.005
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.0
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.001,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.78,
        "grossProfit": 0.5,
        "netProfit": 0.2,
        "grossMargin": 28.1,
        "netMargin": 11.2
      },
      {
        "month": "Фев",
        "revenue": 1.73,
        "grossProfit": 0.49,
        "netProfit": 0.14,
        "grossMargin": 28.2,
        "netMargin": 8.3
      },
      {
        "month": "Мар",
        "revenue": 1.67,
        "grossProfit": 0.45,
        "netProfit": 0.1,
        "grossMargin": 27.2,
        "netMargin": 6.2
      },
      {
        "month": "Апр",
        "revenue": 1.54,
        "grossProfit": 0.39,
        "netProfit": 0.04,
        "grossMargin": 25.2,
        "netMargin": 2.6
      },
      {
        "month": "Май",
        "revenue": 1.33,
        "grossProfit": 0.34,
        "netProfit": -0.11,
        "grossMargin": 25.6,
        "netMargin": -8.2
      },
      {
        "month": "Июн",
        "revenue": 1.41,
        "grossProfit": 0.36,
        "netProfit": 0.07,
        "grossMargin": 25.2,
        "netMargin": 4.7
      },
      {
        "month": "Июл",
        "revenue": 1.24,
        "grossProfit": 0.29,
        "netProfit": 0.01,
        "grossMargin": 23.1,
        "netMargin": 1.2
      },
      {
        "month": "Авг",
        "revenue": 1.4,
        "grossProfit": 0.34,
        "netProfit": 0.09,
        "grossMargin": 24.6,
        "netMargin": 6.2
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.294,
        "share": 10.7,
        "medianShare": 9.7,
        "gap": 0.125
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.3,
        "share": 2.5,
        "medianShare": 1.1,
        "gap": 0.171
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.237,
        "share": 2.0,
        "medianShare": 1.3,
        "gap": 0.081
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.024,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.012
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.04,
        "share": 0.3,
        "medianShare": 3.8,
        "gap": -0.416
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.122,
        "share": 1.0,
        "medianShare": 1.0,
        "gap": 0.006
      }
    ]
  },
  {
    "store": "ГС1",
    "profitRank": 18,
    "marginRank": 19,
    "mixRank": 16,
    "revenue": 17.67,
    "grossProfit": 4.603,
    "netProfit": 0.332,
    "grossMargin": 26.1,
    "netMargin": 1.9,
    "bestMonth": "Февраль",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.17,
    "worstMonthProfit": -0.15,
    "lossMonths": 1,
    "product": {
      "purchaseSmoked": 7.067,
      "purchaseFrozen": 6.0,
      "salesSmoked": 8.931,
      "salesFrozen": 8.738,
      "smokedMarkup": 26.4,
      "frozenMarkup": 45.7,
      "frozenSalesShare": 49.5,
      "frozenUplift": 19.3
    },
    "stock": {
      "open": 1.332,
      "close": 1.016,
      "change": -0.316,
      "movement": 0.0,
      "discount": 0.02,
      "revaluation": 0.019,
      "effect": -0.001,
      "writeoffSmoked": 0.35,
      "writeoffFrozen": 0.008,
      "writeoffSmokedShare": 2.0,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.708,
        "share": 4.0,
        "medianShare": 3.8,
        "gap": 0.043
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.552,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.001
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.818,
        "share": 4.6,
        "medianShare": 2.8,
        "gap": 0.322
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.718,
        "share": 4.1,
        "medianShare": 3.7,
        "gap": 0.059
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.29,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.006
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.306,
        "share": 1.7,
        "medianShare": 1.6,
        "gap": 0.026
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.225,
        "share": 1.3,
        "medianShare": 1.2,
        "gap": 0.011
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.083
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.22,
        "share": 1.2,
        "medianShare": 0.8,
        "gap": 0.07
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.5,
        "medianShare": 0.7,
        "gap": -0.021
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.063,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.002
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.011
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.04,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.005
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.037,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.01
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.017,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.0
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.017,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.016
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.006,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.006
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.94,
        "grossProfit": 0.53,
        "netProfit": 0.08,
        "grossMargin": 27.5,
        "netMargin": 3.9
      },
      {
        "month": "Фев",
        "revenue": 2.47,
        "grossProfit": 0.7,
        "netProfit": 0.17,
        "grossMargin": 28.4,
        "netMargin": 6.8
      },
      {
        "month": "Мар",
        "revenue": 2.12,
        "grossProfit": 0.57,
        "netProfit": 0.03,
        "grossMargin": 26.8,
        "netMargin": 1.2
      },
      {
        "month": "Апр",
        "revenue": 2.29,
        "grossProfit": 0.6,
        "netProfit": 0.04,
        "grossMargin": 26.3,
        "netMargin": 1.8
      },
      {
        "month": "Май",
        "revenue": 2.06,
        "grossProfit": 0.52,
        "netProfit": 0.05,
        "grossMargin": 25.5,
        "netMargin": 2.2
      },
      {
        "month": "Июн",
        "revenue": 2.21,
        "grossProfit": 0.56,
        "netProfit": 0.05,
        "grossMargin": 25.5,
        "netMargin": 2.1
      },
      {
        "month": "Июл",
        "revenue": 2.13,
        "grossProfit": 0.51,
        "netProfit": -0.15,
        "grossMargin": 24.0,
        "netMargin": -6.9
      },
      {
        "month": "Авг",
        "revenue": 2.45,
        "grossProfit": 0.6,
        "netProfit": 0.08,
        "grossMargin": 24.5,
        "netMargin": 3.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.204,
        "share": 12.5,
        "medianShare": 9.7,
        "gap": 0.498
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.6,
        "medianShare": 1.1,
        "gap": -0.084
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.225,
        "share": 1.3,
        "medianShare": 1.3,
        "gap": -0.003
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.708,
        "share": 4.0,
        "medianShare": 3.8,
        "gap": 0.043
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.181,
        "share": 1.0,
        "medianShare": 1.0,
        "gap": 0.01
      }
    ]
  },
  {
    "store": "К80",
    "profitRank": 19,
    "marginRank": 18,
    "mixRank": 20,
    "revenue": 11.855,
    "grossProfit": 3.071,
    "netProfit": 0.261,
    "grossMargin": 25.9,
    "netMargin": 2.2,
    "bestMonth": "Январь",
    "worstMonth": "Июнь",
    "bestMonthProfit": 0.13,
    "worstMonthProfit": -0.05,
    "lossMonths": 3,
    "product": {
      "purchaseSmoked": 4.765,
      "purchaseFrozen": 4.019,
      "salesSmoked": 6.023,
      "salesFrozen": 5.832,
      "smokedMarkup": 26.4,
      "frozenMarkup": 45.1,
      "frozenSalesShare": 49.2,
      "frozenUplift": 18.7
    },
    "stock": {
      "open": 0.774,
      "close": 0.648,
      "change": -0.126,
      "movement": -0.018,
      "discount": 0.041,
      "revaluation": 0.037,
      "effect": -0.022,
      "writeoffSmoked": 0.585,
      "writeoffFrozen": 0.031,
      "writeoffSmokedShare": 4.9,
      "writeoffFrozenShare": 0.3
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.65,
        "share": 5.5,
        "medianShare": 3.8,
        "gap": 0.204
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.368,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.003
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.372,
        "share": 3.1,
        "medianShare": 2.8,
        "gap": 0.039
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.432,
        "share": 3.6,
        "medianShare": 3.7,
        "gap": -0.01
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.194,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.004
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.236,
        "share": 2.0,
        "medianShare": 1.6,
        "gap": 0.048
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.113,
        "share": 1.0,
        "medianShare": 1.2,
        "gap": -0.031
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.9,
        "medianShare": 1.1,
        "gap": -0.022
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.119,
        "share": 1.0,
        "medianShare": 0.8,
        "gap": 0.019
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.7,
        "gap": -0.077
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.016,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.024
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.02,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.019
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.031,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.02
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.05,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.02
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.024,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.006
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.073,
        "share": 0.6,
        "medianShare": 0.0,
        "gap": 0.073
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.007,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.51,
        "grossProfit": 0.41,
        "netProfit": 0.13,
        "grossMargin": 27.3,
        "netMargin": 8.7
      },
      {
        "month": "Фев",
        "revenue": 1.29,
        "grossProfit": 0.36,
        "netProfit": 0.03,
        "grossMargin": 28.3,
        "netMargin": 2.6
      },
      {
        "month": "Мар",
        "revenue": 1.67,
        "grossProfit": 0.45,
        "netProfit": 0.11,
        "grossMargin": 27.1,
        "netMargin": 6.8
      },
      {
        "month": "Апр",
        "revenue": 1.44,
        "grossProfit": 0.38,
        "netProfit": 0.04,
        "grossMargin": 26.3,
        "netMargin": 2.9
      },
      {
        "month": "Май",
        "revenue": 1.37,
        "grossProfit": 0.34,
        "netProfit": 0.02,
        "grossMargin": 24.8,
        "netMargin": 1.4
      },
      {
        "month": "Июн",
        "revenue": 1.63,
        "grossProfit": 0.4,
        "netProfit": -0.05,
        "grossMargin": 24.5,
        "netMargin": -3.0
      },
      {
        "month": "Июл",
        "revenue": 1.26,
        "grossProfit": 0.32,
        "netProfit": -0.02,
        "grossMargin": 25.0,
        "netMargin": -1.2
      },
      {
        "month": "Авг",
        "revenue": 1.69,
        "grossProfit": 0.41,
        "netProfit": -0.01,
        "grossMargin": 24.3,
        "netMargin": -0.9
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.252,
        "share": 10.6,
        "medianShare": 9.7,
        "gap": 0.108
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.9,
        "medianShare": 1.1,
        "gap": -0.022
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.113,
        "share": 1.0,
        "medianShare": 1.3,
        "gap": -0.04
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.031,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.02
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.65,
        "share": 5.5,
        "medianShare": 3.8,
        "gap": 0.204
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.098,
        "share": 0.8,
        "medianShare": 1.0,
        "gap": -0.017
      }
    ]
  },
  {
    "store": "ЗАО",
    "profitRank": 20,
    "marginRank": 20,
    "mixRank": 21,
    "revenue": 10.821,
    "grossProfit": 2.857,
    "netProfit": 0.11,
    "grossMargin": 26.4,
    "netMargin": 1.0,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.1,
    "worstMonthProfit": -0.12,
    "lossMonths": 3,
    "product": {
      "purchaseSmoked": 4.358,
      "purchaseFrozen": 3.606,
      "salesSmoked": 5.595,
      "salesFrozen": 5.226,
      "smokedMarkup": 28.4,
      "frozenMarkup": 44.9,
      "frozenSalesShare": 48.3,
      "frozenUplift": 16.5
    },
    "stock": {
      "open": 0.758,
      "close": 1.003,
      "change": 0.245,
      "movement": -0.006,
      "discount": 0.016,
      "revaluation": 0.017,
      "effect": -0.005,
      "writeoffSmoked": 0.03,
      "writeoffFrozen": 0.003,
      "writeoffSmokedShare": 0.3,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.04,
        "share": 0.4,
        "medianShare": 3.8,
        "gap": -0.367
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.343,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.004
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.116,
        "share": 1.1,
        "medianShare": 2.8,
        "gap": -0.188
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.698,
        "share": 6.4,
        "medianShare": 3.7,
        "gap": 0.295
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.197,
        "share": 1.8,
        "medianShare": 1.7,
        "gap": 0.016
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.296,
        "share": 2.7,
        "medianShare": 1.6,
        "gap": 0.125
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.2,
        "share": 1.8,
        "medianShare": 1.2,
        "gap": 0.069
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.288,
        "share": 2.7,
        "medianShare": 1.1,
        "gap": 0.173
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.047,
        "share": 0.4,
        "medianShare": 0.8,
        "gap": -0.045
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.28,
        "share": 2.6,
        "medianShare": 0.7,
        "gap": 0.209
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.064,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.027
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.14,
        "share": 1.3,
        "medianShare": 0.3,
        "gap": 0.105
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.007
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.028
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.022,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.005
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.002
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.001,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.32,
        "grossProfit": 0.36,
        "netProfit": 0.09,
        "grossMargin": 27.3,
        "netMargin": 7.1
      },
      {
        "month": "Фев",
        "revenue": 1.45,
        "grossProfit": 0.39,
        "netProfit": 0.07,
        "grossMargin": 26.6,
        "netMargin": 4.5
      },
      {
        "month": "Мар",
        "revenue": 1.53,
        "grossProfit": 0.43,
        "netProfit": 0.1,
        "grossMargin": 28.0,
        "netMargin": 6.4
      },
      {
        "month": "Апр",
        "revenue": 1.22,
        "grossProfit": 0.37,
        "netProfit": 0.04,
        "grossMargin": 30.1,
        "netMargin": 3.2
      },
      {
        "month": "Май",
        "revenue": 1.33,
        "grossProfit": 0.34,
        "netProfit": -0.09,
        "grossMargin": 25.5,
        "netMargin": -7.0
      },
      {
        "month": "Июн",
        "revenue": 1.41,
        "grossProfit": 0.35,
        "netProfit": -0.03,
        "grossMargin": 24.7,
        "netMargin": -2.4
      },
      {
        "month": "Июл",
        "revenue": 1.25,
        "grossProfit": 0.3,
        "netProfit": -0.12,
        "grossMargin": 23.8,
        "netMargin": -9.2
      },
      {
        "month": "Авг",
        "revenue": 1.3,
        "grossProfit": 0.33,
        "netProfit": 0.06,
        "grossMargin": 25.2,
        "netMargin": 4.3
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.577,
        "share": 14.6,
        "medianShare": 9.7,
        "gap": 0.532
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.288,
        "share": 2.7,
        "medianShare": 1.1,
        "gap": 0.173
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.2,
        "share": 1.8,
        "medianShare": 1.3,
        "gap": 0.061
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.007
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.04,
        "share": 0.4,
        "medianShare": 3.8,
        "gap": -0.367
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.099,
        "share": 0.9,
        "medianShare": 1.0,
        "gap": -0.005
      }
    ]
  },
  {
    "store": "ПЗ2",
    "profitRank": 21,
    "marginRank": 21,
    "mixRank": 22,
    "revenue": 12.429,
    "grossProfit": 3.177,
    "netProfit": 0.089,
    "grossMargin": 25.6,
    "netMargin": 0.7,
    "bestMonth": "Февраль",
    "worstMonth": "Май",
    "bestMonthProfit": 0.13,
    "worstMonthProfit": -0.09,
    "lossMonths": 4,
    "product": {
      "purchaseSmoked": 5.303,
      "purchaseFrozen": 3.949,
      "salesSmoked": 6.686,
      "salesFrozen": 5.743,
      "smokedMarkup": 26.1,
      "frozenMarkup": 45.4,
      "frozenSalesShare": 46.2,
      "frozenUplift": 19.4
    },
    "stock": {
      "open": 0.754,
      "close": 0.65,
      "change": -0.104,
      "movement": -0.016,
      "discount": 0.013,
      "revaluation": 0.013,
      "effect": -0.016,
      "writeoffSmoked": 0.092,
      "writeoffFrozen": 0.049,
      "writeoffSmokedShare": 0.7,
      "writeoffFrozenShare": 0.4
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.8,
        "share": 6.4,
        "medianShare": 3.8,
        "gap": 0.332
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.381,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.008
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.55,
        "share": 4.4,
        "medianShare": 2.8,
        "gap": 0.201
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.289,
        "share": 2.3,
        "medianShare": 3.7,
        "gap": -0.174
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.207,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": -0.001
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.118,
        "share": 1.0,
        "medianShare": 1.6,
        "gap": -0.079
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.343,
        "share": 2.8,
        "medianShare": 1.2,
        "gap": 0.192
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.028
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.144,
        "share": 1.2,
        "medianShare": 0.8,
        "gap": 0.038
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.7,
        "gap": -0.081
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.034,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.009
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.04
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.049,
        "share": 0.4,
        "medianShare": 0.1,
        "gap": 0.037
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.0
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.018,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.001
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.019,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.007
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.63,
        "grossProfit": 0.44,
        "netProfit": 0.09,
        "grossMargin": 27.1,
        "netMargin": 5.3
      },
      {
        "month": "Фев",
        "revenue": 1.77,
        "grossProfit": 0.48,
        "netProfit": 0.13,
        "grossMargin": 27.5,
        "netMargin": 7.5
      },
      {
        "month": "Мар",
        "revenue": 1.59,
        "grossProfit": 0.43,
        "netProfit": 0.03,
        "grossMargin": 27.2,
        "netMargin": 1.8
      },
      {
        "month": "Апр",
        "revenue": 1.23,
        "grossProfit": 0.31,
        "netProfit": -0.09,
        "grossMargin": 25.1,
        "netMargin": -7.4
      },
      {
        "month": "Май",
        "revenue": 1.19,
        "grossProfit": 0.3,
        "netProfit": -0.09,
        "grossMargin": 25.1,
        "netMargin": -7.9
      },
      {
        "month": "Июн",
        "revenue": 1.5,
        "grossProfit": 0.37,
        "netProfit": -0.03,
        "grossMargin": 24.6,
        "netMargin": -2.0
      },
      {
        "month": "Июл",
        "revenue": 1.75,
        "grossProfit": 0.42,
        "netProfit": -0.01,
        "grossMargin": 23.8,
        "netMargin": -0.3
      },
      {
        "month": "Авг",
        "revenue": 1.79,
        "grossProfit": 0.43,
        "netProfit": 0.06,
        "grossMargin": 24.0,
        "netMargin": 3.5
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.101,
        "share": 8.9,
        "medianShare": 9.7,
        "gap": -0.099
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.028
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.343,
        "share": 2.8,
        "medianShare": 1.3,
        "gap": 0.182
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.049,
        "share": 0.4,
        "medianShare": 0.1,
        "gap": 0.037
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.8,
        "share": 6.4,
        "medianShare": 3.8,
        "gap": 0.332
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.103,
        "share": 0.8,
        "medianShare": 1.0,
        "gap": -0.017
      }
    ]
  },
  {
    "store": "КИР2",
    "profitRank": 22,
    "marginRank": 22,
    "mixRank": 5,
    "revenue": 11.628,
    "grossProfit": 3.13,
    "netProfit": 0.011,
    "grossMargin": 26.9,
    "netMargin": 0.1,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.11,
    "worstMonthProfit": -0.17,
    "lossMonths": 3,
    "product": {
      "purchaseSmoked": 3.918,
      "purchaseFrozen": 4.58,
      "salesSmoked": 4.952,
      "salesFrozen": 6.676,
      "smokedMarkup": 26.4,
      "frozenMarkup": 45.8,
      "frozenSalesShare": 57.4,
      "frozenUplift": 19.4
    },
    "stock": {
      "open": 0.875,
      "close": 0.772,
      "change": -0.103,
      "movement": -0.003,
      "discount": 0.017,
      "revaluation": 0.006,
      "effect": -0.014,
      "writeoffSmoked": 0.176,
      "writeoffFrozen": 0.007,
      "writeoffSmokedShare": 1.5,
      "writeoffFrozenShare": 0.1
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.5,
        "share": 4.3,
        "medianShare": 3.8,
        "gap": 0.062
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.376,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.011
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.373,
        "share": 3.2,
        "medianShare": 2.8,
        "gap": 0.047
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.538,
        "share": 4.6,
        "medianShare": 3.7,
        "gap": 0.104
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.186,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.009
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.216,
        "share": 1.9,
        "medianShare": 1.6,
        "gap": 0.032
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.278,
        "share": 2.4,
        "medianShare": 1.2,
        "gap": 0.138
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 1.9,
        "medianShare": 1.1,
        "gap": 0.101
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.093,
        "share": 0.8,
        "medianShare": 0.8,
        "gap": -0.006
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 1.6,
        "medianShare": 0.7,
        "gap": 0.111
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.008,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.032
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.093,
        "share": 0.8,
        "medianShare": 0.3,
        "gap": 0.056
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.007,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.3,
        "gap": -0.018
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.006
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.016,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.005
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.44,
        "grossProfit": 0.41,
        "netProfit": 0.03,
        "grossMargin": 28.6,
        "netMargin": 1.8
      },
      {
        "month": "Фев",
        "revenue": 1.5,
        "grossProfit": 0.42,
        "netProfit": 0.04,
        "grossMargin": 27.9,
        "netMargin": 2.6
      },
      {
        "month": "Мар",
        "revenue": 2.13,
        "grossProfit": 0.58,
        "netProfit": 0.11,
        "grossMargin": 27.4,
        "netMargin": 5.2
      },
      {
        "month": "Апр",
        "revenue": 1.95,
        "grossProfit": 0.51,
        "netProfit": -0.07,
        "grossMargin": 26.0,
        "netMargin": -3.6
      },
      {
        "month": "Май",
        "revenue": 1.49,
        "grossProfit": 0.39,
        "netProfit": 0.05,
        "grossMargin": 26.4,
        "netMargin": 3.2
      },
      {
        "month": "Июн",
        "revenue": 0.83,
        "grossProfit": 0.23,
        "netProfit": -0.01,
        "grossMargin": 27.2,
        "netMargin": -1.0
      },
      {
        "month": "Июл",
        "revenue": 1.08,
        "grossProfit": 0.27,
        "netProfit": -0.17,
        "grossMargin": 25.2,
        "netMargin": -15.4
      },
      {
        "month": "Авг",
        "revenue": 1.2,
        "grossProfit": 0.31,
        "netProfit": 0.03,
        "grossMargin": 26.2,
        "netMargin": 2.8
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.501,
        "share": 12.9,
        "medianShare": 9.7,
        "gap": 0.378
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.224,
        "share": 1.9,
        "medianShare": 1.1,
        "gap": 0.1
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.278,
        "share": 2.4,
        "medianShare": 1.3,
        "gap": 0.128
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.007,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.5,
        "share": 4.3,
        "medianShare": 3.8,
        "gap": 0.062
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.048,
        "share": 0.4,
        "medianShare": 1.0,
        "gap": -0.064
      }
    ]
  },
  {
    "store": "РОС",
    "profitRank": 23,
    "marginRank": 24,
    "mixRank": 9,
    "revenue": 10.292,
    "grossProfit": 2.742,
    "netProfit": -0.114,
    "grossMargin": 26.6,
    "netMargin": -1.1,
    "bestMonth": "Март",
    "worstMonth": "Май",
    "bestMonthProfit": 0.08,
    "worstMonthProfit": -0.17,
    "lossMonths": 4,
    "product": {
      "purchaseSmoked": 3.651,
      "purchaseFrozen": 3.9,
      "salesSmoked": 4.641,
      "salesFrozen": 5.651,
      "smokedMarkup": 27.1,
      "frozenMarkup": 44.9,
      "frozenSalesShare": 54.9,
      "frozenUplift": 17.8
    },
    "stock": {
      "open": 0.922,
      "close": 0.798,
      "change": -0.124,
      "movement": -0.008,
      "discount": 0.01,
      "revaluation": 0.005,
      "effect": -0.013,
      "writeoffSmoked": 0.144,
      "writeoffFrozen": 0.1,
      "writeoffSmokedShare": 1.4,
      "writeoffFrozenShare": 1.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.4,
        "share": 3.9,
        "medianShare": 3.8,
        "gap": 0.013
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.329,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.007
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.268,
        "share": 2.6,
        "medianShare": 2.8,
        "gap": -0.021
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.526,
        "share": 5.1,
        "medianShare": 3.7,
        "gap": 0.143
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.168,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.004
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.184,
        "share": 1.8,
        "medianShare": 1.6,
        "gap": 0.021
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.43,
        "share": 4.2,
        "medianShare": 1.2,
        "gap": 0.306
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 1.0,
        "medianShare": 1.1,
        "gap": -0.005
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.085,
        "share": 0.8,
        "medianShare": 0.8,
        "gap": -0.002
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 0.9,
        "medianShare": 0.7,
        "gap": 0.026
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.054,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.019
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.013
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.1,
        "share": 1.0,
        "medianShare": 0.1,
        "gap": 0.09
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.034,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.007
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.015,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.001
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.007,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.003
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.011,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.01
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.22,
        "grossProfit": 0.33,
        "netProfit": 0.03,
        "grossMargin": 27.2,
        "netMargin": 2.5
      },
      {
        "month": "Фев",
        "revenue": 1.53,
        "grossProfit": 0.43,
        "netProfit": 0.06,
        "grossMargin": 27.9,
        "netMargin": 4.0
      },
      {
        "month": "Мар",
        "revenue": 1.53,
        "grossProfit": 0.43,
        "netProfit": 0.08,
        "grossMargin": 28.1,
        "netMargin": 5.5
      },
      {
        "month": "Апр",
        "revenue": 1.34,
        "grossProfit": 0.36,
        "netProfit": -0.03,
        "grossMargin": 26.6,
        "netMargin": -2.1
      },
      {
        "month": "Май",
        "revenue": 1.27,
        "grossProfit": 0.33,
        "netProfit": -0.17,
        "grossMargin": 25.9,
        "netMargin": -13.5
      },
      {
        "month": "Июн",
        "revenue": 1.19,
        "grossProfit": 0.32,
        "netProfit": -0.0,
        "grossMargin": 26.8,
        "netMargin": -0.2
      },
      {
        "month": "Июл",
        "revenue": 1.05,
        "grossProfit": 0.25,
        "netProfit": -0.09,
        "grossMargin": 24.1,
        "netMargin": -8.5
      },
      {
        "month": "Авг",
        "revenue": 1.15,
        "grossProfit": 0.29,
        "netProfit": 0.0,
        "grossMargin": 25.4,
        "netMargin": 0.3
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.204,
        "share": 11.7,
        "medianShare": 9.7,
        "gap": 0.21
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 1.0,
        "medianShare": 1.1,
        "gap": -0.005
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.43,
        "share": 4.2,
        "medianShare": 1.3,
        "gap": 0.298
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.1,
        "share": 1.0,
        "medianShare": 0.1,
        "gap": 0.09
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.4,
        "share": 3.9,
        "medianShare": 3.8,
        "gap": 0.013
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.12,
        "share": 1.2,
        "medianShare": 1.0,
        "gap": 0.021
      }
    ]
  },
  {
    "store": "ПЗ1",
    "profitRank": 24,
    "marginRank": 25,
    "mixRank": 27,
    "revenue": 10.944,
    "grossProfit": 2.74,
    "netProfit": -0.139,
    "grossMargin": 25.0,
    "netMargin": -1.3,
    "bestMonth": "Август",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.13,
    "worstMonthProfit": -0.2,
    "lossMonths": 6,
    "product": {
      "purchaseSmoked": 5.025,
      "purchaseFrozen": 3.179,
      "salesSmoked": 6.344,
      "salesFrozen": 4.6,
      "smokedMarkup": 26.2,
      "frozenMarkup": 44.7,
      "frozenSalesShare": 42.0,
      "frozenUplift": 18.4
    },
    "stock": {
      "open": 0.759,
      "close": 0.763,
      "change": 0.004,
      "movement": -0.015,
      "discount": 0.02,
      "revaluation": 0.007,
      "effect": -0.027,
      "writeoffSmoked": 0.26,
      "writeoffFrozen": 0.032,
      "writeoffSmokedShare": 2.4,
      "writeoffFrozenShare": 0.3
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 6.9,
        "medianShare": 3.8,
        "gap": 0.348
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.329,
        "share": 3.0,
        "medianShare": 3.1,
        "gap": -0.014
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.203,
        "share": 1.9,
        "medianShare": 2.8,
        "gap": -0.105
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.615,
        "share": 5.6,
        "medianShare": 3.7,
        "gap": 0.207
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.178,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.005
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.281,
        "share": 2.6,
        "medianShare": 1.6,
        "gap": 0.108
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.07,
        "share": 0.6,
        "medianShare": 1.2,
        "gap": -0.063
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 1.0,
        "medianShare": 1.1,
        "gap": -0.012
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.067,
        "share": 0.6,
        "medianShare": 0.8,
        "gap": -0.026
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 0.9,
        "medianShare": 0.7,
        "gap": 0.022
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.04,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.002
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.011
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.032,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.022
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.004
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.018,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.001
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.01,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.001
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.01,
        "grossProfit": 0.27,
        "netProfit": -0.05,
        "grossMargin": 27.0,
        "netMargin": -5.3
      },
      {
        "month": "Фев",
        "revenue": 1.12,
        "grossProfit": 0.3,
        "netProfit": -0.05,
        "grossMargin": 26.4,
        "netMargin": -4.9
      },
      {
        "month": "Мар",
        "revenue": 1.65,
        "grossProfit": 0.42,
        "netProfit": 0.07,
        "grossMargin": 25.2,
        "netMargin": 4.1
      },
      {
        "month": "Апр",
        "revenue": 1.35,
        "grossProfit": 0.34,
        "netProfit": -0.02,
        "grossMargin": 25.3,
        "netMargin": -1.2
      },
      {
        "month": "Май",
        "revenue": 1.37,
        "grossProfit": 0.34,
        "netProfit": -0.0,
        "grossMargin": 24.9,
        "netMargin": -0.0
      },
      {
        "month": "Июн",
        "revenue": 1.38,
        "grossProfit": 0.34,
        "netProfit": -0.01,
        "grossMargin": 24.3,
        "netMargin": -0.8
      },
      {
        "month": "Июл",
        "revenue": 1.26,
        "grossProfit": 0.29,
        "netProfit": -0.2,
        "grossMargin": 22.7,
        "netMargin": -16.2
      },
      {
        "month": "Авг",
        "revenue": 1.79,
        "grossProfit": 0.45,
        "netProfit": 0.13,
        "grossMargin": 25.0,
        "netMargin": 7.4
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.306,
        "share": 11.9,
        "medianShare": 9.7,
        "gap": 0.25
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 1.0,
        "medianShare": 1.1,
        "gap": -0.012
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.07,
        "share": 0.6,
        "medianShare": 1.3,
        "gap": -0.071
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.032,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.022
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 6.9,
        "medianShare": 3.8,
        "gap": 0.348
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.1,
        "share": 0.9,
        "medianShare": 1.0,
        "gap": -0.006
      }
    ]
  },
  {
    "store": "МОН",
    "profitRank": 25,
    "marginRank": 23,
    "mixRank": 23,
    "revenue": 16.422,
    "grossProfit": 4.238,
    "netProfit": -0.181,
    "grossMargin": 25.8,
    "netMargin": -1.1,
    "bestMonth": "Апрель",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.14,
    "worstMonthProfit": -0.22,
    "lossMonths": 5,
    "product": {
      "purchaseSmoked": 7.024,
      "purchaseFrozen": 5.161,
      "salesSmoked": 8.964,
      "salesFrozen": 7.458,
      "smokedMarkup": 27.6,
      "frozenMarkup": 44.5,
      "frozenSalesShare": 45.4,
      "frozenUplift": 16.9
    },
    "stock": {
      "open": 0.752,
      "close": 1.131,
      "change": 0.379,
      "movement": -0.016,
      "discount": 0.026,
      "revaluation": 0.034,
      "effect": -0.008,
      "writeoffSmoked": 0.097,
      "writeoffFrozen": 0.008,
      "writeoffSmokedShare": 0.6,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.6,
        "share": 3.7,
        "medianShare": 3.8,
        "gap": -0.018
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.509,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.006
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.536,
        "share": 3.3,
        "medianShare": 2.8,
        "gap": 0.075
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.676,
        "share": 4.1,
        "medianShare": 3.7,
        "gap": 0.064
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.274,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": -0.0
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.296,
        "share": 1.8,
        "medianShare": 1.6,
        "gap": 0.035
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.605,
        "share": 3.7,
        "medianShare": 1.2,
        "gap": 0.406
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.224,
        "share": 1.4,
        "medianShare": 1.1,
        "gap": 0.05
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.171,
        "share": 1.0,
        "medianShare": 0.8,
        "gap": 0.032
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.185,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.078
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.059,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.003
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.093,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.039
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.007
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.102,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.06
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.03,
        "share": 0.2,
        "medianShare": 0.2,
        "gap": 0.005
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": -0.004
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.039,
        "share": 0.2,
        "medianShare": 0.0,
        "gap": 0.039
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.99,
        "grossProfit": 0.52,
        "netProfit": 0.11,
        "grossMargin": 26.2,
        "netMargin": 5.5
      },
      {
        "month": "Фев",
        "revenue": 1.99,
        "grossProfit": 0.55,
        "netProfit": -0.0,
        "grossMargin": 27.6,
        "netMargin": -0.2
      },
      {
        "month": "Мар",
        "revenue": 2.13,
        "grossProfit": 0.58,
        "netProfit": -0.12,
        "grossMargin": 27.1,
        "netMargin": -5.7
      },
      {
        "month": "Апр",
        "revenue": 2.73,
        "grossProfit": 0.69,
        "netProfit": 0.14,
        "grossMargin": 25.3,
        "netMargin": 5.1
      },
      {
        "month": "Май",
        "revenue": 1.92,
        "grossProfit": 0.48,
        "netProfit": -0.07,
        "grossMargin": 25.1,
        "netMargin": -3.8
      },
      {
        "month": "Июн",
        "revenue": 1.87,
        "grossProfit": 0.49,
        "netProfit": -0.02,
        "grossMargin": 26.1,
        "netMargin": -1.3
      },
      {
        "month": "Июл",
        "revenue": 1.83,
        "grossProfit": 0.44,
        "netProfit": -0.22,
        "grossMargin": 23.7,
        "netMargin": -11.8
      },
      {
        "month": "Авг",
        "revenue": 1.95,
        "grossProfit": 0.49,
        "netProfit": 0.01,
        "grossMargin": 25.2,
        "netMargin": 0.4
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.958,
        "share": 11.9,
        "medianShare": 9.7,
        "gap": 0.372
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.263,
        "share": 1.6,
        "medianShare": 1.1,
        "gap": 0.088
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.605,
        "share": 3.7,
        "medianShare": 1.3,
        "gap": 0.393
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.008,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.007
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.6,
        "share": 3.7,
        "medianShare": 3.8,
        "gap": -0.018
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.242,
        "share": 1.5,
        "medianShare": 1.0,
        "gap": 0.084
      }
    ]
  },
  {
    "store": "МИРА",
    "profitRank": 26,
    "marginRank": 27,
    "mixRank": 8,
    "revenue": 8.823,
    "grossProfit": 2.391,
    "netProfit": -0.182,
    "grossMargin": 27.1,
    "netMargin": -2.1,
    "bestMonth": "Март",
    "worstMonth": "Май",
    "bestMonthProfit": 0.06,
    "worstMonthProfit": -0.18,
    "lossMonths": 4,
    "product": {
      "purchaseSmoked": 3.015,
      "purchaseFrozen": 3.417,
      "salesSmoked": 3.868,
      "salesFrozen": 4.956,
      "smokedMarkup": 28.3,
      "frozenMarkup": 45.0,
      "frozenSalesShare": 56.2,
      "frozenUplift": 16.8
    },
    "stock": {
      "open": 0.622,
      "close": 0.558,
      "change": -0.063,
      "movement": -0.031,
      "discount": 0.029,
      "revaluation": 0.02,
      "effect": -0.041,
      "writeoffSmoked": 0.066,
      "writeoffFrozen": 0.028,
      "writeoffSmokedShare": 0.8,
      "writeoffFrozenShare": 0.3
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.536,
        "share": 6.1,
        "medianShare": 3.8,
        "gap": 0.204
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.287,
        "share": 3.3,
        "medianShare": 3.1,
        "gap": 0.011
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.176,
        "share": 2.0,
        "medianShare": 2.8,
        "gap": -0.071
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.671,
        "share": 7.6,
        "medianShare": 3.7,
        "gap": 0.342
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.152,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.005
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.257,
        "share": 2.9,
        "medianShare": 1.6,
        "gap": 0.116
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.107
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 1.2,
        "medianShare": 1.1,
        "gap": 0.011
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.072,
        "share": 0.8,
        "medianShare": 0.8,
        "gap": -0.003
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.036
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.068,
        "share": 0.8,
        "medianShare": 0.3,
        "gap": 0.038
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.018
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.028,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.02
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.038,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.015
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.025,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.011
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.019,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.01
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.11,
        "grossProfit": 0.32,
        "netProfit": 0.04,
        "grossMargin": 28.6,
        "netMargin": 3.5
      },
      {
        "month": "Фев",
        "revenue": 1.06,
        "grossProfit": 0.31,
        "netProfit": 0.02,
        "grossMargin": 29.0,
        "netMargin": 1.7
      },
      {
        "month": "Мар",
        "revenue": 1.39,
        "grossProfit": 0.39,
        "netProfit": 0.06,
        "grossMargin": 28.3,
        "netMargin": 4.2
      },
      {
        "month": "Апр",
        "revenue": 0.92,
        "grossProfit": 0.25,
        "netProfit": -0.09,
        "grossMargin": 26.9,
        "netMargin": -9.5
      },
      {
        "month": "Май",
        "revenue": 1.1,
        "grossProfit": 0.28,
        "netProfit": -0.18,
        "grossMargin": 25.6,
        "netMargin": -16.6
      },
      {
        "month": "Июн",
        "revenue": 0.97,
        "grossProfit": 0.25,
        "netProfit": -0.03,
        "grossMargin": 26.0,
        "netMargin": -3.4
      },
      {
        "month": "Июл",
        "revenue": 1.07,
        "grossProfit": 0.27,
        "netProfit": -0.03,
        "grossMargin": 25.1,
        "netMargin": -3.1
      },
      {
        "month": "Авг",
        "revenue": 1.19,
        "grossProfit": 0.32,
        "netProfit": 0.04,
        "grossMargin": 26.8,
        "netMargin": 3.3
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.316,
        "share": 14.9,
        "medianShare": 9.7,
        "gap": 0.464
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 1.2,
        "medianShare": 1.1,
        "gap": 0.01
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.3,
        "gap": -0.114
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.028,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.02
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.536,
        "share": 6.1,
        "medianShare": 3.8,
        "gap": 0.204
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.15,
        "share": 1.7,
        "medianShare": 1.0,
        "gap": 0.065
      }
    ]
  },
  {
    "store": "П.ЗОР",
    "profitRank": 27,
    "marginRank": 26,
    "mixRank": 6,
    "revenue": 16.578,
    "grossProfit": 4.602,
    "netProfit": -0.252,
    "grossMargin": 27.8,
    "netMargin": -1.5,
    "bestMonth": "Февраль",
    "worstMonth": "Май",
    "bestMonthProfit": 0.12,
    "worstMonthProfit": -0.22,
    "lossMonths": 3,
    "product": {
      "purchaseSmoked": 5.552,
      "purchaseFrozen": 6.424,
      "salesSmoked": 7.104,
      "salesFrozen": 9.474,
      "smokedMarkup": 27.9,
      "frozenMarkup": 47.5,
      "frozenSalesShare": 57.1,
      "frozenUplift": 19.5
    },
    "stock": {
      "open": 0.557,
      "close": 0.931,
      "change": 0.374,
      "movement": 0.005,
      "discount": 0.002,
      "revaluation": 0.04,
      "effect": 0.043,
      "writeoffSmoked": 0.013,
      "writeoffFrozen": 0.03,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.2
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.823,
        "share": 5.0,
        "medianShare": 3.8,
        "gap": 0.199
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.552,
        "share": 3.3,
        "medianShare": 3.1,
        "gap": 0.033
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.429,
        "share": 2.6,
        "medianShare": 2.8,
        "gap": -0.036
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.632,
        "share": 3.8,
        "medianShare": 3.7,
        "gap": 0.014
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.286,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.009
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.245,
        "share": 1.5,
        "medianShare": 1.6,
        "gap": -0.018
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.201
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.702,
        "share": 4.2,
        "medianShare": 1.1,
        "gap": 0.526
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.235,
        "share": 1.4,
        "medianShare": 0.8,
        "gap": 0.094
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.079
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.109,
        "share": 0.7,
        "medianShare": 0.3,
        "gap": 0.052
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.094,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.04
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.03,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.014
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.05,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.007
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.012,
        "share": 0.1,
        "medianShare": 0.2,
        "gap": -0.014
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.004,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.012
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.306,
        "share": 1.8,
        "medianShare": 0.0,
        "gap": 0.306
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.108,
        "share": 0.7,
        "medianShare": 0.0,
        "gap": 0.108
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.05,
        "share": 0.3,
        "medianShare": 0.0,
        "gap": 0.05
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 2.18,
        "grossProfit": 0.64,
        "netProfit": 0.09,
        "grossMargin": 29.1,
        "netMargin": 4.2
      },
      {
        "month": "Фев",
        "revenue": 2.78,
        "grossProfit": 0.8,
        "netProfit": 0.12,
        "grossMargin": 28.9,
        "netMargin": 4.4
      },
      {
        "month": "Мар",
        "revenue": 2.32,
        "grossProfit": 0.65,
        "netProfit": 0.04,
        "grossMargin": 27.9,
        "netMargin": 1.7
      },
      {
        "month": "Апр",
        "revenue": 2.21,
        "grossProfit": 0.63,
        "netProfit": -0.15,
        "grossMargin": 28.3,
        "netMargin": -6.8
      },
      {
        "month": "Май",
        "revenue": 1.55,
        "grossProfit": 0.42,
        "netProfit": -0.22,
        "grossMargin": 26.9,
        "netMargin": -14.0
      },
      {
        "month": "Июн",
        "revenue": 1.66,
        "grossProfit": 0.45,
        "netProfit": -0.18,
        "grossMargin": 27.3,
        "netMargin": -11.1
      },
      {
        "month": "Июл",
        "revenue": 1.8,
        "grossProfit": 0.47,
        "netProfit": 0.03,
        "grossMargin": 26.0,
        "netMargin": 1.7
      },
      {
        "month": "Авг",
        "revenue": 2.07,
        "grossProfit": 0.55,
        "netProfit": 0.01,
        "grossMargin": 26.7,
        "netMargin": 0.7
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.822,
        "share": 11.0,
        "medianShare": 9.7,
        "gap": 0.222
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.81,
        "share": 4.9,
        "medianShare": 1.1,
        "gap": 0.634
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.306,
        "share": 1.8,
        "medianShare": 1.3,
        "gap": 0.093
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.03,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.014
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.823,
        "share": 5.0,
        "medianShare": 3.8,
        "gap": 0.199
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.639,
        "share": 3.9,
        "medianShare": 1.0,
        "gap": 0.479
      }
    ]
  },
  {
    "store": "УМБА",
    "profitRank": 28,
    "marginRank": 28,
    "mixRank": 10,
    "revenue": 8.391,
    "grossProfit": 2.212,
    "netProfit": -0.355,
    "grossMargin": 26.4,
    "netMargin": -4.2,
    "bestMonth": "Август",
    "worstMonth": "Май",
    "bestMonthProfit": 0.11,
    "worstMonthProfit": -0.17,
    "lossMonths": 6,
    "product": {
      "purchaseSmoked": 2.99,
      "purchaseFrozen": 3.189,
      "salesSmoked": 3.804,
      "salesFrozen": 4.587,
      "smokedMarkup": 27.2,
      "frozenMarkup": 43.9,
      "frozenSalesShare": 54.7,
      "frozenUplift": 16.6
    },
    "stock": {
      "open": 0.928,
      "close": 0.756,
      "change": -0.172,
      "movement": 0.0,
      "discount": 0.013,
      "revaluation": 0.011,
      "effect": -0.001,
      "writeoffSmoked": 0.079,
      "writeoffFrozen": 0.013,
      "writeoffSmokedShare": 0.9,
      "writeoffFrozenShare": 0.2
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.325,
        "share": 3.9,
        "medianShare": 3.8,
        "gap": 0.009
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.265,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.003
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.093,
        "share": 1.1,
        "medianShare": 2.8,
        "gap": -0.143
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.729,
        "share": 8.7,
        "medianShare": 3.7,
        "gap": 0.416
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.123,
        "share": 1.5,
        "medianShare": 1.7,
        "gap": -0.017
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.276,
        "share": 3.3,
        "medianShare": 1.6,
        "gap": 0.143
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.288,
        "share": 3.4,
        "medianShare": 1.2,
        "gap": 0.187
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.16,
        "share": 1.9,
        "medianShare": 1.1,
        "gap": 0.071
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.044,
        "share": 0.5,
        "medianShare": 0.8,
        "gap": -0.027
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.094,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.039
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.045,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.016
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.02
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.013,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.005
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.02,
        "share": 0.2,
        "medianShare": 0.3,
        "gap": -0.002
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.021,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.008
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.003,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.005
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.02,
        "share": 0.2,
        "medianShare": 0.0,
        "gap": 0.02
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 0.8,
        "grossProfit": 0.23,
        "netProfit": -0.06,
        "grossMargin": 28.3,
        "netMargin": -7.1
      },
      {
        "month": "Фев",
        "revenue": 0.91,
        "grossProfit": 0.24,
        "netProfit": -0.11,
        "grossMargin": 26.2,
        "netMargin": -11.5
      },
      {
        "month": "Мар",
        "revenue": 0.99,
        "grossProfit": 0.26,
        "netProfit": -0.09,
        "grossMargin": 26.7,
        "netMargin": -9.1
      },
      {
        "month": "Апр",
        "revenue": 1.09,
        "grossProfit": 0.3,
        "netProfit": -0.04,
        "grossMargin": 27.6,
        "netMargin": -3.7
      },
      {
        "month": "Май",
        "revenue": 0.72,
        "grossProfit": 0.19,
        "netProfit": -0.17,
        "grossMargin": 25.8,
        "netMargin": -23.7
      },
      {
        "month": "Июн",
        "revenue": 1.23,
        "grossProfit": 0.32,
        "netProfit": 0.04,
        "grossMargin": 26.2,
        "netMargin": 3.5
      },
      {
        "month": "Июл",
        "revenue": 1.41,
        "grossProfit": 0.35,
        "netProfit": -0.04,
        "grossMargin": 25.0,
        "netMargin": -3.0
      },
      {
        "month": "Авг",
        "revenue": 1.25,
        "grossProfit": 0.32,
        "netProfit": 0.11,
        "grossMargin": 25.9,
        "netMargin": 8.5
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.283,
        "share": 15.3,
        "medianShare": 9.7,
        "gap": 0.473
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.18,
        "share": 2.1,
        "medianShare": 1.1,
        "gap": 0.091
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.288,
        "share": 3.4,
        "medianShare": 1.3,
        "gap": 0.18
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.013,
        "share": 0.2,
        "medianShare": 0.1,
        "gap": 0.005
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.325,
        "share": 3.9,
        "medianShare": 3.8,
        "gap": 0.009
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.109,
        "share": 1.3,
        "medianShare": 1.0,
        "gap": 0.028
      }
    ]
  },
  {
    "store": "МАК",
    "profitRank": 29,
    "marginRank": 29,
    "mixRank": 4,
    "revenue": 7.978,
    "grossProfit": 2.141,
    "netProfit": -0.546,
    "grossMargin": 26.8,
    "netMargin": -6.8,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.06,
    "worstMonthProfit": -0.23,
    "lossMonths": 6,
    "product": {
      "purchaseSmoked": 2.674,
      "purchaseFrozen": 3.163,
      "salesSmoked": 3.371,
      "salesFrozen": 4.607,
      "smokedMarkup": 26.1,
      "frozenMarkup": 45.6,
      "frozenSalesShare": 57.7,
      "frozenUplift": 19.6
    },
    "stock": {
      "open": 0.826,
      "close": 0.659,
      "change": -0.168,
      "movement": 0.0,
      "discount": 0.013,
      "revaluation": 0.013,
      "effect": -0.001,
      "writeoffSmoked": 0.009,
      "writeoffFrozen": 0.021,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.3
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.6,
        "share": 7.5,
        "medianShare": 3.8,
        "gap": 0.3
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.257,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.007
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.449,
        "share": 5.6,
        "medianShare": 2.8,
        "gap": 0.225
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.395,
        "share": 4.9,
        "medianShare": 3.7,
        "gap": 0.097
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.135,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.002
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.184,
        "share": 2.3,
        "medianShare": 1.6,
        "gap": 0.058
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.2,
        "gap": -0.097
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 1.3,
        "medianShare": 1.1,
        "gap": 0.02
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.153,
        "share": 1.9,
        "medianShare": 0.8,
        "gap": 0.086
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 1.2,
        "medianShare": 0.7,
        "gap": 0.041
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.085,
        "share": 1.1,
        "medianShare": 0.3,
        "gap": 0.058
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.021
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.021,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.014
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.012
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.027,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.015
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.093,
        "share": 1.2,
        "medianShare": 0.0,
        "gap": 0.093
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.011,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.003
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.0
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 0.87,
        "grossProfit": 0.26,
        "netProfit": -0.01,
        "grossMargin": 29.5,
        "netMargin": -1.5
      },
      {
        "month": "Фев",
        "revenue": 1.21,
        "grossProfit": 0.33,
        "netProfit": 0.01,
        "grossMargin": 27.4,
        "netMargin": 0.7
      },
      {
        "month": "Мар",
        "revenue": 1.34,
        "grossProfit": 0.38,
        "netProfit": 0.06,
        "grossMargin": 28.5,
        "netMargin": 4.1
      },
      {
        "month": "Апр",
        "revenue": 1.02,
        "grossProfit": 0.28,
        "netProfit": -0.03,
        "grossMargin": 27.7,
        "netMargin": -2.8
      },
      {
        "month": "Май",
        "revenue": 1.05,
        "grossProfit": 0.27,
        "netProfit": -0.03,
        "grossMargin": 25.9,
        "netMargin": -3.2
      },
      {
        "month": "Июн",
        "revenue": 0.79,
        "grossProfit": 0.19,
        "netProfit": -0.1,
        "grossMargin": 24.4,
        "netMargin": -12.8
      },
      {
        "month": "Июл",
        "revenue": 0.83,
        "grossProfit": 0.2,
        "netProfit": -0.23,
        "grossMargin": 24.3,
        "netMargin": -27.5
      },
      {
        "month": "Авг",
        "revenue": 0.88,
        "grossProfit": 0.23,
        "netProfit": -0.21,
        "grossMargin": 25.7,
        "netMargin": -23.3
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.415,
        "share": 17.7,
        "medianShare": 9.7,
        "gap": 0.645
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 1.3,
        "medianShare": 1.1,
        "gap": 0.019
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 1.3,
        "gap": -0.103
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.021,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.014
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.6,
        "share": 7.5,
        "medianShare": 3.8,
        "gap": 0.3
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.155,
        "share": 1.9,
        "medianShare": 1.0,
        "gap": 0.078
      }
    ]
  },
  {
    "store": "С3",
    "profitRank": 30,
    "marginRank": 30,
    "mixRank": 24,
    "revenue": 8.149,
    "grossProfit": 2.078,
    "netProfit": -0.563,
    "grossMargin": 25.5,
    "netMargin": -6.9,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "bestMonthProfit": 0.0,
    "worstMonthProfit": -0.2,
    "lossMonths": 7,
    "product": {
      "purchaseSmoked": 3.574,
      "purchaseFrozen": 2.498,
      "salesSmoked": 4.52,
      "salesFrozen": 3.629,
      "smokedMarkup": 26.5,
      "frozenMarkup": 45.3,
      "frozenSalesShare": 44.5,
      "frozenUplift": 18.8
    },
    "stock": {
      "open": 1.297,
      "close": 0.957,
      "change": -0.34,
      "movement": 0.3,
      "discount": 0.014,
      "revaluation": 0.012,
      "effect": 0.298,
      "writeoffSmoked": 0.011,
      "writeoffFrozen": 0.002,
      "writeoffSmokedShare": 0.1,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.272,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.035
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.249,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.006
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.56,
        "share": 6.9,
        "medianShare": 2.8,
        "gap": 0.332
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.288,
        "share": 3.5,
        "medianShare": 3.7,
        "gap": -0.016
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.155,
        "share": 1.9,
        "medianShare": 1.7,
        "gap": 0.019
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.118,
        "share": 1.4,
        "medianShare": 1.6,
        "gap": -0.012
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.184,
        "share": 2.3,
        "medianShare": 1.2,
        "gap": 0.085
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.18,
        "share": 2.2,
        "medianShare": 1.1,
        "gap": 0.094
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.19,
        "share": 2.3,
        "medianShare": 0.8,
        "gap": 0.121
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.093,
        "share": 1.1,
        "medianShare": 0.7,
        "gap": 0.04
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.124,
        "share": 1.5,
        "medianShare": 0.3,
        "gap": 0.096
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.046,
        "share": 0.6,
        "medianShare": 0.3,
        "gap": 0.02
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.002,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.032,
        "share": 0.4,
        "medianShare": 0.3,
        "gap": 0.011
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.024,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.011
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.093,
        "share": 1.1,
        "medianShare": 0.0,
        "gap": 0.093
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.029,
        "share": 0.4,
        "medianShare": 0.1,
        "gap": 0.021
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.002,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 0.84,
        "grossProfit": 0.22,
        "netProfit": -0.04,
        "grossMargin": 25.6,
        "netMargin": -5.0
      },
      {
        "month": "Фев",
        "revenue": 1.27,
        "grossProfit": 0.35,
        "netProfit": -0.09,
        "grossMargin": 27.4,
        "netMargin": -7.3
      },
      {
        "month": "Мар",
        "revenue": 1.12,
        "grossProfit": 0.3,
        "netProfit": 0.0,
        "grossMargin": 26.7,
        "netMargin": 0.4
      },
      {
        "month": "Апр",
        "revenue": 0.96,
        "grossProfit": 0.24,
        "netProfit": -0.07,
        "grossMargin": 25.3,
        "netMargin": -7.0
      },
      {
        "month": "Май",
        "revenue": 1.03,
        "grossProfit": 0.26,
        "netProfit": -0.02,
        "grossMargin": 25.6,
        "netMargin": -2.1
      },
      {
        "month": "Июн",
        "revenue": 0.92,
        "grossProfit": 0.23,
        "netProfit": -0.07,
        "grossMargin": 24.8,
        "netMargin": -7.3
      },
      {
        "month": "Июл",
        "revenue": 1.02,
        "grossProfit": 0.24,
        "netProfit": -0.2,
        "grossMargin": 23.3,
        "netMargin": -19.1
      },
      {
        "month": "Авг",
        "revenue": 0.97,
        "grossProfit": 0.24,
        "netProfit": -0.08,
        "grossMargin": 24.4,
        "netMargin": -8.5
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.389,
        "share": 17.0,
        "medianShare": 9.7,
        "gap": 0.602
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.18,
        "share": 2.2,
        "medianShare": 1.1,
        "gap": 0.093
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.184,
        "share": 2.3,
        "medianShare": 1.3,
        "gap": 0.079
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.002,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.006
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.272,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.035
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.211,
        "share": 2.6,
        "medianShare": 1.0,
        "gap": 0.132
      }
    ]
  },
  {
    "store": "НИК",
    "profitRank": 31,
    "marginRank": 32,
    "mixRank": 29,
    "revenue": 9.943,
    "grossProfit": 2.549,
    "netProfit": -0.805,
    "grossMargin": 25.6,
    "netMargin": -8.1,
    "bestMonth": "Январь",
    "worstMonth": "Апрель",
    "bestMonthProfit": -0.0,
    "worstMonthProfit": -0.2,
    "lossMonths": 8,
    "product": {
      "purchaseSmoked": 4.629,
      "purchaseFrozen": 2.765,
      "salesSmoked": 5.91,
      "salesFrozen": 4.033,
      "smokedMarkup": 27.7,
      "frozenMarkup": 45.9,
      "frozenSalesShare": 40.6,
      "frozenUplift": 18.2
    },
    "stock": {
      "open": 0.81,
      "close": 0.829,
      "change": 0.019,
      "movement": -0.01,
      "discount": 0.034,
      "revaluation": 0.003,
      "effect": -0.041,
      "writeoffSmoked": 0.215,
      "writeoffFrozen": 0.0,
      "writeoffSmokedShare": 2.2,
      "writeoffFrozenShare": 0.0
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 7.6,
        "medianShare": 3.8,
        "gap": 0.386
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.306,
        "share": 3.1,
        "medianShare": 3.1,
        "gap": -0.005
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 0.179,
        "share": 1.8,
        "medianShare": 2.8,
        "gap": -0.1
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.666,
        "share": 6.7,
        "medianShare": 3.7,
        "gap": 0.296
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.166,
        "share": 1.7,
        "medianShare": 1.7,
        "gap": 0.0
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.27,
        "share": 2.7,
        "medianShare": 1.6,
        "gap": 0.112
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.261,
        "share": 2.6,
        "medianShare": 1.2,
        "gap": 0.141
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.288,
        "share": 2.9,
        "medianShare": 1.1,
        "gap": 0.183
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.064,
        "share": 0.6,
        "medianShare": 0.8,
        "gap": -0.02
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 1.9,
        "medianShare": 0.7,
        "gap": 0.123
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.026,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": -0.008
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.094,
        "share": 0.9,
        "medianShare": 0.3,
        "gap": 0.061
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.3,
        "gap": -0.026
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.027,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.012
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.011,
        "share": 0.1,
        "medianShare": 0.1,
        "gap": 0.001
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.048,
        "share": 0.5,
        "medianShare": 0.0,
        "gap": 0.048
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.39,
        "grossProfit": 0.36,
        "netProfit": -0.0,
        "grossMargin": 26.1,
        "netMargin": -0.1
      },
      {
        "month": "Фев",
        "revenue": 1.48,
        "grossProfit": 0.39,
        "netProfit": -0.03,
        "grossMargin": 26.4,
        "netMargin": -1.9
      },
      {
        "month": "Мар",
        "revenue": 1.57,
        "grossProfit": 0.41,
        "netProfit": -0.08,
        "grossMargin": 26.0,
        "netMargin": -4.9
      },
      {
        "month": "Апр",
        "revenue": 1.25,
        "grossProfit": 0.34,
        "netProfit": -0.2,
        "grossMargin": 27.4,
        "netMargin": -16.3
      },
      {
        "month": "Май",
        "revenue": 1.06,
        "grossProfit": 0.27,
        "netProfit": -0.2,
        "grossMargin": 25.3,
        "netMargin": -18.9
      },
      {
        "month": "Июн",
        "revenue": 1.01,
        "grossProfit": 0.26,
        "netProfit": -0.07,
        "grossMargin": 25.7,
        "netMargin": -6.7
      },
      {
        "month": "Июл",
        "revenue": 1.19,
        "grossProfit": 0.27,
        "netProfit": -0.11,
        "grossMargin": 23.0,
        "netMargin": -9.2
      },
      {
        "month": "Авг",
        "revenue": 1.0,
        "grossProfit": 0.25,
        "netProfit": -0.12,
        "grossMargin": 24.7,
        "netMargin": -11.7
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 1.46,
        "share": 14.7,
        "medianShare": 9.7,
        "gap": 0.5
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.336,
        "share": 3.4,
        "medianShare": 1.1,
        "gap": 0.23
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.261,
        "share": 2.6,
        "medianShare": 1.3,
        "gap": 0.133
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.1,
        "gap": -0.009
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.76,
        "share": 7.6,
        "medianShare": 3.8,
        "gap": 0.386
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.112,
        "share": 1.1,
        "medianShare": 1.0,
        "gap": 0.016
      }
    ]
  },
  {
    "store": "Н95",
    "profitRank": 32,
    "marginRank": 31,
    "mixRank": 12,
    "revenue": 13.734,
    "grossProfit": 3.695,
    "netProfit": -1.101,
    "grossMargin": 26.9,
    "netMargin": -8.0,
    "bestMonth": "Март",
    "worstMonth": "Февраль",
    "bestMonthProfit": -0.02,
    "worstMonthProfit": -0.26,
    "lossMonths": 8,
    "product": {
      "purchaseSmoked": 5.002,
      "purchaseFrozen": 5.036,
      "salesSmoked": 6.434,
      "salesFrozen": 7.3,
      "smokedMarkup": 28.6,
      "frozenMarkup": 45.0,
      "frozenSalesShare": 53.2,
      "frozenUplift": 16.3
    },
    "stock": {
      "open": 1.316,
      "close": 0.996,
      "change": -0.32,
      "movement": -0.006,
      "discount": 0.042,
      "revaluation": 0.026,
      "effect": -0.022,
      "writeoffSmoked": 0.059,
      "writeoffFrozen": 0.188,
      "writeoffSmokedShare": 0.4,
      "writeoffFrozenShare": 1.4
    },
    "expenses": [
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.45,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.067
      },
      {
        "label": "Налог с валовой прибыли",
        "field": "gross_profit_tax",
        "amount": 0.443,
        "share": 3.2,
        "medianShare": 3.1,
        "gap": 0.013
      },
      {
        "label": "Зарплата (наличные)",
        "field": "salary_cash",
        "amount": 1.033,
        "share": 7.5,
        "medianShare": 2.8,
        "gap": 0.647
      },
      {
        "label": "Зарплата (безнал)",
        "field": "salary_cashless",
        "amount": 0.577,
        "share": 4.2,
        "medianShare": 3.7,
        "gap": 0.065
      },
      {
        "label": "Банковская комиссия",
        "field": "bank_fee",
        "amount": 0.222,
        "share": 1.6,
        "medianShare": 1.7,
        "gap": -0.008
      },
      {
        "label": "Налоги на ФОТ",
        "field": "payroll_tax",
        "amount": 0.267,
        "share": 1.9,
        "medianShare": 1.6,
        "gap": 0.049
      },
      {
        "label": "Коммунальные (безнал)",
        "field": "utilities_cashless",
        "amount": 0.438,
        "share": 3.2,
        "medianShare": 1.2,
        "gap": 0.272
      },
      {
        "label": "Водитель (безнал)",
        "field": "driver_cashless",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.041
      },
      {
        "label": "НДФЛ",
        "field": "personal_income_tax",
        "amount": 0.338,
        "share": 2.5,
        "medianShare": 0.8,
        "gap": 0.221
      },
      {
        "label": "Отпускные (безнал)",
        "field": "vacation_cashless",
        "amount": 0.187,
        "share": 1.4,
        "medianShare": 0.7,
        "gap": 0.097
      },
      {
        "label": "Выслуга",
        "field": "service_bonus",
        "amount": 0.067,
        "share": 0.5,
        "medianShare": 0.3,
        "gap": 0.02
      },
      {
        "label": "Налоги на отпускные",
        "field": "vacation_tax",
        "amount": 0.047,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.002
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.188,
        "share": 1.4,
        "medianShare": 0.1,
        "gap": 0.176
      },
      {
        "label": "Уборка",
        "field": "cleaning",
        "amount": 0.048,
        "share": 0.3,
        "medianShare": 0.3,
        "gap": 0.013
      },
      {
        "label": "Премия",
        "field": "bonus",
        "amount": 0.036,
        "share": 0.3,
        "medianShare": 0.2,
        "gap": 0.015
      },
      {
        "label": "Отпускные (наличные)",
        "field": "vacation_cash",
        "amount": 0.077,
        "share": 0.6,
        "medianShare": 0.0,
        "gap": 0.077
      },
      {
        "label": "Хоз. нужды",
        "field": "household",
        "amount": 0.035,
        "share": 0.3,
        "medianShare": 0.1,
        "gap": 0.021
      },
      {
        "label": "Коммунальные (наличные)",
        "field": "utilities_cash",
        "amount": 0.229,
        "share": 1.7,
        "medianShare": 0.0,
        "gap": 0.229
      },
      {
        "label": "Водитель (наличные)",
        "field": "driver_cash",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Прочие наличные расходы",
        "field": "other_cash_expenses",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": -0.001
      },
      {
        "label": "Доставка",
        "field": "delivery",
        "amount": 0.0,
        "share": 0.0,
        "medianShare": 0.0,
        "gap": 0.0
      },
      {
        "label": "Доплата",
        "field": "extra_pay",
        "amount": 0.011,
        "share": 0.1,
        "medianShare": 0.0,
        "gap": 0.011
      }
    ],
    "monthly": [
      {
        "month": "Янв",
        "revenue": 1.37,
        "grossProfit": 0.38,
        "netProfit": -0.06,
        "grossMargin": 27.6,
        "netMargin": -4.4
      },
      {
        "month": "Фев",
        "revenue": 1.87,
        "grossProfit": 0.53,
        "netProfit": -0.26,
        "grossMargin": 28.4,
        "netMargin": -14.1
      },
      {
        "month": "Мар",
        "revenue": 2.29,
        "grossProfit": 0.64,
        "netProfit": -0.02,
        "grossMargin": 28.0,
        "netMargin": -0.7
      },
      {
        "month": "Апр",
        "revenue": 1.63,
        "grossProfit": 0.46,
        "netProfit": -0.06,
        "grossMargin": 28.3,
        "netMargin": -3.4
      },
      {
        "month": "Май",
        "revenue": 1.6,
        "grossProfit": 0.42,
        "netProfit": -0.24,
        "grossMargin": 26.3,
        "netMargin": -15.1
      },
      {
        "month": "Июн",
        "revenue": 1.52,
        "grossProfit": 0.37,
        "netProfit": -0.19,
        "grossMargin": 24.7,
        "netMargin": -12.3
      },
      {
        "month": "Июл",
        "revenue": 1.48,
        "grossProfit": 0.37,
        "netProfit": -0.16,
        "grossMargin": 25.2,
        "netMargin": -10.6
      },
      {
        "month": "Авг",
        "revenue": 1.97,
        "grossProfit": 0.51,
        "netProfit": -0.12,
        "grossMargin": 26.0,
        "netMargin": -6.1
      }
    ],
    "comparison": [
      {
        "label": "ФОТ: всего",
        "field": "payroll_total",
        "amount": 2.525,
        "share": 18.4,
        "medianShare": 9.7,
        "gap": 1.199
      },
      {
        "label": "Водитель: всего",
        "field": "driver_total",
        "amount": 0.104,
        "share": 0.8,
        "medianShare": 1.1,
        "gap": -0.042
      },
      {
        "label": "Коммунальные: всего",
        "field": "utilities_total",
        "amount": 0.666,
        "share": 4.9,
        "medianShare": 1.3,
        "gap": 0.489
      },
      {
        "label": "Списания М.",
        "field": "writeoff_frozen",
        "amount": 0.188,
        "share": 1.4,
        "medianShare": 0.1,
        "gap": 0.176
      },
      {
        "label": "Аренда",
        "field": "rent",
        "amount": 0.45,
        "share": 3.3,
        "medianShare": 3.8,
        "gap": -0.067
      },
      {
        "label": "Наличные операционные траты",
        "field": "cash_operating_total",
        "amount": 0.425,
        "share": 3.1,
        "medianShare": 1.0,
        "gap": 0.293
      }
    ]
  }
] as const;

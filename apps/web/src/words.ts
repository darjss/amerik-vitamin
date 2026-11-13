import type {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  ProductForm,
  StockLevel,
  StockMoveReason,
} from "@amerik/contracts";

export const formText: Record<ProductForm, string> = {
  softgel: "Зөөлөн капсул",
  capsule: "Капсул",
  tablet: "Шахмал",
  chewable: "Зажилдаг шахмал",
  gummy: "Гамми",
  lozenge: "Хөхдөг шахмал",
  powder: "Нунтаг",
  liquid: "Шингэн",
  drops: "Дусал",
  other: "Бусад",
};

/** What the stock asks of her: reorder, reorder soon, or count it once. */
export const stockAsk: Record<StockLevel, string | undefined> = {
  out: "Захиалах",
  low: "Дуусаж байна",
  unknown: "Тоол",
  ok: undefined,
};

export const reasonText: Record<StockMoveReason, string> = {
  sale: "Зарсан",
  cancel: "Цуцалсан",
  edit: "Захиалга зассан",
  receipt: "Ирсэн",
  count: "Тоолсон",
};

/** An order's status in a word. `paid` reads as ready, since a new COD order is ready too. */
export const statusText: Record<OrderStatus, string> = {
  new: "Шинэ",
  paid: "Илгээхэд бэлэн",
  shipped: "Замд",
  delivered: "Хүргэсэн",
  cancelled: "Цуцалсан",
};

export const sourceText: Record<OrderSource, string> = {
  messenger_bot: "Messenger бот",
  messenger_human: "Чат",
  web: "Вэб",
  brand_site: "Брэнд сайт",
  phone: "Утас",
  walk_in: "Дэлгүүр",
  notebook: "Дэвтэр",
};

export const methodText: Record<PaymentMethod, string> = {
  qpay: "QPay",
  transfer: "Шилжүүлэг",
  cash: "Бэлэн",
};

/** The name-and-price copy button, by what the last copy did. */
export const copyText = {
  idle: "Нэр, үнэ хуулах",
  copied: "Хуулсан",
  failed: "Хуулж чадсангүй",
};

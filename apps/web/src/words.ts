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

/** An order list row's status, where there is no next step to take. */
export const statusText: Record<OrderStatus, string> = {
  new: "Төлбөр хүлээж",
  paid: "Илгээгээгүй",
  shipped: "Замд",
  delivered: "Хүргэсэн",
  cancelled: "Цуцалсан",
};

/** The order page's large title. A new COD order is ready like a paid one. */
export const headlineText: Record<OrderStatus, string> = {
  new: "Төлбөр хүлээж байна",
  paid: "Илгээхэд бэлэн",
  shipped: "Замд",
  delivered: "Хүргэгдсэн",
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

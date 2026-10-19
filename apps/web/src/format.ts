// Mongolia keeps UTC+8 all year. The Worker renders in UTC, so every date
// shown to mom goes through this zone.
const zone = "Asia/Ulaanbaatar";

const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: zone });

const clockOf = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone,
  hour: "2-digit",
  minute: "2-digit",
});

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** 155000 → "155,000₮" */
export const money = (amount: number) => `${amount.toLocaleString("en-US")}₮`;

/** "88551290" → "8855 1290" */
export const phone = (digits: string) => digits.replace(/^(\d{4})(\d{4})$/u, "$1 $2");

const day = (date: Date) => {
  const [year = 0, month = 1, dayOfMonth = 1] = dayOf.format(date).split("-").map(Number);

  return { month, dayOfMonth, utc: Date.UTC(year, month - 1, dayOfMonth) };
};

const DAY_MS = 86_400_000;

/** Today's orders show the time, yesterday's say so, older ones the date. */
export const when = (date: Date, now: Date) => {
  const gap = (day(now).utc - day(date).utc) / DAY_MS;

  if (gap === 0) return clockOf.format(date);

  if (gap === 1) return "Өчигдөр";

  const { month, dayOfMonth } = day(date);

  return `${month}/${dayOfMonth}`;
};

/** "Бямба, 10-р сарын 18" */
export const longDate = (date: Date) => {
  const { month, dayOfMonth, utc } = day(date);

  return `${WEEKDAYS[new Date(utc).getUTCDay()]}, ${month}-р сарын ${dayOfMonth}`;
};

export const clock = (date: Date) => clockOf.format(date);

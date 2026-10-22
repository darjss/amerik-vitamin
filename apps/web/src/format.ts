import { IMAGE_HOST } from "@amerik/contracts";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";

// Mongolia keeps UTC+8 all year. The Worker renders in UTC, so every date
// shown to mom goes through this zone.
const zone = "Asia/Ulaanbaatar";

export const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone,
  hour: "2-digit",
  minute: "2-digit",
});

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** 155000 → "155,000" */
export const thousands = (amount: number) => amount.toLocaleString("en-US");

/** 155000 → "155,000₮" */
export const money = (amount: number) => `${thousands(amount)}₮`;

const imageOrigin = `https://${IMAGE_HOST}/`;

/**
 * A photo resized by Cloudflare at the photo domain's edge, as AVIF or WebP
 * where the phone takes it: a 1500px bottle is ~75 KB, a 200px one ~5 KB.
 * Dev paths (`/img/...`) aren't on that domain and pass through whole.
 */
export const sized = (url: string, width: number) =>
  url.startsWith(imageOrigin)
    ? `${imageOrigin}cdn-cgi/image/width=${width},format=auto,quality=80/${url.slice(imageOrigin.length)}`
    : url;

/** `srcset` for a photo drawn `width` CSS pixels wide, at 1x to 3x screens. */
export const srcset = (url: string, width: number) =>
  [1, 2, 3].map((density) => `${sized(url, width * density)} ${density}x`).join(", ");

/** "88551290" → "8855 1290" */
export const phone = (digits: string) => digits.replace(/^(\d{4})(\d{4})$/u, "$1 $2");

/** "8855-1290" → "88551290" */
export const digits = (text: string) => text.replaceAll(/\D/gu, "");

export const matches = (product: { brand: string; name: string }, query: string) =>
  `${product.brand} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase());

const day = (date: Date) => {
  const parts = DateTime.toParts(DateTime.makeZonedUnsafe(date, { timeZone: zone }));

  return { ...parts, utc: Date.UTC(parts.year, parts.month - 1, parts.day) };
};

const DAY_MS = 86_400_000;

/** Calendar days in Ulaanbaatar from `date` to `now`: 0 today, 1 yesterday. */
export const daysBetween = (date: Date, now: Date) => (day(now).utc - day(date).utc) / DAY_MS;

/** Today's orders show the time, yesterday's say so, older ones the date. */
export const when = (date: Date, now: Date) => {
  const gap = daysBetween(date, now);

  if (gap === 0) return clock.format(date);

  if (gap === 1) return "Өчигдөр";

  const { month, day: dayOfMonth } = day(date);

  return `${month}/${dayOfMonth}`;
};

/** { weekday: "Бямба", date: "10-р сарын 18" } */
export const longDate = (date: Date) => {
  const { weekDay, month, day: dayOfMonth } = day(date);

  return { weekday: WEEKDAYS[weekDay], date: `${month}-р сарын ${dayOfMonth}` };
};

/** A failed write as one line for her, by error tag. */
export const failureText = (
  cause: Cause.Cause<{ readonly _tag: string }>,
  fallback = "Болсонгүй. Дахин оролдоно уу.",
) =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: () => fallback,
    onSome: (error) =>
      Match.value(error).pipe(
        Match.tag("Unauthorized", () => "Дахин нэвтэрнэ үү."),
        Match.tag("WrongOrderStatus", () => "Захиалга аль хэдийн өөрчлөгдсөн байна."),
        Match.tag("RpcClientError", () => "Интернэт тасарсан. Дахин оролдоно уу."),
        Match.orElse(() => fallback),
      ),
  });

/** The write never reached the API, so a reload right now would fail the same way. */
export const offline = (cause: Cause.Cause<{ readonly _tag: string }>) =>
  Option.exists(Cause.findErrorOption(cause), Predicate.isTagged("RpcClientError"));

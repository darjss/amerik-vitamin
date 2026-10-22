import { LOW_STOCK } from "@amerik/contracts";
import { createSignal, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { Sheet } from "./chrome";
import { money, thousands } from "./format";
import { act, button, Failed, field, round, Segmented, sub, wide } from "./ui";

// Pieces the products list and the product page share: stock wording and the number sheets.

/** Null until the first count or receipt. */
export const stockText = (stock: number | null) => {
  if (stock === null) return "Тоолоогүй";

  return stock === 0 ? "Дууссан" : `${stock}`;
};

/** Sold out is red, running out is amber, unknown is grey. */
export const stockTone = (stock: number | null) => {
  if (stock === null) return "neutral" as const;

  if (stock <= 0) return "owes" as const;

  return stock <= LOW_STOCK ? ("wait" as const) : undefined;
};

/** The stock number as a button: teal when fine, then amber, red and grey by tone. */
export const stockButton = (stock: number | null) => {
  const tone = stockTone(stock);

  if (tone === "owes") return css.raw({ bg: "owesBg", color: "owes", boxShadow: "none" });

  if (tone === "wait") return css.raw({ bg: "waitBg", color: "wait", boxShadow: "none" });

  if (tone === "neutral") return css.raw({ bg: "chip", color: "inkMuted", boxShadow: "none" });

  return css.raw({ bg: "selSoft", color: "sel", boxShadow: "none" });
};

const digits = (text: string) => Number(text.replaceAll(/\D/gu, ""));

/** Prices move in steps of 5,000₮. */
const PRICE_STEP = 5000;

const bigNumber = css.raw(field, {
  flex: 1,
  textAlign: "center",
  fontSize: "30px",
  fontWeight: "700",
  fontVariantNumeric: "tabular-nums",
});

const stepButton = css.raw(round, { width: "56px", height: "56px", fontSize: "22px" });

type Form = { prompt: string; busy: boolean; failed: string | undefined };

type SheetFrame = { open: boolean; title: string; onClose: () => void };

type StepperProps = Form & { start: number; min: number; onSave: (value: number) => void };

type PriceProps = Form & { price: number; onSave: (price: number) => void };

/** − number +, for a count (from 0) or a shipment (from 1). Opens fresh at `start` each time. */
export function StepperSheet(props: SheetFrame & StepperProps) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <Show when={props.open}>
        <Stepper {...props} />
      </Show>
    </Sheet>
  );
}

type StockMode = "count" | "receive";

/**
 * The list's stock button: one sheet, two jobs. Тоолсон sets what's on the
 * shelf, Ирсэн adds a shipment. Switching resets the number for that job.
 */
export function StockSheet(props: {
  product: { name: string; brand: string; count: number; stock: number | null } | undefined;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
  onCount: (counted: number) => void;
  onReceive: (received: number) => void;
}) {
  const [mode, setMode] = createSignal<StockMode>("count");

  return (
    <Sheet
      open={props.product !== undefined}
      title={props.product?.name ?? ""}
      onClose={() => {
        setMode("count");
        props.onClose();
      }}
    >
      <Show when={props.product}>
        {(product) => (
          <>
            <div class={css({ pb: "16px", mt: "-6px" })}>
              <Segmented
                options={[
                  ["count", "Тоолсон"],
                  ["receive", "Ирсэн"],
                ]}
                value={mode()}
                onChange={setMode}
              />
            </div>
            <Show when={mode()} keyed>
              {(current) => (
                <Stepper
                  prompt={
                    current === "count"
                      ? `${product().brand} · ${product().count} ш. Тавиур дээр хэд байна?`
                      : `Хэдэн ширхэг ирсэн бэ? Одоо ${stockText(product().stock)}.`
                  }
                  start={current === "count" ? (product().stock ?? 0) : 1}
                  min={current === "count" ? 0 : 1}
                  busy={props.busy}
                  failed={props.failed}
                  onSave={current === "count" ? props.onCount : props.onReceive}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </Sheet>
  );
}

function Stepper(props: StepperProps) {
  const [value, setValue] = createSignal(untrack(() => props.start));

  return (
    <>
      <p class={css(sub, { pb: "18px", mt: "-10px" })}>{props.prompt}</p>
      <div class={css({ display: "flex", alignItems: "center", gap: "12px", pb: "20px" })}>
        <button
          type="button"
          aria-label="Хасах"
          disabled={value() <= props.min}
          onClick={() => setValue((current) => Math.max(props.min, current - 1))}
          class={css(stepButton)}
        >
          <MinusIcon />
        </button>
        <input
          inputmode="numeric"
          value={value()}
          onInput={(event) => setValue(digits(event.currentTarget.value))}
          class={css(bigNumber)}
        />
        <button
          type="button"
          aria-label="Нэмэх"
          onClick={() => setValue((current) => current + 1)}
          class={css(stepButton)}
        >
          <PlusIcon />
        </button>
      </div>
      <Failed text={props.failed} />
      <button
        type="button"
        disabled={props.busy || value() < props.min}
        onClick={() => props.onSave(value())}
        class={css(button, act, wide)}
      >
        Хадгалах
      </button>
    </>
  );
}

/** A new shelf price, typed with thousands separators. */
export function PriceSheet(props: SheetFrame & PriceProps) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <Show when={props.open}>
        <PriceInput {...props} />
      </Show>
    </Sheet>
  );
}

function PriceInput(props: PriceProps) {
  const [price, setPrice] = createSignal(untrack(() => props.price));

  return (
    <>
      <p class={css(sub, { pb: "18px", mt: "-10px" })}>{props.prompt}</p>
      <div class={css({ display: "flex", alignItems: "center", gap: "12px", pb: "20px" })}>
        <button
          type="button"
          aria-label={`${thousands(PRICE_STEP)}₮ хасах`}
          disabled={price() <= PRICE_STEP}
          onClick={() => setPrice((current) => Math.max(PRICE_STEP, current - PRICE_STEP))}
          class={css(stepButton)}
        >
          <MinusIcon />
        </button>
        <input
          inputmode="numeric"
          aria-label="Үнэ"
          value={price() === 0 ? "" : `${thousands(price())}₮`}
          onInput={(event) => setPrice(digits(event.currentTarget.value))}
          class={css(bigNumber, { minWidth: 0 })}
        />
        <button
          type="button"
          aria-label={`${thousands(PRICE_STEP)}₮ нэмэх`}
          onClick={() => setPrice((current) => current + PRICE_STEP)}
          class={css(stepButton)}
        >
          <PlusIcon />
        </button>
      </div>
      <Failed text={props.failed} />
      <button
        type="button"
        disabled={props.busy || price() <= 0 || price() === props.price}
        onClick={() => props.onSave(price())}
        class={css(button, act, wide)}
      >
        {price() > 0 ? `${money(price())} болгох` : "Хадгалах"}
      </button>
    </>
  );
}

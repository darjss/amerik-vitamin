import type { StockLevel } from "@amerik/contracts";
import { createSignal, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { digits, money, thousands } from "./format";
import { field, round, SaveButton, Segmented, Sheet, sheetPrompt } from "./ui";
import type { Tone } from "./ui";

// Pieces the products list and the product page share: stock wording and the number sheets.

/** Null until the first count or receipt. */
export const stockText = (stock: number | null) => {
  if (stock === null) return "Тоолоогүй";

  return stock === 0 ? "Дууссан" : `${stock}`;
};

/** Sold out is red, running out amber, never counted grey, the rest teal. */
export const stockTone: Record<StockLevel, Tone> = {
  out: "owes",
  low: "wait",
  unknown: "neutral",
  ok: "soft",
};

const PRICE_STEP = 5000;

const bigNumber = css.raw(field, {
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  fontSize: "30px",
  fontWeight: "700",
  fontVariantNumeric: "tabular-nums",
});

const plusMinus = css.raw(round, { width: "56px", height: "56px", fontSize: "22px" });

type NumberProps = {
  start: number;
  /** A price steps by 5,000₮ from 5,000₮, shows as money, and saves only when changed. */
  price?: boolean;
  min?: number;
  busy: boolean;
  failed: string | undefined;
  onSave: (value: number) => void;
};

/** − number +, opened fresh at `start` each time: a count, a shipment or a price. */
export function NumberSheet(
  props: NumberProps & { open: boolean; title: string; prompt: string; onClose: () => void },
) {
  return (
    <Sheet open={props.open} title={props.title} prompt={props.prompt} onClose={props.onClose}>
      <Show when={props.open}>
        <NumberInput {...props} />
      </Show>
    </Sheet>
  );
}

export type StockMode = "count" | "receive";

type StockProps = {
  busy: boolean;
  failed: string | undefined;
  onCount: (counted: number) => void;
  onReceive: (received: number) => void;
};

type StockProduct = { name: string; brand: string; count: number; stock: number | null };

/**
 * The list's stock button: one sheet, two jobs. Тоолсон sets what's on the
 * shelf, Ирсэн adds a shipment. Switching resets the number for that job.
 */
export function StockSheet(
  props: StockProps & {
    product: StockProduct | undefined;
    /** Which job the sheet opens on. */
    mode: StockMode;
    onClose: () => void;
  },
) {
  return (
    <Sheet
      open={props.product !== undefined}
      title={props.product?.name ?? ""}
      onClose={props.onClose}
    >
      <Show when={props.product} keyed>
        {(product) => <StockBody {...props} product={product} />}
      </Show>
    </Sheet>
  );
}

function StockBody(props: StockProps & { product: StockProduct; mode: StockMode }) {
  const [mode, setMode] = createSignal(untrack(() => props.mode));

  return (
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
          <>
            <p class={css(sheetPrompt)}>
              {current === "count"
                ? `${props.product.brand} · ${props.product.count} ш. Тавиур дээр хэд байна?`
                : `Хэдэн ширхэг ирсэн бэ? Одоо ${stockText(props.product.stock)}.`}
            </p>
            <NumberInput
              start={current === "count" ? (props.product.stock ?? 0) : 1}
              min={current === "count" ? 0 : 1}
              busy={props.busy}
              failed={props.failed}
              onSave={current === "count" ? props.onCount : props.onReceive}
            />
          </>
        )}
      </Show>
    </>
  );
}

function NumberInput(props: NumberProps) {
  const [value, setValue] = createSignal(untrack(() => props.start));
  const step = () => (props.price ? PRICE_STEP : 1);
  const min = () => props.min ?? step();

  return (
    <>
      <div class={css({ display: "flex", alignItems: "center", gap: "12px", pb: "20px" })}>
        <button
          type="button"
          aria-label={props.price ? `${thousands(PRICE_STEP)}₮ хасах` : "Хасах"}
          disabled={value() <= min()}
          onClick={() => setValue((current) => Math.max(min(), current - step()))}
          class={css(plusMinus)}
        >
          <MinusIcon />
        </button>
        <input
          inputmode="numeric"
          aria-label={props.price ? "Үнэ" : undefined}
          value={props.price ? (value() === 0 ? "" : `${thousands(value())}₮`) : value()}
          onInput={(event) => setValue(Number(digits(event.currentTarget.value)))}
          class={css(bigNumber)}
        />
        <button
          type="button"
          aria-label={props.price ? `${thousands(PRICE_STEP)}₮ нэмэх` : "Нэмэх"}
          onClick={() => setValue((current) => current + step())}
          class={css(plusMinus)}
        >
          <PlusIcon />
        </button>
      </div>
      <SaveButton
        failed={props.failed}
        disabled={
          props.busy || value() < min() || (props.price === true && value() === props.start)
        }
        onClick={() => props.onSave(value())}
      >
        {props.price && value() > 0 ? `${money(value())} болгох` : "Хадгалах"}
      </SaveButton>
    </>
  );
}

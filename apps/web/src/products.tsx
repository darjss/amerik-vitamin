import type { ProductLabel, StockLevel } from "@amerik/contracts";
import { createSignal, For, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { digits, money, thousands } from "./format";
import { round } from "./styles";
import { field, SaveButton, Segmented, Sheet, sheetPrompt, sub } from "./ui";
import type { Tone } from "./ui";

/** Null until the first count or receipt. */
export const stockText = (stock: number | null) => {
  if (stock === null) return "Тоолоогүй";

  return stock === 0 ? "Дууссан" : `${stock} ш`;
};

export const stockTone: Record<StockLevel, Tone> = {
  out: "owe",
  low: "wait",
  unknown: "neutral",
  ok: "ok",
};

const PRICE_STEP = 5000;

const number = css.raw(field, {
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  fontWeight: "700",
  fontVariantNumeric: "tabular-nums",
});

// A sheet's stepper is big; a row's is the height of the row's buttons.
const stepperSizes = {
  lg: {
    gap: css.raw({ gap: "12px" }),
    button: css.raw(round.raw(), { width: "56px", height: "56px", fontSize: "22px" }),
    number: css.raw(number, { fontSize: "30px" }),
  },
  sm: {
    gap: css.raw({ gap: "6px" }),
    button: css.raw(round.raw(), { width: "36px", height: "36px", fontSize: "16px" }),
    number: css.raw(number, { height: "36px", py: 0, px: "4px", borderRadius: "10px" }),
  },
};

/** − number +. A price steps by 5,000₮ and shows as money; the − stops at `min`. */
export function Stepper(props: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  price?: boolean;
  size: keyof typeof stepperSizes;
  label: string;
}) {
  const step = () => (props.price ? PRICE_STEP : 1);
  const size = () => stepperSizes[props.size];

  return (
    <div class={css({ display: "flex", alignItems: "center" }, size().gap)}>
      <button
        type="button"
        aria-label={props.price ? `${thousands(PRICE_STEP)}₮ хасах` : "Хасах"}
        disabled={props.value <= props.min}
        onClick={() => props.onChange(Math.max(props.min, props.value - step()))}
        class={css(size().button)}
      >
        <MinusIcon />
      </button>
      <input
        inputmode="numeric"
        aria-label={props.label}
        value={props.price ? (props.value === 0 ? "" : `${thousands(props.value)}₮`) : props.value}
        onInput={(event) => props.onChange(Number(digits(event.currentTarget.value)))}
        class={css(size().number)}
      />
      <button
        type="button"
        aria-label={props.price ? `${thousands(PRICE_STEP)}₮ нэмэх` : "Нэмэх"}
        onClick={() => props.onChange(props.value + step())}
        class={css(size().button)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

type NumberProps = {
  start: number;
  /** A price steps by 5,000₮ from 5,000₮, shows as money, and saves only when changed. */
  price?: boolean;
  min?: number;
  busy: boolean;
  failed: string | undefined;
  onSave: (value: number) => void;
};

/** A count, a shipment or a price. Opens fresh at `start` each time. */
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

type StockProduct = { nameMn: string; brand: string; count: number; stock: number | null };

/**
 * The list's stock button: one sheet, two jobs. Тоолсон sets what's on the
 * shelf, Ирсэн adds a shipment. Switching resets the number for that job.
 */
export function StockSheet(
  props: StockProps & {
    product: StockProduct | undefined;
    mode: StockMode;
    onClose: () => void;
  },
) {
  return (
    <Sheet
      open={props.product !== undefined}
      title={props.product?.nameMn ?? ""}
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

  return (
    <>
      <div class={css({ pb: "20px" })}>
        <Stepper
          value={value()}
          onChange={setValue}
          min={props.min ?? (props.price ? PRICE_STEP : 1)}
          price={props.price}
          size="lg"
          label={props.price ? "Үнэ" : "Тоо"}
        />
      </div>
      <SaveButton
        failed={props.failed}
        disabled={
          // The stepper floors a price at 5,000₮, but any typed price above 0 saves.
          props.busy ||
          value() < (props.min ?? 1) ||
          (props.price === true && value() === props.start)
        }
        onClick={() => props.onSave(value())}
      >
        {props.price && value() > 0 ? `${money(value())} болгох` : "Хадгалах"}
      </SaveButton>
    </>
  );
}

const cell = css.raw({ py: "7px", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap" });

/** The Supplement Facts table as printed, in English. Shared by the product page and the draft. */
export function FactsTable(props: { label: ProductLabel }) {
  return (
    <div class={css({ display: "grid", gap: "6px" })}>
      <p class={css(sub)}>Нэг удаагийн хэмжээ: {props.label.servingSize}</p>
      <Show when={props.label.facts.length > 0}>
        <table
          class={css({
            width: "100%",
            borderCollapse: "collapse",
            textStyle: "body",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          <thead class={css(sub, { textStyle: "footnote" })}>
            <tr>
              <th class={css({ textAlign: "left", fontWeight: "inherit" })} />
              <th class={css(cell, { fontWeight: "inherit" })}>Хэмжээ</th>
              <th class={css(cell, { fontWeight: "inherit", pl: "12px" })}>%DV</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.label.facts} keyed={false}>
              {(fact) => (
                <tr>
                  <td class={css({ py: "7px", pr: "12px" })}>{fact().name}</td>
                  <td class={css(cell, { fontWeight: "600" })}>{fact().amount}</td>
                  <td class={css(cell, { pl: "12px", color: "inkMuted" })}>
                    {fact().dailyValue ?? ""}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={props.label.facts.some((fact) => fact.dailyValue?.includes("†"))}>
          <p class={css(sub, { textStyle: "footnote" })}>† Өдрийн хэрэгцээ тогтоогоогүй</p>
        </Show>
      </Show>
    </div>
  );
}

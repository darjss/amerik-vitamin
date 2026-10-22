import { LOW_STOCK } from "@amerik/contracts";
import { createSignal, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { Sheet } from "./chrome";
import { money, thousands } from "./format";
import { act, button, Failed, field, round, sub, wide } from "./ui";

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

const digits = (text: string) => Number(text.replaceAll(/\D/gu, ""));

const bigNumber = css.raw(field, {
  flex: 1,
  textAlign: "center",
  fontSize: "30px",
  fontWeight: "700",
  fontVariantNumeric: "tabular-nums",
});

const stepButton = css.raw(round, { width: "56px", height: "56px", fontSize: "22px" });

type NumberSheetProps = {
  open: boolean;
  title: string;
  prompt: string;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
};

/** − number +, for a count (from 0) or a shipment (from 1). Opens fresh at `start` each time. */
export function StepperSheet(
  props: NumberSheetProps & { start: number; min: number; onSave: (value: number) => void },
) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <Show when={props.open}>
        <Stepper {...props} />
      </Show>
    </Sheet>
  );
}

function Stepper(
  props: NumberSheetProps & { start: number; min: number; onSave: (value: number) => void },
) {
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
export function PriceSheet(
  props: NumberSheetProps & { price: number; onSave: (price: number) => void },
) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <Show when={props.open}>
        <PriceInput {...props} />
      </Show>
    </Sheet>
  );
}

function PriceInput(props: NumberSheetProps & { price: number; onSave: (price: number) => void }) {
  const [price, setPrice] = createSignal(untrack(() => props.price));

  return (
    <>
      <p class={css(sub, { pb: "18px", mt: "-10px" })}>{props.prompt}</p>
      <label class={css({ display: "flex", alignItems: "center", gap: "8px", pb: "20px" })}>
        <input
          inputmode="numeric"
          aria-label="Үнэ"
          value={price() === 0 ? "" : thousands(price())}
          onInput={(event) => setPrice(digits(event.currentTarget.value))}
          class={css(bigNumber)}
        />
        <span class={css({ fontSize: "30px", fontWeight: "700" })}>₮</span>
      </label>
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

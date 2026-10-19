import { createContext, createEffect, createSignal, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { css } from "styled-system/css";

export type Product = { image: string | null; name: string; brand: string; count: number };

/** Shows a product photo full size. Look-alike bottles are told apart there. */
export const Zoom = createContext<(product: Product) => void>();

/** One full-screen photo for the whole app. A native dialog: Escape and a tap close it. */
export function ZoomProvider(props: { children: JSX.Element }) {
  const [shown, setShown] = createSignal<Product>();
  let dialog: HTMLDialogElement | undefined;

  createEffect(
    () => shown(),
    (product) => {
      if (product === undefined) dialog?.close();
      else dialog?.showModal();
    },
  );

  return (
    <Zoom value={setShown}>
      {props.children}
      <dialog
        ref={(element) => {
          dialog = element;
        }}
        onClose={() => setShown(undefined)}
        onClick={() => dialog?.close()}
        class={css({
          m: "auto",
          width: "100vw",
          maxWidth: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          bg: "surface",
          border: "none",
          p: "24px",
          "&[open]": { display: "grid", placeContent: "center", gap: "16px", textAlign: "center" },
          "&::backdrop": { bg: "rgba(42, 29, 22, 0.4)" },
        })}
      >
        <Show when={shown()}>
          {(product) => (
            <>
              <Show when={product().image}>
                {(src) => (
                  <img
                    src={src()}
                    alt={`${product().brand} ${product().name}`}
                    class={css({ width: "100%", maxHeight: "60dvh", objectFit: "contain" })}
                  />
                )}
              </Show>
              <b class={css({ fontSize: "22px", lineHeight: "28px", fontWeight: "700" })}>
                {product().name}
              </b>
              <span class={css({ color: "inkMuted", fontSize: "17px" })}>
                {product().brand} · {product().count} ш
              </span>
            </>
          )}
        </Show>
      </dialog>
    </Zoom>
  );
}

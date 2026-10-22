import { createContext, createSignal, Show, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { css } from "styled-system/css";

import { sized, srcset } from "./format";

type Product = { image: string | null; name: string; brand: string; count: number };

/** Shows a product photo full size. Look-alike bottles are told apart there. */
export const Zoom = createContext<(product: Product) => void>();

/** One full-screen photo for the whole app. A native dialog: Escape and a tap close it. */
export function ZoomProvider(props: { children: JSX.Element }) {
  const [shown, setShown] = createSignal<Product>();
  let dialog: HTMLDialogElement | undefined;

  const show = (product: Product) => {
    setShown(product);
    dialog?.showModal();
  };

  return (
    <Zoom value={show}>
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
          "&::backdrop": { bg: "scrim" },
        })}
      >
        <Show when={shown()}>
          {(product) => (
            <>
              <Show when={product().image}>
                {(src) => (
                  <img
                    src={sized(src(), 1200)}
                    srcset={srcset(src(), 400)}
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

const tileBase = css.raw({
  position: "relative",
  display: "block",
  flex: "none",
  bg: "white",
  boxShadow: "raiseSm",
  "& img": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    p: "9%",
  },
});

const rings = {
  page: css.raw({ boxShadow: "0 0 0 2.5px {colors.page}" }),
  surface: css.raw({ boxShadow: "0 0 0 2.5px {colors.surface}" }),
};

/**
 * A product photo as a raised white tile, with ×N as a teal badge on its
 * corner. A tap shows it full size unless `still`; sizes are inline styles
 * because Panda only builds classes for values written in a css() call.
 */
export function Tile(props: {
  product: Product;
  size?: number;
  quantity?: number;
  soft?: boolean;
  ring?: keyof typeof rings;
  still?: boolean;
}) {
  const zoom = useContext(Zoom);

  const box = () => {
    const radius = props.size === undefined || props.size >= 100 ? 20 : props.size >= 60 ? 17 : 14;

    return props.size === undefined
      ? { width: "100%", "aspect-ratio": "1", "border-radius": `${radius}px` }
      : { width: `${props.size}px`, height: `${props.size}px`, "border-radius": `${radius}px` };
  };

  const inside = () => (
    <>
      <Show when={props.product.image}>
        {(src) => (
          // A tile without a size fills a grid cell, about 120px on her phone.
          <img
            src={sized(src(), (props.size ?? 120) * 2)}
            srcset={srcset(src(), props.size ?? 120)}
            alt={`${props.product.brand} ${props.product.name}`}
            loading="lazy"
            decoding="async"
          />
        )}
      </Show>
      <Show when={props.quantity}>
        {(quantity) => (
          <b
            class={css(
              {
                position: "absolute",
                zIndex: 2,
                top: "-7px",
                right: "-7px",
                minWidth: "28px",
                height: "28px",
                px: "7px",
                borderRadius: "14px",
                bg: "sel",
                color: "white",
                fontSize: "15px",
                fontWeight: "700",
                display: "grid",
                placeItems: "center",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              },
              rings[props.ring ?? "page"],
              props.soft && { bg: "selSoft", color: "sel" },
            )}
          >
            ×{quantity()}
          </b>
        )}
      </Show>
    </>
  );

  return (
    <Show
      when={!props.still && props.product.image}
      fallback={
        <span class={css(tileBase)} style={box()}>
          {inside()}
        </span>
      }
    >
      <button
        type="button"
        aria-label={`${props.product.name} томоор харах`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          zoom(props.product);
        }}
        class={css(tileBase, { zIndex: 1, cursor: "zoom-in" })}
        style={box()}
      >
        {inside()}
      </button>
    </Show>
  );
}

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
          bg: "white",
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
              <b class={css({ textStyle: "headline" })}>{product().name}</b>
              <span class={css({ textStyle: "body", color: "inkMuted" })}>
                {product().brand} · {product().count} ш
              </span>
            </>
          )}
        </Show>
      </dialog>
    </Zoom>
  );
}

// The photos are shot on white, so the tile is white with no frame or tint:
// on a white section the bottle stands bare.
const tileBase = css.raw({
  position: "relative",
  display: "block",
  flex: "none",
  bg: "white",
  borderRadius: "6px",
  "& img": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "6px",
  },
});

/** The ring around ×N matches what's behind the tile. */
const rings = {
  page: css.raw({ boxShadow: "0 0 0 2px {colors.page}" }),
  card: css.raw({ boxShadow: "0 0 0 2px {colors.card}" }),
};

/**
 * A product photo on white, with ×N as an ink badge on its corner. A tap
 * shows it full size unless `still`; sizes are inline styles because Panda
 * only builds classes for values written in a css() call.
 */
export function Tile(props: {
  product: Product;
  size?: number;
  quantity?: number;
  ring?: keyof typeof rings;
  still?: boolean;
}) {
  const zoom = useContext(Zoom);

  const box = () =>
    props.size === undefined
      ? { width: "100%", "aspect-ratio": "1" }
      : { width: `${props.size}px`, height: `${props.size}px` };

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
                top: "-5px",
                right: "-7px",
                minWidth: "22px",
                height: "20px",
                px: "5px",
                borderRadius: "10px",
                bg: "ink",
                color: "page",
                fontSize: "12px",
                lineHeight: "20px",
                fontWeight: "700",
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              },
              rings[props.ring ?? "page"],
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

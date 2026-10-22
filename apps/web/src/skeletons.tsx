import { Repeat, Show } from "solid-js";
import { css } from "styled-system/css";

import { panel } from "./ui";

// Loading fallbacks shaped like the page that's coming: grey bones with a
// slow light sweep. They fade in after a beat, so a fast load never flashes
// one, and the content that replaces them fades in too (`appear` in ui.tsx).

const bone = css.raw({
  display: "block",
  flex: "none",
  borderRadius: "10px",
  backgroundImage:
    "linear-gradient(90deg, {colors.chip} 30%, {colors.surface} 50%, {colors.chip} 70%)",
  // Fixed to the viewport, so one light sweeps across every bone together.
  backgroundAttachment: "fixed",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
  _motionReduce: { animation: "none" },
});

/** The whole skeleton waits 150ms before showing, then fades in. */
const delayed = css.raw({
  animation: "appear .3s ease-out .15s both",
  _motionReduce: { animation: "none" },
});

/** One grey shape; sizes are inline because they vary per use. */
function Bone(props: { width: string; height: string; round?: boolean }) {
  return (
    <span
      class={css(bone)}
      style={{
        width: props.width,
        height: props.height,
        "border-radius": props.round ? "999px" : undefined,
      }}
    />
  );
}

/** A photo row: tile, name lines, a chip, and the button on the right. */
function Row(props: { tile: number }) {
  return (
    <div class={css({ display: "flex", alignItems: "center", gap: "14px", py: "8px" })}>
      <span
        class={css(bone, { borderRadius: "17px" })}
        style={{ width: `${props.tile}px`, height: `${props.tile}px` }}
      />
      <div class={css({ flex: 1, display: "grid", gap: "7px" })}>
        <Bone width="82%" height="16px" />
        <Bone width="46%" height="13px" />
        <Bone width="84px" height="26px" round />
      </div>
      <Bone width="64px" height="44px" round />
    </div>
  );
}

/** The products and orders lists: chips, then rows. */
export function ListSkeleton(props: { rows?: number; chips?: boolean }) {
  return (
    <div class={css(delayed)} aria-busy="true">
      <Show when={props.chips ?? true}>
        <div class={css({ display: "flex", gap: "8px", px: "16px", pt: "14px" })}>
          <Bone width="76px" height="40px" round />
          <Bone width="96px" height="40px" round />
          <Bone width="120px" height="40px" round />
          <Bone width="90px" height="40px" round />
        </div>
      </Show>
      <div class={css({ display: "grid", gap: "4px", px: "16px", pt: "14px" })}>
        <Repeat count={props.rows ?? 7}>{() => <Row tile={68} />}</Repeat>
      </div>
    </div>
  );
}

/** A pushed page: the frosted bar's two round buttons, an optional photo, title, panels. */
export function DetailSkeleton(props: { photo?: boolean }) {
  return (
    <div class={css(delayed)} aria-busy="true">
      <div class={css({ display: "flex", justifyContent: "space-between", px: "14px", pt: "8px" })}>
        <Bone width="44px" height="44px" round />
        <Bone width="44px" height="44px" round />
      </div>
      <div class={css({ display: "grid", gap: "12px", px: "20px", pt: "14px" })}>
        <Show when={props.photo}>
          <span
            class={css(bone, { borderRadius: "22px", width: "min(78vw, 340px)", aspectRatio: "1" })}
          />
        </Show>
        <Bone width="72%" height="30px" />
        <Bone width="40%" height="18px" />
      </div>
      <div class={css({ display: "grid", gap: "14px", px: "16px", pt: "22px" })}>
        <span class={css(bone, { borderRadius: "22px", height: "96px" })} />
        <div class={css({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" })}>
          <Repeat count={4}>
            {() => <span class={css(bone, { borderRadius: "18px", height: "76px" })} />}
          </Repeat>
        </div>
        <span class={css(bone, { borderRadius: "22px", height: "180px" })} />
      </div>
    </div>
  );
}

/** Home: the date title, today's packing panel, then the to-do rows. */
export function HomeSkeleton() {
  return (
    <div class={css(delayed)} aria-busy="true">
      <div class={css({ px: "20px", pt: "28px" })}>
        <Bone width="70%" height="34px" />
      </div>
      <div class={css(panel, { mx: "16px", mt: "20px", p: "20px", display: "grid", gap: "14px" })}>
        <Bone width="50%" height="22px" />
        <div class={css({ display: "flex", gap: "10px" })}>
          <Repeat count={3}>
            {() => (
              <span class={css(bone, { borderRadius: "17px", width: "68px", height: "68px" })} />
            )}
          </Repeat>
        </div>
        <Bone width="100%" height="52px" round />
      </div>
      <div class={css({ display: "grid", gap: "4px", px: "16px", pt: "24px" })}>
        <Repeat count={3}>{() => <Row tile={56} />}</Repeat>
      </div>
    </div>
  );
}

/** A form: label and field pairs. */
export function FormSkeleton(props: { fields?: number }) {
  return (
    <div
      class={css(delayed, { display: "grid", gap: "16px", px: "20px", pt: "20px" })}
      aria-busy="true"
    >
      <Repeat count={props.fields ?? 5}>
        {() => (
          <div class={css({ display: "grid", gap: "8px" })}>
            <Bone width="30%" height="14px" />
            <Bone width="100%" height="48px" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

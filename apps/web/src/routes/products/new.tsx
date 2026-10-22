import { AmazonSource, DraftId, PhotoSource } from "@amerik/contracts";
import type { CatalogOptions, DraftSource } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { createMemo, createSignal, Errored, For, Loading, onSettled, Show } from "solid-js";
import { css } from "styled-system/css";
import CameraIcon from "~icons/ph/camera";
import LinkIcon from "~icons/ph/link-bold";
import PencilIcon from "~icons/ph/pencil-simple";
import SparkleIcon from "~icons/ph/sparkle";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { blank, DraftForm, input } from "../../product-form";
import { FormSkeleton } from "../../skeletons";
import {
  act,
  button,
  Failed,
  glass,
  glassBar,
  headline,
  largeTitle,
  Note,
  panel,
  Problem,
  round,
  spinner,
  sub,
  wide,
} from "../../ui";

// Шинэ бараа: an Amazon link or a bottle photo goes to the drafting Workflow
// on the API; she checks the filled-in form, adds her price and confirms.
// The run's id stays in the URL, so a reload or a lost signal comes back to it.

/** A phone photo downscaled to 1600px JPEG, as base64, so the upload stays small. */
const toJpeg = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);

  return url.slice(url.indexOf(",") + 1);
};

export default function NewProductPage() {
  const [params, setParams] = useSearchParams<{ draft?: string; manual?: string }>();
  const options = createMemo(() => runEffect(ApiClient.use((api) => api.catalogOptions())));
  const [url, setUrl] = createSignal("");
  const { write, busy, failed } = createWrite();

  const draftId = () => Option.getOrUndefined(Schema.decodeUnknownOption(DraftId)(params.draft));

  const start = (source: DraftSource) =>
    write(
      ApiClient.use((api) => api.startDraft({ source })),
      (draft) => setParams({ draft, manual: undefined }),
    );

  const pickPhoto = async (file: File | undefined) => {
    if (file === undefined) return;

    await start(PhotoSource.make({ jpeg: await toJpeg(file) }));
  };

  return (
    <main class={css({ pb: "140px" })}>
      <header class={css(glassBar, { display: "flex", alignItems: "center", gap: "10px" })}>
        <a href="/products" aria-label="Хаах" class={css(round, glass)}>
          <CloseIcon />
        </a>
        <b class={css(headline, { flex: 1, textAlign: "center" })}>Шинэ бараа</b>
        <span class={css({ width: "44px" })} />
      </header>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Show
          when={draftId()}
          keyed
          fallback={
            <Show
              when={params.manual}
              fallback={
                <div class={css({ px: "16px", pt: "8px", display: "grid", gap: "14px" })}>
                  <h1 class={css(largeTitle, { px: "4px" })}>Юунаас унших вэ?</h1>
                  <p class={css(sub, { px: "4px", mt: "-6px" })}>
                    AI Amazon-оос мэдээлэл, зураг олж, тайлбар бичээд маягтыг бөглөнө. Та шалгаад
                    үнээ оруулна.
                  </p>

                  <label
                    class={css(panel, {
                      display: "grid",
                      placeItems: "center",
                      gap: "8px",
                      py: "28px",
                      cursor: "pointer",
                      fontSize: "17px",
                      fontWeight: "650",
                      "& svg": { fontSize: "34px", color: "sel" },
                    })}
                  >
                    <CameraIcon />
                    Савны зураг авах
                    <span class={css(sub)}>Шошго нь харагдаж байвал болно</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={busy()}
                      onChange={(event) => void pickPhoto(event.currentTarget.files?.[0])}
                      class={css({ srOnly: true })}
                    />
                  </label>

                  <div class={css(panel, { p: "16px", display: "grid", gap: "12px" })}>
                    <span
                      class={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "17px",
                        fontWeight: "650",
                        "& svg": { color: "sel", fontSize: "20px" },
                      })}
                    >
                      <LinkIcon />
                      Amazon холбоос
                    </span>
                    <input
                      type="url"
                      inputmode="url"
                      placeholder="https://www.amazon.com/dp/…"
                      value={url()}
                      onInput={(event) => setUrl(event.currentTarget.value.trim())}
                      class={css(input)}
                    />
                    <button
                      type="button"
                      disabled={busy() || !/amazon\.|amzn\./iu.test(url())}
                      onClick={() => void start(AmazonSource.make({ url: url() }))}
                      class={css(button, act, wide)}
                    >
                      <SparkleIcon />
                      Унших
                    </button>
                  </div>

                  <Failed text={failed()} />

                  <button
                    type="button"
                    onClick={() => setParams({ manual: "1" })}
                    class={css(button, { justifySelf: "center" })}
                  >
                    <PencilIcon />
                    Гараар бөглөх
                  </button>
                </div>
              }
            >
              <Loading fallback={<FormSkeleton />}>
                <DraftForm initial={blank} existing={null} options={options()} />
              </Loading>
            </Show>
          }
        >
          {(id) => <DraftRun id={id} options={options()} />}
        </Show>
      </Errored>
    </main>
  );
}

/** Polls the run every 2 seconds until it's done; the wait shows as progress. */
function DraftRun(props: { id: DraftId; options: CatalogOptions }) {
  const [, setParams] = useSearchParams<{ draft?: string }>();

  const state = createMemo(() => {
    const draftId = props.id;

    return runEffect(
      ApiClient.use((api) => api.getDraft({ draftId })).pipe(
        Effect.repeat({
          schedule: Schedule.spaced("2 seconds"),
          until: (current) => !Predicate.isTagged(current, "running"),
        }),
      ),
    );
  });

  // The repeat stops only past `running`, so that case never renders.
  return (
    <Loading fallback={<Progress />}>
      {Match.valueTags(state(), {
        running: () => null,
        ready: (ready) => (
          <DraftForm initial={ready.draft} existing={ready.existing} options={props.options} />
        ),
        failed: (failure) => (
          <div class={css({ px: "16px", pt: "12px", display: "grid", gap: "14px" })}>
            <Note large>
              {failure.reason === "not_a_product_page"
                ? "Энэ холбоос Amazon-ий барааны хуудас биш байна."
                : "Уншиж чадсангүй."}
            </Note>
            <button
              type="button"
              onClick={() => setParams({ draft: undefined })}
              class={css(button, wide)}
            >
              Дахин оролдох
            </button>
          </div>
        ),
      })}
    </Loading>
  );
}

const steps = [
  "Amazon-оос хайж байна",
  "Мэдээлэл бөглөж байна",
  "Тайлбар бичиж байна",
  "Зураг шүүж байна",
];

function Progress() {
  const [seconds, setSeconds] = createSignal(0);
  onSettled(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);

    return () => clearInterval(timer);
  });

  // The run doesn't report its step, so the label walks on a rough clock.
  const step = () => Math.min(steps.length - 1, Math.floor(seconds() / 20));

  return (
    <div class={css({ px: "16px", pt: "12px" })}>
      <div class={css(panel, { p: "22px", display: "grid", gap: "16px" })}>
        <div class={css({ display: "flex", alignItems: "center", gap: "12px" })}>
          <span class={css(spinner)} />
          <b class={css(headline, { flex: 1 })}>{steps[step()]}</b>
          <span class={css(sub, { fontVariantNumeric: "tabular-nums" })}>{seconds()} сек</span>
        </div>
        <div class={css({ display: "grid", gap: "8px" })}>
          <For each={steps}>
            {(name, index) => (
              <div
                class={css(
                  { display: "flex", gap: "10px", fontSize: "15px", color: "inkMuted" },
                  index() < step() && { color: "sel" },
                  index() === step() && { color: "ink", fontWeight: "600" },
                )}
              >
                <span>{index() < step() ? "✓" : "·"}</span>
                {name}
              </div>
            )}
          </For>
        </div>
        <p class={css(sub)}>Ихэвчлэн 1 минут орчим. Энэ хуудсыг хаасан ч ажил үргэлжилнэ.</p>
      </div>
    </div>
  );
}

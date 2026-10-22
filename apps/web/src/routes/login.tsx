import { createAuthClient } from "better-auth/client";
import { createSignal, Show } from "solid-js";
import { css } from "styled-system/css";

import { button } from "../styles";
import { muted } from "../ui";

const authClient = createAuthClient();

// A Google account off the allowlist lands on better-auth's error page.
export default function Login() {
  const [failure, setFailure] = createSignal<string>();

  const signIn = async () => {
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });

    if (error !== null) setFailure(error.message ?? error.statusText);
  };

  return (
    <main
      class={css({
        minHeight: "100dvh",
        display: "grid",
        placeContent: "center",
        gap: "20px",
        px: "24px",
        textAlign: "center",
      })}
    >
      <h1 class={css({ textStyle: "largeTitle" })}>Америк Хүнс Бараа</h1>
      <button
        type="button"
        onClick={signIn}
        class={css(button.raw({ tone: "ink", size: "lg" }), { px: "32px" })}
      >
        Google-ээр нэвтрэх
      </button>
      <Show when={failure()}>{(message) => <p class={css(muted)}>{message()}</p>}</Show>
    </main>
  );
}

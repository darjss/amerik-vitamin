import { createAuthClient } from "better-auth/client";
import { createSignal, Show } from "solid-js";
import { css, cx } from "styled-system/css";

import { button, darkButton, muted } from "../ui";

// A Google account off the allowlist lands on better-auth's error page.
export default function Login() {
  const [failure, setFailure] = createSignal<string>();

  const signIn = async () => {
    const { error } = await createAuthClient().signIn.social({
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
      <h1
        class={css({
          fontSize: "26px",
          lineHeight: "32px",
          fontWeight: "700",
          letterSpacing: "-0.4px",
        })}
      >
        Америк Хүнс Бараа
      </h1>
      <button
        type="button"
        onClick={signIn}
        class={cx(
          button,
          darkButton,
          css({ height: "50px", borderRadius: "14px", fontSize: "16px", px: "28px" }),
        )}
      >
        Google-ээр нэвтрэх
      </button>
      <Show when={failure()}>{(message) => <p class={muted}>{message()}</p>}</Show>
    </main>
  );
}

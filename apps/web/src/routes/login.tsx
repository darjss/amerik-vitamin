import { createAuthClient } from "better-auth/client";
import { createSignal, Show } from "solid-js";

// Bare sign-in until the dashboard UI is decided. After Google, the browser
// lands on the session JSON; a refused account lands on better-auth's error page.
export default function Login() {
  const [failure, setFailure] = createSignal<string>();

  const signIn = async () => {
    const { error } = await createAuthClient().signIn.social({
      provider: "google",
      callbackURL: "/api/auth/get-session",
    });

    if (error !== null) setFailure(error.message ?? error.statusText);
  };

  return (
    <main>
      <button type="button" onClick={signIn}>
        Google-ээр нэвтрэх
      </button>
      <Show when={failure()}>{(message) => <p>{message()}</p>}</Show>
    </main>
  );
}

import { createMemo } from "solid-js";

import { ApiClient } from "../api/client";
import { runEffect } from "../api/solid-effect";

export default function Home() {
  const health = createMemo(() => runEffect(ApiClient.use((api) => api.health())));
  return (
    <main>
      <h1>amerik-vitamin</h1>
      <p>database: {health().database}</p>
    </main>
  );
}

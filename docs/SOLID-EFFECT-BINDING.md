# Solid and Effect

Read this when changing `apps/web/src/api/solid-effect.ts` or adding an Effect read to a component.

- Provide `RuntimeContext` with `createRuntime(layer)` inside a Solid owner. Missing providers throw. Owner cleanup disposes the runtime.
- Call `runEffect` inside a component or computation. It reads the provider and returns an async iterable that starts one fiber per iterator.
- Return that iterable from `createMemo`. Solid owns pending, value and error state through `Loading` and `Errored`.
- On a superseded or disposed read, Solid closes the iterator. The adapter interrupts the fiber and waits for its finalizers in `return()`. Solid does not await that promise, so replacement reads can overlap cleanup.
- A closed iterator cannot publish a stale result. Pure interruption ends iteration; other active-read failures throw into Solid's error boundary.
- Use this adapter for reads. UI disposal must never abort a write that has started. Writes belong in actions and the server.
- Browser reads use `WebLayer`, which posts to `/rpc`. SSR reads use `serverLayer`, which calls the API service binding. `start.renderMode` is `async` in `apps/web/vite.config.ts`, so the HTML waits for these reads.

Writes go through `createWrite({ source, fallback })` in the same file. `write(effect, done)` is an action: `busy` is a `createOptimistic(false)` flag for its run, and a failure sets `failed` to `failureText`. Success calls `done` with the value. Either way `source` refreshes, unless the cause is `offline`, because that reload would fail too. A page or sheet with a write uses it rather than its own action.

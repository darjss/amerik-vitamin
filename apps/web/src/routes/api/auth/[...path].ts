import type { APIEvent } from "filesystem-routing/api";

// Sign-in runs on the API worker. Forwarding it from here keeps the session
// cookie and Google's redirect on the web origin, the one the browser sees.
const forward = async (event: APIEvent) => {
  const { env } = await import("cloudflare:workers");

  return await env.API.fetch(event.request);
};

export const GET = forward;

export const POST = forward;

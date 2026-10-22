import type { APIEvent } from "filesystem-routing/api";

// Dev photo URLs are `/img/<key>` paths, served from the API worker's bucket
// binding (apps/api/infra/images.ts). Production photos live on their own domain.
export const GET = async (event: APIEvent) => {
  const { env } = await import("cloudflare:workers");

  return await env.API.fetch(event.request);
};

import routes from "virtual:file-routes";
import type { RequestEvent } from "@solidjs/web";
import { createAPIHandler } from "filesystem-routing/api";

const api = createAPIHandler(routes);

// Nothing on v2.amerikvitamin.mn is indexed before the relaunch (RELAUNCH.md).
// A copy, because a response passed through from fetch has immutable headers.
const noindex = async (_event: RequestEvent, next: () => Promise<Response>) => {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

// @solidjs/vite-plugin next.48+ calls middleware as (event, next), while
// filesystem-routing 0.4.0 still takes the bare request.
export default [
  noindex,
  (event: RequestEvent, next: () => Promise<Response>) => api(event.request, next),
];

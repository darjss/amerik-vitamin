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

const dashboardPages = /^\/(?:(?:orders|products)(?:\/.*)?|pack)?$/u;

const sessionCookie = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/u;

// Dashboard pages without a session cookie go to sign-in. The API checks the
// session itself on every rpc, so this only spares her an error screen.
const signedIn = async (event: RequestEvent, next: () => Promise<Response>) => {
  const { pathname } = new URL(event.request.url);
  const cookie = event.request.headers.get("cookie") ?? "";

  if (dashboardPages.test(pathname) && !sessionCookie.test(cookie)) {
    return Response.redirect(new URL("/login", event.request.url), 302);
  }

  return await next();
};

// @solidjs/vite-plugin next.48+ calls middleware as (event, next), while
// filesystem-routing 0.4.0 still takes the bare request.
export default [
  noindex,
  signedIn,
  (event: RequestEvent, next: () => Promise<Response>) => api(event.request, next),
];

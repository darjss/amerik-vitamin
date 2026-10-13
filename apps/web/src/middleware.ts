import routes from "virtual:file-routes";
import type { RequestEvent } from "@solidjs/web";
import { createAPIHandler } from "filesystem-routing/api";

const api = createAPIHandler(routes);

// @solidjs/vite-plugin next.48+ calls middleware as (event, next), while
// filesystem-routing 0.4.0 still takes the bare request.
export default [(event: RequestEvent, next: () => Promise<Response>) => api(event.request, next)];

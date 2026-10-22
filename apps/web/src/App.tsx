import { isServer } from "@solidjs/web";
import { createRouter, intentPreload } from "@solidjs/router";
import { fileRoutes } from "@solidjs/router/fs";
import { pageRoutes } from "virtual:file-routes";
import { Loading } from "solid-js";

import { serverLayer } from "./api/binding";
import { WebLayer } from "./api/client";
import { createRuntime, RuntimeContext } from "./api/solid-effect";
import { createHeldSteps, HeldSteps } from "./orders";
import { ZoomProvider } from "./zoom";

import "@fontsource-variable/inter/opsz.css";
import "./app.css";

// Pages are separate chunks. A touch, hover or focus on a link fetches the
// chunk before the tap lands, so a first visit doesn't wait on code, then data.
const Router = createRouter({ routes: fileRoutes(pageRoutes), preloadLinks: intentPreload() });

export default function App() {
  return (
    <RuntimeContext value={createRuntime(isServer ? serverLayer : WebLayer)}>
      <HeldSteps value={createHeldSteps()}>
        <ZoomProvider>
          <Router>{(props) => <Loading fallback={<main />}>{props.children}</Loading>}</Router>
        </ZoomProvider>
      </HeldSteps>
    </RuntimeContext>
  );
}

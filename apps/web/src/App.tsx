import { isServer } from "@solidjs/web";
import { createRouter } from "@solidjs/router";
import { fileRoutes } from "@solidjs/router/fs";
import { pageRoutes } from "virtual:file-routes";
import { Loading } from "solid-js";

import { serverLayer } from "./api/binding";
import { WebLayer } from "./api/client";
import { createRuntime, RuntimeContext } from "./api/solid-effect";
import { createHeldSteps, HeldSteps } from "./steps";
import { ZoomProvider } from "./zoom";

import "@fontsource-variable/onest/wght.css";
import "./app.css";

const Router = createRouter({ routes: fileRoutes(pageRoutes) });

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

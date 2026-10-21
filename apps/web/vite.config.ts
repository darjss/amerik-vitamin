import { cloudflare } from "@cloudflare/vite-plugin";
import { fileRoutes } from "filesystem-routing/vite";
import solid from "@solidjs/vite-plugin";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite-plus";

// Alchemy's Website.Vite injects the Cloudflare plugin itself; the plugin is
// only added for a plain `vp build`.
const workerSsr =
  process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1"
    ? []
    : [cloudflare({ viteEnvironment: { name: "ssr" } })];

export default defineConfig({
  environments: {
    // The ssr bundle runs in workerd, where `cloudflare:*` modules are
    // builtins. The client graph reaches the same specifier through binding.ts
    // on a branch `isServer` eliminates, so it must be external there too.
    client: { build: { rolldownOptions: { external: [/^cloudflare:/u] } } },
    ssr: { build: { rolldownOptions: { external: [/^cloudflare:/u] } } },
  },
  plugins: [
    ...workerSsr,
    solid({
      extensions: [".jsx", ".tsx"],
      ssr: true,
      start: { middleware: "./src/middleware.ts", renderMode: "async" },
    }),
    fileRoutes({ codeSplitting: false, httpMethods: true, types: true }),
    Icons({ compiler: "solid" }),
  ],
  resolve: {
    alias: { "styled-system": `${import.meta.dirname}/styled-system` },
  },
  root: import.meta.dirname,
  server: {
    host: "127.0.0.1",
    port: 3001,
  },
});

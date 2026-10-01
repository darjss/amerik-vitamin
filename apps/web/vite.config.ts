import { fileRoutes } from "filesystem-routing/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    solid({
      extensions: [".jsx", ".tsx"],
      ssr: true,
      start: {},
    }),
    fileRoutes({ types: true }),
  ],
  root: import.meta.dirname,
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
});

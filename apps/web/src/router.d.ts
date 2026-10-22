// @solidjs/router reads a plain link's `state` attribute as JSON and passes it
// to the navigation (handleAnchorClick in its index.js). Solid's JSX types
// don't list it.
import "@solidjs/web";

declare module "@solidjs/web" {
  namespace JSX {
    interface AnchorHTMLAttributes<T> {
      state?: string;
    }
  }
}

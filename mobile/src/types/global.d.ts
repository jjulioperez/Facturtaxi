import type { Buffer as BufferPolyfill } from "buffer";

// `Buffer` se registra como global en index.js (polyfill de node-forge/@signpdf).
declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof BufferPolyfill;
}

export {};

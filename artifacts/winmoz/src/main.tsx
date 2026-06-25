import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD) {
  const _noop = () => {};
  try {
    (window.console as unknown as Record<string, unknown>).log   = _noop;
    (window.console as unknown as Record<string, unknown>).warn  = _noop;
    (window.console as unknown as Record<string, unknown>).error = _noop;
    (window.console as unknown as Record<string, unknown>).info  = _noop;
    (window.console as unknown as Record<string, unknown>).debug = _noop;
    (window.console as unknown as Record<string, unknown>).table = _noop;
    (window.console as unknown as Record<string, unknown>).dir   = _noop;
  } catch { /* noop */ }

  try {
    Object.defineProperty(window, "console", {
      get() { return { log: _noop, warn: _noop, error: _noop, info: _noop, debug: _noop, table: _noop, dir: _noop }; },
      configurable: false,
    });
  } catch { /* noop */ }

  const _origRandom = Math.random.bind(Math);
  Object.defineProperty(Math, "random", {
    get() { return _origRandom; },
    set(_v) { /* silently ignore override attempts */ },
    configurable: false,
  });

  try {
    Object.freeze(Math);
  } catch { /* noop */ }

  let devtoolsOpen = false;
  const devtoolsCheck = () => {
    const threshold = 160;
    const widthDiff  = window.outerWidth  - window.innerWidth  > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if ((widthDiff || heightDiff) && !devtoolsOpen) {
      devtoolsOpen = true;
    }
  };
  setInterval(devtoolsCheck, 3000);

  window.addEventListener("contextmenu", (e) => e.preventDefault());
}

createRoot(document.getElementById("root")!).render(<App />);

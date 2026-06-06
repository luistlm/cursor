import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = {
  _html: "",
  set innerHTML(value) {
    this._html = value;
  },
  get innerHTML() {
    return this._html;
  },
};

globalThis.window = {
  innerHeight: 800,
  scrollY: 0,
  matchMedia: undefined,
};
globalThis.document = {
  body: { offsetHeight: 1000 },
  documentElement: { dataset: {} },
  createElement(tagName) {
    if (tagName === "link") {
      return {
        relList: {
          supports() {
            return true;
          },
        },
      };
    }
    return {};
  },
  querySelector(selector) {
    return selector === "#app" ? root : null;
  },
  querySelectorAll() {
    return [];
  },
};
globalThis.localStorage = {
  getItem() {
    throw new Error("storage blocked");
  },
  setItem() {
    throw new Error("storage blocked");
  },
  removeItem() {
    throw new Error("storage blocked");
  },
};
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {},
});
globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 1;
};
globalThis.getComputedStyle = () => ({
  getPropertyValue() {
    return "#111827";
  },
});
globalThis.DOMMatrix = class {};
globalThis.ImageData = class {};
globalThis.Path2D = class {};
globalThis.HTMLCanvasElement = class {};

const files = await readdir(new URL("../dist/assets/", import.meta.url));
const appBundle = files.find((file) => file.startsWith("index-") && file.endsWith(".js"));

if (!appBundle) {
  throw new Error("Could not find built app bundle.");
}

await import(pathToFileURL(new URL(`../dist/assets/${appBundle}`, import.meta.url).pathname));

if (!root.innerHTML.includes("freemoney") || !root.innerHTML.includes("bottom-nav")) {
  throw new Error("App did not render the expected shell.");
}

console.log("Smoke test passed: freemoney renders with constrained browser APIs.");

import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "http://127.0.0.1:5173",
});

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});

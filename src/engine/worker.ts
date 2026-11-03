import { generate } from "./world";
import { validateWorld } from "./validate";
import type { Params } from "../types";
self.onmessage = (message: MessageEvent<Params>) => {
  try {
    const world = generate(message.data, (progress) =>
      self.postMessage({ progress }),
    );
    const errors = validateWorld(world);
    if (errors.length) throw Error(errors[0]);
    self.postMessage({ world });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

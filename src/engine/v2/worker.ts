import { personalStories } from "./personal-report";
import { SliceSimulation } from "./engine";
import type { Scenario } from "./types";
import { validateSlice } from "./validate";
import { story } from "./report";
/** Standalone slice Worker; the legacy map/UI continues to use its v1 worker. */
self.onmessage = (
  message: MessageEvent<Scenario & { output?: "compact" | "legacy" }>,
) => {
  try {
    const simulation = new SliceSimulation(message.data);
    for (let month = 12; month < message.data.months; month += 12) {
      simulation.advance(month);
      self.postMessage({ type: "progress", month, total: message.data.months });
    }
    if (message.data.output !== "legacy" && message.data.emotionalDynamics) {
      const world = simulation.runCompact();
      self.postMessage({ type: "complete", format: "delta-routine-v1", world });
      return;
    }
    const world = simulation.run();
    const errors = validateSlice(world);
    if (errors.length) throw Error(errors.slice(0, 5).join("; "));
    self.postMessage({
      type: "complete",
      world,
      story: story(world),
      personalStories: message.data.personalObjectives
        ? personalStories(world)
        : [],
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // 2c jobs are one-shot. The queued result owns its structured clone;
    // release the producer isolate instead of retaining a second full history.
    if (message.data.lifeSimulation?.fertilityPolicy) self.close();
  }
};

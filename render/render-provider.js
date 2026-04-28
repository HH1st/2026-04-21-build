import { createFluidRenderer } from "./fluid-renderer.js";
import { createNebulaRenderer } from "./nebula-renderer.js";

const RENDERERS = {
  fluid: createFluidRenderer,
  nebula: createNebulaRenderer
};

export function createRenderProvider(options = {}) {
  const { kind = "fluid" } = options;
  const factory = RENDERERS[kind] ?? RENDERERS.fluid;
  let rendererInstance = null;

  function start() {
    if (!rendererInstance) {
      rendererInstance = factory(options);
    }
    return rendererInstance;
  }

  function stop() {
    rendererInstance?.stop?.();
    rendererInstance = null;
  }

  return {
    start,
    stop,
    getKind: () => kind
  };
}

export const DEFAULT_RICKY_VAD_CONFIG = Object.freeze({
  onnxWasmBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
  baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",
  redemptionMs: 800
});

export function createRickyVadProvider(options = {}) {
  const {
    config = {},
    onSpeechStart = () => {},
    onSpeechEnd = () => {},
    onError = () => {}
  } = options;

  const resolvedConfig = {
    ...DEFAULT_RICKY_VAD_CONFIG,
    ...config
  };

  let micVad = null;

  async function start() {
    if (micVad) {
      return micVad;
    }

    if (!window.vad?.MicVAD) {
      const error = new Error("[vad-provider] Ricky VAD library is unavailable");
      onError(error);
      throw error;
    }

    try {
      micVad = await window.vad.MicVAD.new({
        onSpeechStart,
        onSpeechEnd,
        onnxWASMBasePath: resolvedConfig.onnxWasmBasePath,
        baseAssetPath: resolvedConfig.baseAssetPath,
        redemptionMs: resolvedConfig.redemptionMs
      });

      micVad.start();
      return micVad;
    } catch (error) {
      micVad = null;
      onError(error);
      throw error;
    }
  }

  function stop() {
    micVad?.pause?.();
  }

  return {
    start,
    stop,
    isActive: () => Boolean(micVad),
    getConfig: () => ({ ...resolvedConfig })
  };
}

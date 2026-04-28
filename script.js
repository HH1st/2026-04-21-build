import { AgentState, createAgentStateMachine } from "./core/state-machine.js";
import { createRenderProvider } from "./render/render-provider.js";
import { createRickyVadProvider } from "./speech/vad-provider.js";

// --- state ---------------------------------------------------------------

const agentStateMachine = createAgentStateMachine(AgentState.IDLE, {
  onTransition({ previousState, currentState }) {
    document.body.dataset.agentState = currentState;
    const badge = document.getElementById("agent-state");
    if (badge) badge.textContent = currentState;
    window.dispatchEvent(
      new CustomEvent("agent-state-change", {
        detail: { previousState, currentState }
      })
    );
  }
});

const getState = () => agentStateMachine.getState();
const setState = (next) => {
  const changed = agentStateMachine.transitionTo(next);
  if (!changed) {
    console.warn(`[state-machine] Invalid transition: ${getState()} -> ${next}`);
  }
  return changed;
};

window.agentStateMachine = { AgentState, getState, setState };

// --- render provider -----------------------------------------------------

let renderProvider = null;
let activeRenderKind = "fluid";

function mountRenderer(kind) {
  const mount = document.getElementById("scene-root");
  if (!mount) return;

  renderProvider?.stop();
  renderProvider = createRenderProvider({ mount, getState, kind });
  renderProvider.start();
  activeRenderKind = kind;
}

document.getElementById("renderer-kind")?.addEventListener("change", (event) => {
  const nextKind = event.target?.value === "nebula" ? "nebula" : "fluid";
  if (nextKind !== activeRenderKind) mountRenderer(nextKind);
});

// --- dev mode (vad + debug UI) ------------------------------------------

function isDevMode() {
  const params = new URLSearchParams(window.location.search);
  return params.has("dev") || params.get("mode")?.toLowerCase() === "dev";
}

function setupDevUI() {
  const startBtn = document.getElementById("start-vad");
  const micStatus = document.getElementById("mic-status");
  const setMicStatus = (msg) => { if (micStatus) micStatus.textContent = msg; };

  let vadProvider = null;
  let isStarting = false;

  async function enableVad() {
    if (vadProvider?.isActive() || isStarting) return;
    isStarting = true;

    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = "Starting mic...";
    }
    setMicStatus("Requesting microphone access...");

    try {
      vadProvider ??= createRickyVadProvider({
        onSpeechStart: () => {
          setMicStatus("Speech detected");
          setState(AgentState.LISTENING);
        },
        onSpeechEnd: () => {
          setMicStatus("Waiting for speech");
          setState(AgentState.IDLE);
        },
        onError: (error) => console.error("[vad-provider] Failed to start VAD", error)
      });

      await vadProvider.start();
      setMicStatus("VAD active");
      if (startBtn) startBtn.textContent = "Mic enabled";
    } catch (error) {
      setMicStatus(
        error?.message?.includes("library is unavailable")
          ? "VAD library failed to load"
          : "Microphone permission denied or unavailable"
      );
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "Enable mic";
      }
    } finally {
      isStarting = false;
    }
  }

  startBtn?.addEventListener("click", enableVad);

  window.addEventListener("beforeunload", () => vadProvider?.stop());
  return () => vadProvider?.stop();
}

// --- bootstrap -----------------------------------------------------------

document.body.dataset.agentState = getState();
mountRenderer(activeRenderKind);

if (isDevMode()) {
  setupDevUI();
} else {
  document.querySelector(".state-badge")?.setAttribute("hidden", "");
  document.querySelector(".controls-panel")?.setAttribute("hidden", "");
}

window.addEventListener("beforeunload", () => renderProvider?.stop());

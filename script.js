import { createFluidRenderer } from "./renderer.js";
import { AgentState, createAgentStateMachine } from "./state-machine.js";
import { createRickyVadProvider } from "./vad-provider.js";

const stateBadge = document.getElementById("agent-state");
const stateBadgeContainer = stateBadge?.closest(".state-badge");
const controlsPanel = document.querySelector(".controls-panel");
const startVadButton = document.getElementById("start-vad");
const micStatus = document.getElementById("mic-status");

let vadProvider = null;
let isVadStarting = false;

function isDevModeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("dev")) {
    return true;
  }

  const mode = params.get("mode")?.toLowerCase();
  return mode === "dev";
}

const isDevMode = isDevModeFromQuery();

if (!isDevMode) {
  stateBadgeContainer?.setAttribute("hidden", "");
  controlsPanel?.setAttribute("hidden", "");
}

function applyStateToUI(state) {
  document.body.dataset.agentState = state;
  if (stateBadge) {
    stateBadge.textContent = state;
  }
}

const agentStateMachine = createAgentStateMachine(AgentState.IDLE, {
  onTransition({ previousState, currentState }) {
    window.dispatchEvent(
      new CustomEvent("agent-state-change", {
        detail: { previousState, currentState }
      })
    );
    applyStateToUI(currentState);
  }
});

function setAgentState(nextState) {
  const changed = agentStateMachine.transitionTo(nextState);
  if (!changed) {
    console.warn(
      `[state-machine] Invalid transition: ${agentStateMachine.getState()} -> ${nextState}`
    );
  }
  return changed;
}

window.agentStateMachine = {
  AgentState,
  getState: () => agentStateMachine.getState(),
  setState: setAgentState
};

function setMicStatus(message) {
  if (micStatus) {
    micStatus.textContent = message;
  }
}

async function enableVad() {
  if (vadProvider?.isActive() || isVadStarting) {
    return;
  }

  isVadStarting = true;

  if (startVadButton) {
    startVadButton.disabled = true;
    startVadButton.textContent = "Starting mic...";
  }

  setMicStatus("Requesting microphone access...");

  try {
    vadProvider ??= createRickyVadProvider({
      onSpeechStart: () => {
        setMicStatus("Speech detected");
        setAgentState(AgentState.LISTENING);
      },
      onSpeechEnd: () => {
        setMicStatus("Waiting for speech");
        setAgentState(AgentState.IDLE);
      },
      onError: (error) => {
        console.error("[vad-provider] Failed to start VAD", error);
      }
    });

    await vadProvider.start();
    setMicStatus("VAD active");

    if (startVadButton) {
      startVadButton.textContent = "Mic enabled";
    }
  } catch (error) {
    setMicStatus(
      error?.message?.includes("library is unavailable")
        ? "VAD library failed to load"
        : "Microphone permission denied or unavailable"
    );

    if (startVadButton) {
      startVadButton.disabled = false;
      startVadButton.textContent = "Enable mic";
    }
  } finally {
    isVadStarting = false;
  }
}

applyStateToUI(agentStateMachine.getState());

const mount = document.getElementById("scene-root");
const fluidRenderer = createFluidRenderer({
  mount,
  getState: () => agentStateMachine.getState()
});

if (isDevMode) {
  startVadButton?.addEventListener("click", () => {
    enableVad();
  });
}

window.addEventListener("beforeunload", () => {
  vadProvider?.stop();
  fluidRenderer.cleanup();
});

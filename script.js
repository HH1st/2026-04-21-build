import { createFluidRenderer } from "./renderer.js";
import { AgentState, createAgentStateMachine } from "./state-machine.js";

const stateBadge = document.getElementById("agent-state");
const stateBadgeContainer = stateBadge?.closest(".state-badge");

function isDevModeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("dev")) {
    return true;
  }

  const mode = params.get("mode")?.toLowerCase();
  return mode === "dev";
}

const isDevMode = isDevModeFromQuery();

if (!isDevMode && stateBadgeContainer) {
  stateBadgeContainer.style.display = "none";
}

function applyStateToUI(state) {
  document.body.dataset.agentState = state;
  if (isDevMode && stateBadge) {
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

applyStateToUI(agentStateMachine.getState());

const mount = document.getElementById("scene-root");
const fluidRenderer = createFluidRenderer({
  mount,
  getState: () => agentStateMachine.getState()
});

window.addEventListener("beforeunload", () => {
  fluidRenderer.cleanup();
});

export const AgentState = Object.freeze({
  IDLE: "idle",
  LISTENING: "listening"
});

const validTransitions = {
  [AgentState.IDLE]: [AgentState.LISTENING],
  [AgentState.LISTENING]: [AgentState.IDLE]
};

export function createAgentStateMachine(initialState = AgentState.IDLE, options = {}) {
  let currentState = initialState;
  const { onTransition } = options;

  function canTransitionTo(nextState) {
    return validTransitions[currentState]?.includes(nextState) ?? false;
  }

  function transitionTo(nextState) {
    if (!canTransitionTo(nextState)) {
      return false;
    }

    const previousState = currentState;
    currentState = nextState;

    if (typeof onTransition === "function") {
      onTransition({ previousState, currentState });
    }

    return true;
  }

  return {
    getState: () => currentState,
    canTransitionTo,
    transitionTo
  };
}

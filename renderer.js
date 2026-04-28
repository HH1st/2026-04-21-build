import * as THREE from "https://unpkg.com/three@0.177.0/build/three.module.js";
import { AgentState } from "./state-machine.js";
import { fluidFragmentShader, fluidVertexShader } from "./fluid-shaders.js";

const RENDER_CONFIG = {
  colors: {
    cyan: "#5fb8a8",
    gold: "#e8b968",
    amber: "#ffd98a",
    blue: "#3a6f9a"
  },
  initialPointer: { x: 0.58, y: 0.44 },
  transitionSmoothing: 3.8,
  stateAnimation: {
    idle: { pointerLerp: 0.09, timeScale: 1.2, listeningMix: 0.0 },
    listening: { pointerLerp: 0.042, timeScale: 0.82, listeningMix: 1.0 }
  }
};

export function createFluidRenderer(options = {}) {
  const { mount, getState } = options;

  if (!mount) {
    throw new Error("[renderer] mount element is required");
  }

  if (typeof getState !== "function") {
    throw new Error("[renderer] getState callback is required");
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uColorA: { value: new THREE.Color(RENDER_CONFIG.colors.cyan) },
    uColorB: { value: new THREE.Color(RENDER_CONFIG.colors.gold) },
    uColorC: { value: new THREE.Color(RENDER_CONFIG.colors.amber) },
    uColorD: { value: new THREE.Color(RENDER_CONFIG.colors.blue) },
    uListeningMix: { value: 0 },
    uPointer: {
      value: new THREE.Vector2(
        RENDER_CONFIG.initialPointer.x,
        RENDER_CONFIG.initialPointer.y
      )
    }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fluidVertexShader,
    fragmentShader: fluidFragmentShader
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(plane);

  const pointerTarget = new THREE.Vector2(
    RENDER_CONFIG.initialPointer.x,
    RENDER_CONFIG.initialPointer.y
  );
  const smoothedState = {
    timeScale: RENDER_CONFIG.stateAnimation[AgentState.IDLE].timeScale,
    pointerLerp: RENDER_CONFIG.stateAnimation[AgentState.IDLE].pointerLerp,
    listeningMix: RENDER_CONFIG.stateAnimation[AgentState.IDLE].listeningMix
  };
  let lastFrameTime = null;
  let accumulatedTime = 0;

  function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    uniforms.uResolution.value.set(width, height);
  }

  function onPointerMove(event) {
    pointerTarget.set(
      event.clientX / window.innerWidth,
      1 - event.clientY / window.innerHeight
    );
  }

  function animate(time) {
    const deltaSeconds = lastFrameTime === null ? 1 / 60 : Math.min((time - lastFrameTime) / 1000, 0.1);
    lastFrameTime = time;
    const state = getState();
    const stateAnimation =
      RENDER_CONFIG.stateAnimation[state] ??
      RENDER_CONFIG.stateAnimation[AgentState.IDLE];
    const smoothing = 1 - Math.exp(-RENDER_CONFIG.transitionSmoothing * deltaSeconds);

    smoothedState.timeScale = THREE.MathUtils.lerp(
      smoothedState.timeScale,
      stateAnimation.timeScale,
      smoothing
    );
    smoothedState.pointerLerp = THREE.MathUtils.lerp(
      smoothedState.pointerLerp,
      stateAnimation.pointerLerp,
      smoothing
    );
    smoothedState.listeningMix = THREE.MathUtils.lerp(
      smoothedState.listeningMix,
      stateAnimation.listeningMix,
      smoothing
    );

    accumulatedTime += deltaSeconds * 1000 * smoothedState.timeScale;
    uniforms.uTime.value = accumulatedTime;
    uniforms.uListeningMix.value = smoothedState.listeningMix;
    uniforms.uPointer.value.lerp(pointerTarget, smoothedState.pointerLerp);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("pointermove", onPointerMove);

  function cleanup() {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("pointermove", onPointerMove);
    renderer.dispose();
    material.dispose();
    plane.geometry.dispose();
  }

  return {
    cleanup
  };
}

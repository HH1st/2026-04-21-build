import * as THREE from "https://unpkg.com/three@0.177.0/build/three.module.js";

const mount = document.getElementById("scene-root");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uColorA: { value: new THREE.Color("#39efff") },
  uColorB: { value: new THREE.Color("#4f6fff") },
  uColorC: { value: new THREE.Color("#ff315a") },
  uPointer: { value: new THREE.Vector2(0.58, 0.44) }
};

const pointerTarget = new THREE.Vector2(0.58, 0.44);

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    varying vec2 vUv;

    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    uniform vec2 uPointer;

    float smin(float a, float b, float k) {
      float h = max(k - abs(a - b), 0.0) / k;
      return min(a, b) - h * h * k * 0.25;
    }

    float blob(vec2 uv, vec2 center, vec2 stretch) {
      vec2 d = (uv - center) / stretch;
      return length(d);
    }

    float breathe(float t) {
      float phase = sin(t);
      float shaped = sign(phase) * pow(abs(phase), 1.7);
      return shaped * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = vUv;
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      vec2 p = (uv - 0.5) * aspect * 1.32;
      float t = uTime * 0.001;
      float breath = breathe(t * 1.02);
      float breathLag = breathe(t * 1.02 - 0.85);
      float inhale = smoothstep(0.08, 0.92, breath);
      float exhale = smoothstep(0.08, 0.92, breathLag);
      float bodyPulse = mix(0.95, 1.05, inhale);
      float bodyDrift = mix(-0.025, 0.03, exhale);

      vec2 warp = p;
      warp.x += sin(p.y * 1.42 + t * 0.26) * 0.028 * bodyPulse;
      warp.y += cos(p.x * 1.18 - t * 0.22) * 0.025 * bodyPulse;
      warp += vec2(
        sin((p.x + p.y) * 1.16 + t * 0.14),
        cos((p.x - p.y) * 1.02 - t * 0.12)
      ) * 0.012;
      warp.y += bodyDrift * 0.08;

      vec2 centerA = vec2(-0.42 + sin(t * 0.18) * 0.028, 0.16 + cos(t * 0.16) * 0.028 - bodyDrift * 0.035);
      vec2 centerB = vec2(0.48 + cos(t * 0.16) * 0.034, 0.2 + sin(t * 0.14) * 0.026 - bodyDrift * 0.03);
      vec2 centerC = vec2(0.18 + sin(t * 0.2) * 0.03, -0.32 + cos(t * 0.12) * 0.024 + bodyDrift * 0.035);
      vec2 centerD = vec2(0.62 + sin(t * 0.15) * 0.018, -0.06 + cos(t * 0.17) * 0.03 + bodyDrift * 0.022);

      vec2 stretchA = vec2(0.72, 0.58) * bodyPulse;
      vec2 stretchB = vec2(0.64, 0.52) * mix(0.94, 1.06, inhale);
      vec2 stretchC = vec2(0.8, 0.64) * mix(0.95, 1.05, exhale);
      vec2 stretchD = vec2(0.66, 0.52) * mix(0.93, 1.08, inhale);

      float dA = blob(warp, centerA, stretchA);
      float dB = blob(warp, centerB, stretchB);
      float dC = blob(warp, centerC, stretchC);
      float dD = blob(warp, centerD, stretchD);

      float m1 = smin(dA, dB, 0.34);
      float m2 = smin(dC, dD, 0.34);
      float field = smin(m1, m2, 0.42);

      float cyanOrb = smoothstep(1.08, 0.08, dA);
      float blueOrbA = smoothstep(1.06, 0.08, dB);
      float blueOrbB = smoothstep(1.1, 0.08, dC);
      float redOrb = smoothstep(1.04, 0.08, dD);
      float mergedGlow = smoothstep(1.12, 0.02, field);
      float pointerField = smoothstep(0.82, 0.0, blob(warp, (uPointer - 0.5) * aspect * 0.5, vec2(0.54, 0.42)));

      vec3 color = vec3(0.03, 0.07, 0.11);
      color += uColorA * cyanOrb * mix(0.72, 0.9, inhale);
      color += uColorB * blueOrbA * mix(0.56, 0.7, inhale);
      color += uColorB * blueOrbB * mix(0.42, 0.54, exhale);
      color += uColorC * redOrb * mix(0.8, 0.98, inhale);
      color += mix(uColorA, uColorB, 0.42) * mergedGlow * mix(0.14, 0.22, inhale);
      color += mix(uColorC, uColorA, 0.3) * pointerField * 0.045;

      float haze = smoothstep(1.46, 0.14, length(p));
      color *= haze;
      color += vec3(0.018, 0.022, 0.03);

      color = 1.0 - exp(-color * 1.12);
      color = pow(color, vec3(0.98));

      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(plane);

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  uniforms.uResolution.value.set(width, height);
}

function onPointerMove(event) {
  pointerTarget.set(
    event.clientX / window.innerWidth,
    1 - event.clientY / window.innerHeight
  );
}

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);

renderer.setAnimationLoop((time) => {
  uniforms.uTime.value = time;
  uniforms.uPointer.value.lerp(pointerTarget, 0.06);
  renderer.render(scene, camera);
});

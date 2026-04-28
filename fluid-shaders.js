const shaderHelpers = `
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = r * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  vec3 iridescence(float t) {
    vec3 a = vec3(0.5, 0.5, 0.55);
    vec3 b = vec3(0.5, 0.45, 0.4);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.18, 0.42);
    return a + b * cos(6.28318 * (c * t + d));
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
`;

export const fluidVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const fluidFragmentShader = `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uColorD;
  uniform vec2 uPointer;
  uniform float uListeningMix;

  ${shaderHelpers}

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect * 1.32;
    float t = uTime * 0.001;
    float activeBreathRate = mix(1.2, 1.0, uListeningMix);
    float breath = breathe(t * activeBreathRate);
    float breathLag = breathe(t * activeBreathRate - 0.7);
    float inhale = smoothstep(0.08, 0.92, breath);
    float exhale = smoothstep(0.08, 0.92, breathLag);
    float bodyPulse = mix(0.98, mix(1.09, 1.06, uListeningMix), inhale);
    float bodyDrift = mix(-0.015, 0.025, exhale);

    vec2 warp = p;
    warp.x += sin(p.y * 1.42 + t * 0.38) * 0.031 * bodyPulse;
    warp.y += cos(p.x * 1.18 - t * 0.34) * 0.028 * bodyPulse;
    warp += vec2(
      sin((p.x + p.y) * 1.16 + t * 0.2),
      cos((p.x - p.y) * 1.02 - t * 0.18)
    ) * 0.014;
    warp += vec2(
      sin(p.y * 3.2 - t * 0.24),
      cos(p.x * 2.8 + t * 0.22)
    ) * 0.005;
    warp.y += bodyDrift * 0.072;

    vec2 centerA = vec2(-0.42 + sin(t * 0.18) * 0.028, 0.16 + cos(t * 0.16) * 0.028 - bodyDrift * 0.035);
    vec2 centerB = vec2(0.48 + cos(t * 0.16) * 0.034, 0.2 + sin(t * 0.14) * 0.026 - bodyDrift * 0.03);
    vec2 centerC = vec2(0.18 + sin(t * 0.2) * 0.03, -0.32 + cos(t * 0.12) * 0.024 + bodyDrift * 0.035);
    vec2 centerD = vec2(0.62 + sin(t * 0.15) * 0.018, -0.06 + cos(t * 0.17) * 0.03 + bodyDrift * 0.022);

    vec2 bary = vec2(0.04, 0.0);
    float orbitSpeed = 0.18;
    float ang = t * orbitSpeed;
    mat2 rotCW = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    mat2 rotCCW = mat2(cos(-ang * 0.78), -sin(-ang * 0.78), sin(-ang * 0.78), cos(-ang * 0.78));
    centerA = bary + rotCW * (centerA - bary);
    centerB = bary + rotCW * (centerB - bary);
    centerC = bary + rotCCW * (centerC - bary);
    centerD = bary + rotCCW * (centerD - bary);

    vec2 stretchA = vec2(0.72, 0.58) * bodyPulse;
    vec2 stretchB = vec2(0.64, 0.52) * mix(0.96, 1.04, inhale);
    vec2 stretchC = vec2(0.8, 0.64) * mix(0.97, 1.03, exhale);
    vec2 stretchD = vec2(0.66, 0.52) * mix(0.95, 1.06, inhale);

    float dA = blob(warp, centerA, stretchA);
    float dB = blob(warp, centerB, stretchB);
    float dC = blob(warp, centerC, stretchC);
    float dD = blob(warp, centerD, stretchD);

    float m1 = smin(dA, dB, 0.22);
    float m2 = smin(dC, dD, 0.22);
    float field = smin(m1, m2, 0.28);

    float cyanOrb = smoothstep(0.92, 0.18, dA);
    float blueOrbA = smoothstep(0.9, 0.18, dB);
    float blueOrbB = smoothstep(0.94, 0.18, dC);
    float redOrb = smoothstep(0.88, 0.18, dD);
    float mergedGlow = smoothstep(0.96, 0.05, field);
    float pointerField = smoothstep(0.82, 0.0, blob(warp, (uPointer - 0.5) * aspect * 0.5, vec2(0.5, 0.38)));

    vec3 color = vec3(0.03, 0.07, 0.11);
    color += mix(uColorA, vec3(0.62, 0.88, 0.84), uListeningMix * 0.22) * cyanOrb * mix(0.84, 0.98, inhale);
    color += mix(uColorD, vec3(0.42, 0.7, 0.92), uListeningMix * 0.18) * blueOrbA * mix(1.0, 1.08, inhale);
    color += uColorB * blueOrbB * mix(0.64, 0.72 + 0.01 * uListeningMix, exhale);
    color += uColorC * redOrb * mix(0.85, 1.05, inhale);
    color += mix(uColorD, uColorB, 0.5) * mergedGlow * mix(0.2, 0.21 + 0.01 * uListeningMix, inhale);
    color += mix(uColorC, uColorA, 0.3) * pointerField * mix(0.09, 0.1, uListeningMix);

    vec2 flow = warp * 2.6 + vec2(t * 0.18, -t * 0.12);
    float caustic = fbm(flow + fbm(flow * 1.4 + t * 0.22));
    caustic = pow(caustic, 1.6);
    float bodyMask = smoothstep(1.18, 0.05, field);
    vec3 goldShimmer = mix(uColorB, uColorC, smoothstep(0.35, 0.85, caustic));
    float warmMask = smoothstep(0.32, 0.78, blueOrbB + redOrb);
    color += goldShimmer * caustic * bodyMask * warmMask * mix(0.26, 0.27 - 0.015 * uListeningMix, inhale);

    float rim = smoothstep(0.02, 0.36, field) * smoothstep(1.18, 0.42, field);
    float irisPhase = caustic * 0.6 + field * 0.8 + t * 0.05;
    vec3 iris = iridescence(irisPhase);
    color += iris * rim * mix(0.26, 0.28, uListeningMix);

    float glint = pow(smoothstep(0.78, 1.0, caustic), 4.0) * bodyMask;
    color += vec3(1.0, 0.92, 0.78) * glint * mix(0.6, 0.63, uListeningMix);

    float haze = smoothstep(1.46, 0.14, length(p));
    color *= haze;
    color += mix(vec3(0.018, 0.022, 0.03), vec3(0.019, 0.024, 0.032), uListeningMix);

    color = 1.0 - exp(-color * 1.35);
    color = pow(color, vec3(0.92));
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.18);

    float grain = hash(gl_FragCoord.xy + fract(t) * 91.17) - 0.5;
    color += grain * 0.025;

    gl_FragColor = vec4(color, 1.0);
  }
`;

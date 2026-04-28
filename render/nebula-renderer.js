import * as THREE from "https://unpkg.com/three@0.177.0/build/three.module.js";
import { AgentState } from "../core/state-machine.js";

const STAR_COUNT = 1800;
const DUST_COUNT = 900;
const PUFF_COUNT = 14;

// ---- procedural textures -------------------------------------------------

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function createStarTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(180,225,255,0.9)");
  g.addColorStop(0.55, "rgba(110,166,255,0.28)");
  g.addColorStop(1, "rgba(20,46,86,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// elongated diffraction-spike sparkle (the "sexy" cross flare)
function createSparkleTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.18);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.4, "rgba(210,230,255,0.7)");
  core.addColorStop(1, "rgba(120,170,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const spike = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
    spike.addColorStop(0, "rgba(255,255,255,0)");
    spike.addColorStop(0.45, "rgba(190,220,255,0.55)");
    spike.addColorStop(0.5, "rgba(255,255,255,1)");
    spike.addColorStop(0.55, "rgba(190,220,255,0.55)");
    spike.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spike;
    ctx.fillRect(-size / 2, -1.2, size, 2.4);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// soft, irregular nebula puff: stacked offset radial blobs + grain
function createPuffTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 9; i += 1) {
    const r = size * (0.18 + Math.random() * 0.28);
    const x = size / 2 + (Math.random() - 0.5) * size * 0.45;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.18 + Math.random() * 0.32;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.45})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // grain
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // round mask so the sprite fades at the edges
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.7, "rgba(0,0,0,0.5)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// large logarithmic spiral disk for the deep background
function createSpiralTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // base radial fade
  const base = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  base.addColorStop(0, "rgba(120,150,230,0.55)");
  base.addColorStop(0.35, "rgba(80,90,170,0.3)");
  base.addColorStop(0.7, "rgba(40,30,90,0.12)");
  base.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // spiral arms via many additive points along log-spirals
  ctx.globalCompositeOperation = "lighter";
  const arms = 3;
  const palettes = [
    ["#ffd6a5", "#ff8fa3"],
    ["#a0c4ff", "#cdb4ff"],
    ["#bdb2ff", "#9bf6ff"]
  ];
  for (let arm = 0; arm < arms; arm += 1) {
    const armOffset = (arm / arms) * Math.PI * 2;
    const [c1, c2] = palettes[arm % palettes.length];
    for (let i = 0; i < 1400; i += 1) {
      const t = i / 1400;
      const r = Math.pow(t, 0.62) * (size * 0.46);
      const angle = armOffset + t * 7.5 + (Math.random() - 0.5) * 0.45;
      const x = size / 2 + Math.cos(angle) * r;
      const y = size / 2 + Math.sin(angle) * r;
      const radius = 8 + Math.random() * 18 * (1 - t * 0.5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const tint = Math.random() < 0.5 ? c1 : c2;
      g.addColorStop(0, hexToRgba(tint, 0.32 * (1 - t * 0.4)));
      g.addColorStop(1, hexToRgba(tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }

  // bright nucleus
  const nucleus = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.18);
  nucleus.addColorStop(0, "rgba(255,240,210,0.95)");
  nucleus.addColorStop(0.5, "rgba(255,180,140,0.35)");
  nucleus.addColorStop(1, "rgba(255,120,160,0)");
  ctx.fillStyle = nucleus;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- particle field ------------------------------------------------------

function buildStars(count, radius, sizeRange) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const colorA = new THREE.Color("#7ad6ff");
  const colorB = new THREE.Color("#bca7ff");
  const colorC = new THREE.Color("#ffe5b1");
  const colorD = new THREE.Color("#ff9ec7");
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const dist = radius * Math.pow(Math.random(), 0.52);

    const x = dist * Math.sin(phi) * Math.cos(theta);
    const y = dist * Math.cos(phi) * 0.55;
    const z = dist * Math.sin(phi) * Math.sin(theta);

    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    const tone = Math.random();
    if (tone < 0.45) tmp.copy(colorA).lerp(colorB, Math.random());
    else if (tone < 0.78) tmp.copy(colorB).lerp(colorC, Math.random());
    else tmp.copy(colorC).lerp(colorD, Math.random());

    colors[idx] = tmp.r;
    colors[idx + 1] = tmp.g;
    colors[idx + 2] = tmp.b;
    sizes[i] = THREE.MathUtils.lerp(sizeRange[0], sizeRange[1], Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

// ---- main renderer -------------------------------------------------------

export function createNebulaRenderer(options = {}) {
  const { mount, getState } = options;
  if (!mount) throw new Error("[nebula-renderer] mount element is required");
  if (typeof getState !== "function") {
    throw new Error("[nebula-renderer] getState callback is required");
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#04060f", 0.085);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 80);
  camera.position.set(0, 0.5, 9);

  // lights
  const ambient = new THREE.AmbientLight("#6487ff", 0.45);
  const rim = new THREE.PointLight("#6be1ff", 18, 28, 2);
  rim.position.set(-3.4, 2.2, 4.8);
  const warmFill = new THREE.PointLight("#ffb174", 14, 30, 2);
  warmFill.position.set(4.2, -1.5, 3.6);
  const magenta = new THREE.PointLight("#ff7adf", 10, 26, 2);
  magenta.position.set(0.5, -2.4, -3);
  scene.add(ambient, rim, warmFill, magenta);

  // textures
  const starTexture = createStarTexture();
  const sparkleTexture = createSparkleTexture();
  const spiralTexture = createSpiralTexture();
  const puffTextures = Array.from({ length: 4 }, () => createPuffTexture());
  const disposables = [starTexture, sparkleTexture, spiralTexture, ...puffTextures];

  // background spiral disk (large, behind everything)
  const spiral = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({
      map: spiralTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  spiral.position.z = -10;
  spiral.rotation.z = 0.4;
  scene.add(spiral);

  // glowing core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 4),
    new THREE.MeshStandardMaterial({
      color: "#bcd6ff",
      emissive: "#9ec5ff",
      emissiveIntensity: 1.4,
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.95
    })
  );
  scene.add(core);

  // halos around the core
  const haloMaterial = new THREE.SpriteMaterial({
    map: puffTextures[0],
    color: "#aac7ff",
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Sprite(haloMaterial);
  halo.scale.setScalar(4.2);
  scene.add(halo);

  const halo2Material = new THREE.SpriteMaterial({
    map: puffTextures[1],
    color: "#ff9ec7",
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo2 = new THREE.Sprite(halo2Material);
  halo2.scale.setScalar(7);
  scene.add(halo2);

  // nebula puff cloud — many sprites, random colors, slow drift
  const puffPalette = ["#7aa6ff", "#b48dff", "#ff8ec3", "#ffb486", "#7ce6ff", "#c0a3ff"];
  const puffs = [];
  for (let i = 0; i < PUFF_COUNT; i += 1) {
    const tex = puffTextures[i % puffTextures.length];
    const color = puffPalette[i % puffPalette.length];
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      opacity: 0.18 + Math.random() * 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      rotation: Math.random() * Math.PI * 2
    });
    const sprite = new THREE.Sprite(mat);
    const orbit = 1.6 + Math.random() * 3.4;
    const orbitAngle = Math.random() * Math.PI * 2;
    sprite.position.set(
      Math.cos(orbitAngle) * orbit,
      (Math.random() - 0.5) * 2.6,
      Math.sin(orbitAngle) * orbit - Math.random() * 2.5
    );
    const baseScale = 2.4 + Math.random() * 3.2;
    sprite.scale.setScalar(baseScale);
    puffs.push({
      sprite,
      baseOpacity: mat.opacity,
      baseScale,
      speed: 0.04 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
      orbit,
      orbitAngle,
      ySpeed: (Math.random() - 0.5) * 0.12
    });
    scene.add(sprite);
  }

  // foreground sparkle stars (cross-flare)
  const sparkles = [];
  const sparkleColors = ["#ffe9b6", "#aee0ff", "#ffc7e8"];
  for (let i = 0; i < 28; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: sparkleColors[i % sparkleColors.length],
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 7,
      (Math.random() - 0.5) * 6 - 1
    );
    const baseScale = 0.18 + Math.random() * 0.45;
    sprite.scale.setScalar(baseScale);
    sparkles.push({
      sprite,
      baseScale,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1.5 + Math.random() * 2.5
    });
    scene.add(sprite);
  }

  // star field
  const starGeometry = buildStars(STAR_COUNT, 9, [0.012, 0.072]);
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 0.13,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(stars);

  const dustGeometry = buildStars(DUST_COUNT, 4.2, [0.02, 0.16]);
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 0.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(dust);

  // ---- animation -------------------------------------------------------

  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerCurrent = new THREE.Vector2(0, 0);
  let lastTime = null;
  let elapsed = 0;
  let listeningMix = 0;

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onPointerMove(event) {
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;
    pointerTarget.set((x - 0.5) * 2, (0.5 - y) * 2);
  }

  function animate(time) {
    const delta = lastTime === null ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    elapsed += delta;

    const state = getState();
    const target = state === AgentState.LISTENING ? 1 : 0;
    listeningMix = THREE.MathUtils.lerp(listeningMix, target, 1 - Math.exp(-4.2 * delta));

    pointerCurrent.lerp(pointerTarget, 1 - Math.exp(-3.2 * delta));
    const pulse = Math.sin(elapsed * (1.3 + listeningMix * 0.8)) * 0.5 + 0.5;

    // core
    core.rotation.x += delta * (0.12 + listeningMix * 0.22);
    core.rotation.y += delta * (0.2 + listeningMix * 0.34);
    core.scale.setScalar(1 + pulse * 0.06 + listeningMix * 0.08);
    core.material.emissiveIntensity = 1.2 + pulse * 0.4 + listeningMix * 0.6;

    // halos
    halo.material.opacity = 0.45 + pulse * 0.18 + listeningMix * 0.18;
    halo.scale.setScalar(4.2 + pulse * 0.4 + listeningMix * 0.6);
    halo.material.rotation += delta * 0.05;
    halo2.material.opacity = 0.22 + (1 - pulse) * 0.12 + listeningMix * 0.18;
    halo2.scale.setScalar(7 + Math.sin(elapsed * 0.6) * 0.5);
    halo2.material.rotation -= delta * 0.03;

    // background spiral — slow majestic spin
    spiral.rotation.z += delta * (0.012 + listeningMix * 0.018);
    spiral.material.opacity = 0.5 + listeningMix * 0.18;

    // puffs orbit + drift + breathe
    for (const p of puffs) {
      p.orbitAngle += delta * p.speed * (0.6 + listeningMix * 0.7);
      p.sprite.position.x = Math.cos(p.orbitAngle) * p.orbit;
      p.sprite.position.z = Math.sin(p.orbitAngle) * p.orbit - 0.5;
      p.sprite.position.y += p.ySpeed * delta;
      if (p.sprite.position.y > 2.5) p.sprite.position.y = -2.5;
      if (p.sprite.position.y < -2.5) p.sprite.position.y = 2.5;
      p.sprite.material.rotation += delta * 0.08 * (p.speed * 4);
      const breathe = 0.5 + 0.5 * Math.sin(elapsed * 0.5 + p.phase);
      p.sprite.material.opacity = p.baseOpacity * (0.7 + breathe * 0.5 + listeningMix * 0.3);
      p.sprite.scale.setScalar(p.baseScale * (1 + breathe * 0.06 + listeningMix * 0.08));
    }

    // sparkles twinkle
    for (const s of sparkles) {
      const k = 0.5 + 0.5 * Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase);
      s.sprite.material.opacity = 0.25 + k * 0.7;
      s.sprite.scale.setScalar(s.baseScale * (0.85 + k * 0.4 + listeningMix * 0.15));
      s.sprite.material.rotation = elapsed * 0.05 + s.twinklePhase;
    }

    // particle fields
    stars.rotation.y += delta * (0.018 + listeningMix * 0.03);
    stars.rotation.x = Math.sin(elapsed * 0.12) * 0.09;
    stars.material.opacity = 0.7 + listeningMix * 0.18;

    dust.rotation.y -= delta * (0.024 + listeningMix * 0.06);
    dust.rotation.x = Math.cos(elapsed * 0.18) * 0.12;
    dust.material.opacity = 0.16 + pulse * 0.09 + listeningMix * 0.18;

    // camera parallax
    camera.position.x = pointerCurrent.x * 0.7;
    camera.position.y = pointerCurrent.y * 0.45 + 0.5;
    camera.lookAt(0, 0, 0);

    // lights
    rim.intensity = 16 + pulse * 4 + listeningMix * 8;
    warmFill.intensity = 12 + (1 - pulse) * 4 + listeningMix * 5;
    magenta.intensity = 8 + pulse * 5 + listeningMix * 6;
    renderer.toneMappingExposure = 1.05 + listeningMix * 0.2;

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);

  // ---- teardown --------------------------------------------------------

  function stop() {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);

    for (const p of puffs) {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
    }
    for (const s of sparkles) {
      scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
    scene.remove(ambient, rim, warmFill, magenta, core, halo, halo2, spiral, stars, dust);

    halo.material.dispose();
    halo2.material.dispose();
    spiral.material.dispose();
    spiral.geometry.dispose();
    core.geometry.dispose();
    core.material.dispose();
    starGeometry.dispose();
    stars.material.dispose();
    dustGeometry.dispose();
    dust.material.dispose();

    for (const tex of disposables) tex?.dispose();

    renderer.dispose();
    renderer.domElement.remove();
  }

  return { stop };
}

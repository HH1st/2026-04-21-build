const auroras = [...document.querySelectorAll(".aurora")];

const driftState = auroras.map((node, index) => ({
  node,
  offset: index * 1200,
  amplitudeX: 52 + index * 18,
  amplitudeY: 34 + index * 14,
  speed: 0.000115 + index * 0.000028,
  glowShift: 14 + index * 7,
  baseOpacity: index === 3 ? 0.72 : 0.64
}));

function animate(now) {
  driftState.forEach((item, index) => {
    const t = now + item.offset;
    const x = Math.sin(t * item.speed) * item.amplitudeX;
    const y = Math.cos(t * (item.speed * 0.84)) * item.amplitudeY;
    const orbit = Math.sin(t * (item.speed * 0.52) + index) * item.glowShift;
    const scale = 1 + Math.sin(t * (item.speed * 0.4)) * 0.085;
    item.node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    item.node.style.opacity = `${item.baseOpacity + Math.sin(t * (item.speed * 0.58) + index) * 0.14}`;
    item.node.style.filter = `blur(${66 + orbit}px)`;
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

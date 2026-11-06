const observedRoots = new WeakSet();

export function enableLiquidButtons(root) {
  if (!root || observedRoots.has(root)) return;
  observedRoots.add(root);

  const initialize = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('.liquid-button')) attachLiquidFill(node);
    node.querySelectorAll('.liquid-button').forEach(attachLiquidFill);
  };

  initialize(root);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') initialize(record.target);
      else record.addedNodes.forEach(initialize);
    }
  });
  observer.observe(root, { attributes:true, attributeFilter:['class'], childList:true, subtree:true });
}

export function attachLiquidFill(button) {
  if (!button || button.dataset.liquidAttached) return;
  button.dataset.liquidAttached = 'true';

  for (const child of [...button.childNodes]) {
    if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
    const label = document.createElement('span');
    label.textContent = child.textContent;
    child.replaceWith(label);
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  button.prepend(canvas);

  const context = canvas.getContext('2d');
  if (!context) return;

  const points = Array.from({ length: 56 }, () => ({ offset: 0, velocity: 0 }));
  const particles = [];
  const bubbles = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let fill = 0;
  let active = false;
  let frame = 0;
  let previousTime = 0;
  let bubbleTimer = 0;

  function resize() {
    const bounds = button.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (active && !frame) frame = requestAnimationFrame(draw);
  }

  function setActive(value) {
    if (active === value) return;
    active = value;
    if (!reducedMotion) {
      const direction = value ? -1 : 1;
      const waveCount = 3 + Math.floor(Math.random() * 3);
      for (let wave = 0; wave < waveCount; wave++) {
        const origin = Math.random() * (points.length - 1);
        const strength = Math.max(28, height * (0.6 + Math.random() * 1.1)) * (0.25 + Math.random() * 0.55);
        const frequency = 0.45 + Math.random() * 1.15;
        const phase = Math.random() * Math.PI * 2;
        const falloff = 0.055 + Math.random() * 0.1;
        const polarity = Math.random() < 0.5 ? -1 : 1;
        for (let index = 0; index < points.length; index++) {
          const distance = Math.abs(index - origin);
          points[index].velocity += direction * polarity * strength * Math.sin(distance * frequency + phase) * Math.exp(-distance * falloff);
        }
      }
    }
    if (active && !reducedMotion) {
      for (let index = 0; index < 7; index++) {
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 10,
          y: height * 0.88,
          vx: (Math.random() - 0.5) * 38,
          vy: -45 - Math.random() * 65,
          life: 0.45 + Math.random() * 0.2
        });
      }
    }
    if (reducedMotion) fill = active ? 1 : 0;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(time) {
    frame = 0;
    if (!width || !height) return;
    const delta = Math.min(0.032, previousTime ? (time - previousTime) / 1000 : 0.016);
    previousTime = time;
    fill += ((active ? 1.045 : 0) - fill) * (1 - Math.exp(-delta * (active ? 3.4 : 5)));

    const base = height * (1 - fill);
    const spring = active ? 32 : 24;
    const coupling = active ? 9 : 18;
    const damping = active ? 4.8 : 5.6;
    if (!reducedMotion) {
      for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const left = points[Math.max(0, index - 1)].offset;
        const right = points[Math.min(points.length - 1, index + 1)].offset;
        const acceleration = -spring * point.offset + coupling * (left + right - 2 * point.offset) - damping * point.velocity;
        point.velocity += acceleration * delta;
        point.offset += point.velocity * delta;
      }
    } else {
      for (const point of points) { point.offset = 0; point.velocity = 0; }
    }

    context.clearRect(0, 0, width, height);
    const surface = points.map((point, index) => ({
      x: (width * index) / (points.length - 1),
      y: Math.min(height + 3, Math.max(-5, base + point.offset))
    }));
    const styles = getComputedStyle(button);
    const liquid = styles.getPropertyValue('--green-strong').trim() || '#37c779';
    const highlight = styles.getPropertyValue('--green').trim() || '#56e596';

    tracePool(surface);
    context.fillStyle = liquid;
    context.fill();

    if (active && fill > 0.12 && !reducedMotion) {
      bubbleTimer += delta;
      if (bubbleTimer >= 0.18) {
        bubbleTimer %= 0.18;
        for (let count = 0; count < 2 && bubbles.length < 16; count++) {
          const radius = 0.45 + Math.random() * 0.65;
          bubbles.push({ x: Math.random() * width, y: height + radius * 1.5, radius, speed: 18 + Math.random() * 16, phase: Math.random() * Math.PI * 2 });
        }
      }
    }
    context.save();
    tracePool(surface);
    context.clip();
    for (let index = bubbles.length - 1; index >= 0; index--) {
      const bubble = bubbles[index];
      bubble.y -= bubble.speed * delta;
      bubble.x += Math.sin(time * 0.004 + bubble.phase) * 0.18;
      const surfaceIndex = Math.min(surface.length - 1, Math.max(0, Math.round((bubble.x / width) * (surface.length - 1))));
      if (bubble.y - bubble.radius <= surface[surfaceIndex].y) { bubbles.splice(index, 1); continue; }
      context.beginPath();
      context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255,255,255,.18)';
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.62)';
      context.lineWidth = 0.8;
      context.stroke();
      context.beginPath();
      context.arc(bubble.x - bubble.radius * 0.32, bubble.y - bubble.radius * 0.32, Math.max(0.35, bubble.radius * 0.2), 0, Math.PI * 2);
      context.fillStyle = 'rgba(255,255,255,.8)';
      context.fill();
    }
    context.restore();

    context.beginPath();
    context.moveTo(surface[0].x, surface[0].y);
    for (let index = 1; index < surface.length; index++) {
      const previous = surface[index - 1];
      const current = surface[index];
      context.quadraticCurveTo(previous.x, previous.y, (previous.x + current.x) / 2, (previous.y + current.y) / 2);
    }
    context.strokeStyle = 'rgba(255,255,255,.35)';
    context.lineWidth = 1.5;
    context.stroke();

    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 260 * delta;
      particle.life -= delta;
      if (particle.life <= 0) { particles.splice(index, 1); continue; }
      context.globalAlpha = Math.min(1, particle.life * 2.5);
      context.beginPath();
      context.arc(particle.x, particle.y, 1.5, 0, Math.PI * 2);
      context.fillStyle = highlight;
      context.fill();
    }
    context.globalAlpha = 1;

    const stillMoving = points.some(point => Math.abs(point.offset) > 0.15 || Math.abs(point.velocity) > 0.8);
    if (active || fill > 0.002 || stillMoving || particles.length || bubbles.length) frame = requestAnimationFrame(draw);
    else previousTime = 0;
  }

  function tracePool(surface) {
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(surface[0].x, surface[0].y);
    for (let index = 1; index < surface.length; index++) {
      const previous = surface[index - 1];
      const current = surface[index];
      const midpoint = (previous.x + current.x) / 2;
      context.quadraticCurveTo(previous.x, previous.y, midpoint, (previous.y + current.y) / 2);
    }
    context.lineTo(width, surface.at(-1).y);
    context.lineTo(width, height);
    context.closePath();
  }

  button.addEventListener('pointerenter', () => setActive(true));
  button.addEventListener('pointerleave', () => setActive(false));
  button.addEventListener('focus', () => setActive(true));
  button.addEventListener('blur', () => setActive(false));
  new ResizeObserver(resize).observe(button);
  resize();
}
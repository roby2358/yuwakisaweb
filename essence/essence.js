(function() {
  const gaussian = (sigma, x) => Math.exp(-(x * x) / (2 * sigma * sigma));

  const exponentialDecay = (gamma, x) => Math.exp(-gamma * x)

  const cauchy = (gamma, x) => (gamma * gamma) / (x * x + gamma * gamma);

  const distance = (p, x, y) => {
    const [dx, dy] = [x - p.x, y - p.y];
    return Math.sqrt(dx * dx + dy * dy);
  }

  const distanceP = (p, q) => distance(p, q.x, q.y);

  const f = (x, y) => {
//    const gamma = 0.0625;
    const gamma = 10;
    const threshold = 0.4;

    const heat = (a, mp, i) => {
      const d = distance(mp, x, y)
      //      const heat = gaussian(gamma, d) + exponentialDecay(1 / gamma, d);
      const heat = cauchy(gamma, d);
      return a + (i + 1) * 0.3333 * heat;
    }

    let value = maxima.reduce(heat, 0);

//    value = 1 / (1 + Math.exp(-(value - threshold)));
//    return Math.min(1, Math.pow(value, 1/3));
    return Math.min(1, value);
  }

  function hsvToRgb(h, s, v) {
    const [r, g, b] = hsvToRgbArray(h, s, v);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function hsvToRgbArray(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
      case 0: [r, g, b] = [v, t, p]; break;
      case 1: [r, g, b] = [q, v, p]; break;
      case 2: [r, g, b] = [p, v, t]; break;
      case 3: [r, g, b] = [p, q, v]; break;
      case 4: [r, g, b] = [t, p, v]; break;
      case 5: [r, g, b] = [v, p, q]; break;
    }

    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  const size = 128;
  const scale = 4;
  const numPoints = 10;

  function coord() {  return Math.floor(Math.random() * size); }

  // Each maximum drifts toward a random destination at its own fixed rate; on
  // arrival (within 1px) it picks a fresh destination and rate. See driftMaxima().
  function newDestination(m) {
    m.tx = Math.random() * size;
    m.ty = Math.random() * size;
    m.rate = 0.5 + Math.random() * 1.5;
    return m;
  }

  function newMaximum() {
    return newDestination({ x: coord(), y: coord() });
  }

  const maxima = [newMaximum(), newMaximum(), newMaximum()];

  function driftMaxima() {
    maxima.forEach(m => {
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= 1) { newDestination(m); return; }
      const step = Math.min(m.rate, d);
      m.x += (dx / d) * step;
      m.y += (dy / d) * step;
    });
  }

  function randomPoint() {
    const x = coord();
    const y = coord();
    return ({ score: f(x, y), x: x, y: y });
  }

  let points = Array.from({ length: 1 }, () => randomPoint());

  const pickRandom = () => points[getRandomInt(0, points.length)];

  const canvas = document.getElementById('plot');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const moveToggle = document.getElementById('move');

  // The field f(x, y) only changes when `maxima` moves (on click), so it is
  // rendered once into this offscreen canvas and blitted each frame rather than
  // recomputed per cell. Call renderField() to refresh it after maxima change.
  const field = document.createElement('canvas');
  field.width = field.height = size;
  const fieldCtx = field.getContext('2d');

  function renderField() {
    const img = fieldCtx.createImageData(size, size);
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // Map the value to hue, where 0 is red and 240 is violet in HSV
        const hue = (1 - f(x, y)) * (240 / 360);
        const [r, g, b] = hsvToRgbArray(hue, 1, .3);
        const i = (y * size + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    fieldCtx.putImageData(img, 0, 0);
  }

  function plot(intensity, x, y) {
    const hue = (1 - f(x, y)) * (240 / 360);
    ctx.fillStyle = hsvToRgb(hue, 1, intensity);
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }

  function plotPoints() {
    points.forEach(p => plot(1, p.x, p.y));
  }

  function plotField() {
    ctx.drawImage(field, 0, 0, size * scale, size * scale);
  }

  function merge(a, b) {
    const aa = a.score + Math.random() / 10;
    const bb = b.score + Math.random() / 10;
    const sum = (aa + bb) == 0 ? 1 : aa + bb;
    const ab = aa / sum;
    const ba = bb / sum;
    let x,y;
    switch (getRandomInt(0, 2)) {
      case 0: [x, y] = [a.x * ab + b.x * ba, a.y * ab + b.y * ba]; break;
      case 1:
        [x, y] = [
          a.x + (a.x - b.x) * ba,
          a.y + (a.y - b.y) * ba
        ];
        break;
      break;
    }
    return {score: f(x,y), x: x, y: y};
  }

  function trim() {
    points.sort((a, b) => b.score - a.score);
    while (points.length > numPoints) {
      points.pop();
    }
  }

  function cycle(ctx) {
    if (moveToggle.checked) {
      driftMaxima();
      points.forEach(p => { p.score = f(p.x, p.y); });
      renderField();
    }

    const r = randomPoint();
    points = [...points, ...points.map(p => merge(p, r)), r];
    trim();

    plotField();
    plotPoints();
  }

  const escapeKey = 27;

  document.addEventListener('keydown', (event) => {
    if (event.keyCode === escapeKey) {
      clearInterval(intervalId);
    }
  });

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / scale);
    const y = Math.floor((event.clientY - rect.top) / scale);
    const maximaIndex = getRandomInt(0, maxima.length);
    maxima[maximaIndex].x = x;
    maxima[maximaIndex].y = y;
    points.forEach(p => { p.score = f(p.x, p.y); })
    renderField();
  });

  renderField();
  plotField();
  plotPoints();

  const intervalId = setInterval(() => { cycle(ctx); }, 100);
})();

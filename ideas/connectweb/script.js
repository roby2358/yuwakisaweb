"use strict";

// DOM + rendering glue. All the math lives in geometry.js (loaded first), which
// exposes the `Geometry` namespace; we pull in just what we use here.
const {
  CANVAS_SIZE,
  scatterDots,
  buildElimination,
  buildDelaunay,
  buildVoronoi,
  noiseScene,
  valueSampler,
  kernelSampler,
  noiseField,
} = Geometry;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const baseInput = document.getElementById("base");
const baseVal = document.getElementById("baseVal");
const showDotsInput = document.getElementById("showDots");
const methodInputs = document.querySelectorAll('input[name="method"]');
const regenBtn = document.getElementById("regen");
const stats = document.getElementById("stats");

function currentMethod() {
  return document.querySelector('input[name="method"]:checked').value;
}

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let dots = [];
// The render payload for the active method: either { edges } (line methods) or
// { triangles, sampler } (noise methods). Rebuilt by recompute(), drawn by draw().
let scene = { edges: [] };

// Overlay the dots (the shared bit between both renderers).
function drawDots() {
  if (!showDotsInput.checked) return;
  ctx.fillStyle = cssColor("--dot");
  for (const p of dots) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Renderer for line methods (elimination / Delaunay / Voronoi).
function drawLines(scene, label) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.strokeStyle = cssColor("--line");
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (const e of scene.edges) {
    ctx.moveTo(e.a.x, e.a.y);
    ctx.lineTo(e.b.x, e.b.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawDots();
  stats.textContent = `${dots.length} dots · ${scene.edges.length} lines · ${label}`;
}

// Renderer for noise methods (value / gradient): rasterize the field to grayscale.
function drawField(scene, label) {
  const W = canvas.width, H = canvas.height;
  const scale = W / CANVAS_SIZE; // device pixels per canvas unit (== dpr)
  const raw = noiseField(W, H, scale, scene.sampler, scene.triangles);

  // Normalize the raw field (gradient noise is signed and scale-dependent) to
  // [0,255] using its actual min/max for full contrast.
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v === v) { if (v < min) min = v; if (v > max) max = v; }
  }
  const span = max - min || 1;

  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v !== v) continue; // NaN: outside the convex hull
    const g = Math.round(((v - min) / span) * 255);
    const k = i * 4;
    data[k] = data[k + 1] = data[k + 2] = g;
    data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  drawDots();
  stats.textContent = `${dots.length} dots · ${scene.triangles.length} triangles · ${label}`;
}

// Single dispatch point for the method discriminator: each entry knows how to
// build its scene and how to render it. Adding a method is one entry here plus
// a radio button — no scattered conditionals.
const METHODS = {
  elimination: { label: "elimination", build: (d) => ({ edges: buildElimination(d) }), draw: drawLines },
  delaunay:    { label: "Delaunay",    build: (d) => ({ edges: buildDelaunay(d) }),    draw: drawLines },
  voronoi:     { label: "Voronoi",     build: (d) => ({ edges: buildVoronoi(d) }),     draw: drawLines },
  noise:       { label: "value noise", build: (d) => noiseScene(d, valueSampler),      draw: drawField },
  gradient:    { label: "gradient noise (smooth kernel)", build: (d) => noiseScene(d, kernelSampler), draw: drawField },
};

function draw() {
  const method = METHODS[currentMethod()];
  method.draw(scene, method.label);
}

// Rebuild the scene from the CURRENT dots with the selected method. Switching
// methods recomputes on the same point set so the views can be compared.
function recompute() {
  scene = METHODS[currentMethod()].build(dots);
  draw();
}

// Scatter a fresh set of dots, size the canvas, then build the web.
function regenerate() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  canvas.style.width = CANVAS_SIZE + "px";
  canvas.style.height = CANVAS_SIZE + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const base = Number(baseInput.value);
  dots = scatterDots(CANVAS_SIZE, CANVAS_SIZE, base);
  recompute();
}

baseInput.addEventListener("input", () => {
  baseVal.textContent = baseInput.value;
});
baseInput.addEventListener("change", regenerate);
showDotsInput.addEventListener("change", draw);
methodInputs.forEach((r) => r.addEventListener("change", recompute));
regenBtn.addEventListener("click", regenerate);

regenerate();

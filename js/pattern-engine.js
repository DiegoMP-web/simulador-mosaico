// js/pattern-engine.js
// Render de 1/4/24 piezas + rotación por modelo (model.rotate) + pintado por capa c1..cN

function getRotation(model, r, c) {
  if (!model || !model.rotate) return 0;

  const rr = r % 2;
  const cc = c % 2;

  // Patrón 2x2 estándar:
  // [0, 90]
  // [270, 180]
  if (rr === 0 && cc === 0) return 0;
  if (rr === 0 && cc === 1) return 90;
  if (rr === 1 && cc === 0) return 270;
  return 180;
}

function paintNode(node, hex) {
  if (!node || !hex) return;

  const tag = (el) => (el.tagName || "").toLowerCase();
  const isShape = (el) => ["path", "polygon", "rect", "circle", "ellipse"].includes(tag(el));

  if (isShape(node)) node.setAttribute("fill", hex);

  node.querySelectorAll("*").forEach(el => {
    if (isShape(el)) el.setAttribute("fill", hex);
  });
}

function applyColors(svgEl, palette) {
  if (!svgEl || !palette) return;

  Object.entries(palette).forEach(([layerId, hex]) => {
    const node = svgEl.querySelector(`#${CSS.escape(layerId)}`);
    paintNode(node, hex);
  });
}

function findLayerId(target, svgRoot) {
  // 1) Intenta con closest (funciona muy bien en SVG modernos)
  if (target && typeof target.closest === "function") {
    const el = target.closest('[id]');
    if (el && el.id && /^c\d+$/i.test(el.id)) return el.id;

    // sube buscando cualquier ancestro con id cN
    let cur = target;
    while (cur && cur !== svgRoot) {
      if (cur.id && /^c\d+$/i.test(cur.id)) return cur.id;
      cur = cur.parentNode;
    }
  }

  // 2) Fallback: caminata clásica
  let cur = target;
  while (cur && cur !== svgRoot) {
    if (cur.id && /^c\d+$/i.test(cur.id)) return cur.id;
    cur = cur.parentNode;
  }
  return null;
}

async function renderPattern({
  container,
  model,
  view,
  palette,
  selectedTileKey,
  onTileSelect,
  onLayerClick
}) {
  if (!container) return;

  // layout
  let rows, cols;
  if (view === 1) { rows = 1; cols = 1; }
  else if (view === 4) { rows = 2; cols = 2; }
  else { rows = 4; cols = 6; }

  container.style.setProperty("--grid-rows", rows);
  container.style.setProperty("--grid-cols", cols);

  container.innerHTML = "";

  if (!model) {
    container.innerHTML = '<div class="empty-state">Elige un modelo para comenzar.</div>';
    return;
  }

  const modelUrl = window.getModelUrl(model);
  const svgText = await window.loadSvgText(modelUrl);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;

      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.key = key;
      if (key === selectedTileKey) tile.classList.add("selected");

      tile.innerHTML = svgText;

      const svgEl = tile.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("width", "100%");
        svgEl.setAttribute("height", "100%");
        svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

        applyColors(svgEl, palette);

        // Rotamos el SVG (no el contenedor) para respetar la boquilla (gap) del grid
        const rot = getRotation(model, r, c);
        svgEl.style.transform = `rotate(${rot}deg)`;
        svgEl.style.transformOrigin = "50% 50%";
        svgEl.style.display = "block";
      }

      tile.addEventListener("click", (ev) => {
        if (typeof onTileSelect === "function") onTileSelect(key);

        const svg = tile.querySelector("svg");
        if (!svg) return;

        const layerId = findLayerId(ev.target, svg);
        if (layerId && typeof onLayerClick === "function") {
          onLayerClick(layerId, key);
        }
      });

      container.appendChild(tile);
    }
  }
}

window.renderPattern = renderPattern;

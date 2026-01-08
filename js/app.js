// js/app.js
// Categorías + miniaturas + paleta global replicada + export PNG

document.addEventListener("DOMContentLoaded", () => {
  let currentModelId = "";
  let currentView = 1;

  let activeColor = null;
  const globalPalette = {}; // layerId -> hex

  const modelSelect = document.getElementById("model-select");
  const modelGrid = document.getElementById("model-grid");
  const modelSearch = document.getElementById("model-search");
  let categoryTabs = document.getElementById("category-tabs");

  const previewGrid = document.getElementById("preview-grid");
  const paletteEl = document.getElementById("palette");

  const btn1 = document.getElementById("view-1-tile");
  const btn4 = document.getElementById("view-4-tiles");
  const btn24 = document.getElementById("view-24-tiles");

  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");

  const metaModelPill = document.getElementById("meta-model-pill");
  const metaViewPill = document.getElementById("meta-view-pill");
  const selectedColorPill = document.getElementById("selected-color-pill");
  const usedCountPill = document.getElementById("used-count-pill");
  const usedColorsEl = document.getElementById("used-colors");

  const CATEGORY_ORDER = ["ALL", "HEXAGONALES", "GEOMETRICOS", "ORGANICOS", "FLORALES", "CLASICOS", "MODERNOS", "CENEFAS"];
  const CATEGORY_LABEL = {
    ALL: "Todos",
    HEXAGONALES: "Hexagonales",
    GEOMETRICOS: "Geométricos",
    ORGANICOS: "Orgánicos",
    FLORALES: "Florales",
    CLASICOS: "Clásicos",
    MODERNOS: "Modernos",
    CENEFAS: "Cenefas"
  };

  let activeCategory = "ALL";

  // ---------- Datos ----------
  function getModels() { return window.MOSAIC_MODELS || []; }
  function getModelById(id) { return getModels().find(m => m.id === id) || null; }
  function isHexModel(model) { return model?.folder === "hex"; }

  // UI: quitar SOLO sufijo " Hex"
  function displayModelName(model) {
    const raw = (model?.name || model?.id || "").trim();
    return raw.replace(/\sHex$/i, "");
  }

  // ---------- Botones de vista dinámicos ----------
  function bindDynamicViewButton(btn){
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const v = Number(btn.dataset.view || 0);
      if (!v) return;
      currentView = v;
      await redraw();
    });
  }
  bindDynamicViewButton(btn1);
  bindDynamicViewButton(btn4);
  bindDynamicViewButton(btn24);

  function syncViewButtonsForModel(model) {
    const hex = isHexModel(model);

    if (hex) {
      // HEX: 1 / 3 / 16
      if (btn1) { btn1.dataset.view = "1";  btn1.textContent = "1 pieza"; }
      if (btn4) { btn4.dataset.view = "3";  btn4.textContent = "3 piezas"; }
      if (btn24) { btn24.dataset.view = "16"; btn24.textContent = "16 piezas"; btn24.style.display = ""; }

      if (![1,3,16].includes(currentView)) currentView = 1;
    } else {
      // CUADRADOS: 1 / 4 / 24
      if (btn1) { btn1.dataset.view = "1";  btn1.textContent = "1 pieza"; }
      if (btn4) { btn4.dataset.view = "4";  btn4.textContent = "4 piezas"; }
      if (btn24) { btn24.dataset.view = "24"; btn24.textContent = "24 piezas"; btn24.style.display = ""; }

      if (![1,4,24].includes(currentView)) currentView = 1;
    }
  }

  function applyViewLayout(view) {
    document.body.dataset.view = String(view);
    if (!previewGrid) return;

    const model = getModelById(currentModelId);
    const hex = isHexModel(model);

    let cols = 2, rows = 2;

    if (hex) {
      if (view === 1) { cols = 1; rows = 1; }
      else if (view === 3) { cols = 2; rows = 2; }
      else { cols = 4; rows = 4; } // 16
    } else {
      if (view === 1) { cols = 1; rows = 1; }
      else if (view === 4) { cols = 2; rows = 2; }
      else { cols = 6; rows = 4; } // 24
    }

    previewGrid.style.setProperty("--grid-cols", String(cols));
    previewGrid.style.setProperty("--grid-rows", String(rows));
  }

  function setActiveViewButton() {
    const buttons = [btn1, btn4, btn24].filter(Boolean);
    buttons.forEach(b => { b.classList.remove("btn-primary"); b.classList.add("btn-outline"); });

    const active = buttons.find(b => Number(b.dataset.view) === Number(currentView));
    if (active) {
      active.classList.add("btn-primary");
      active.classList.remove("btn-outline");
    }
  }

  function findColorMetaByHex(hex){
    const list = window.CBA_COLORS || [];
    const h = (hex || "").toLowerCase();
    return list.find(c => (c.hex || "").toLowerCase() === h) || null;
  }

  function setMeta() {
    const model = getModelById(currentModelId);
    const modelLabel = model ? displayModelName(model) : "—";
    if (metaModelPill) metaModelPill.textContent = `Modelo: ${modelLabel}`;

    if (metaViewPill) {
      const label =
        currentView === 1 ? "1 pieza" :
        currentView === 3 ? "3 piezas" :
        currentView === 4 ? "4 piezas" :
        currentView === 16 ? "16 piezas" :
        currentView === 24 ? "24 piezas" :
        `${currentView} piezas`;
      metaViewPill.textContent = `Vista: ${label}`;
    }
  }

  function updateInfoBar(){
    if (selectedColorPill) {
      if (!activeColor) selectedColorPill.textContent = "Color seleccionado: —";
      else {
        selectedColorPill.innerHTML = `
          <span class="swatch-mini" style="background:${activeColor.hex}"></span>
          Color seleccionado: ${activeColor.id ? activeColor.id + " - " : ""}${activeColor.name} (${activeColor.hex})
        `;
      }
    }

    const usedHex = Object.values(globalPalette).filter(Boolean);
    const uniqueHex = Array.from(new Set(usedHex.map(h => h.toLowerCase())));

    if (usedCountPill) usedCountPill.textContent = `Colores usados: ${uniqueHex.length}`;

    if (usedColorsEl) {
      usedColorsEl.innerHTML = "";
      if (uniqueHex.length === 0) {
        usedColorsEl.innerHTML = `<div style="font-size:13px;color:#666;">Aún no has aplicado colores al mosaico.</div>`;
        return;
      }
      uniqueHex.forEach(hex => {
        const meta = findColorMetaByHex(hex);
        const label = meta ? `${meta.id ? meta.id + " - " : ""}${meta.name}` : hex;
        const chip = document.createElement("div");
        chip.className = "used-chip";
        chip.innerHTML = `
          <span class="swatch-mini" style="background:${hex}"></span>
          <span class="chip-text">${label}</span>
        `;
        usedColorsEl.appendChild(chip);
      });
    }
  }

  // ---------- Paleta ----------
  function renderPalette() {
    if (!paletteEl) return;

    const colors = window.CBA_COLORS || [];
    paletteEl.innerHTML = "";

    if (!colors.length) {
      paletteEl.innerHTML = `<div style="font-size:12px;color:#666;">No hay colores en <code>js/colors.js</code></div>`;
      return;
    }

    colors.forEach((c, idx) => {
      const btn = document.createElement("button");
      btn.className = "color-swatch";
      btn.style.background = c.hex;
      btn.title = `${c.id ? c.id + " - " : ""}${c.name} (${c.hex})`;

      btn.addEventListener("click", () => {
        paletteEl.querySelectorAll(".color-swatch").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        activeColor = c;
        updateInfoBar();
      });

      paletteEl.appendChild(btn);

      if (idx === 0 && !activeColor) {
        activeColor = c;
        btn.classList.add("active");
      }
    });
  }

  // ---------- Motor ----------
  async function renderWithEngine({ container, model, view, palette, onLayerClick }) {
    if (typeof window.renderPattern === "function") {
      await window.renderPattern({ container, model, view, palette, onLayerClick });
      return;
    }
    container.innerHTML = `<div class="empty-state">No encuentro el motor de render.</div>`;
  }

  async function redraw() {
    applyViewLayout(currentView);
    setActiveViewButton();
    setMeta();
    updateInfoBar();

    if (!previewGrid) return;

    const model = getModelById(currentModelId);
    if (!model) {
      previewGrid.innerHTML = `<div class="empty-state">Elige un modelo para comenzar.</div>`;
      return;
    }

    await renderWithEngine({
      container: previewGrid,
      model,
      view: currentView,
      palette: globalPalette,
      onLayerClick: async (layerId) => {
        if (!activeColor) return;
        globalPalette[layerId] = activeColor.hex;
        updateInfoBar();
        await redraw();
      }
    });
  }

  // ---------- Miniaturas ----------
  async function createModelThumbSVG(model) {
    const tmp = document.createElement("div");
    tmp.style.width = "160px";
    tmp.style.height = "160px";
    tmp.style.overflow = "hidden";
    tmp.style.position = "absolute";
    tmp.style.left = "-99999px";
    tmp.style.top = "-99999px";
    document.body.appendChild(tmp);

    try {
      await renderWithEngine({ container: tmp, model, view: 1, palette: {}, onLayerClick: () => {} });
      const svg = tmp.querySelector("svg");
      if (!svg) return null;

      const cloned = svg.cloneNode(true);
      cloned.removeAttribute("width");
      cloned.removeAttribute("height");
      cloned.setAttribute("preserveAspectRatio", "xMidYMid meet");
      return cloned;
    } catch (e) {
      console.warn("[TDM] thumb error:", model?.id, e);
      return null;
    } finally {
      tmp.remove();
    }
  }

  function setActiveModelCard(id) {
    if (!modelGrid) return;
    modelGrid.querySelectorAll(".model-card").forEach(card => {
      card.classList.toggle("active", card.dataset.modelId === id);
    });
  }

  function getFilteredModels() {
    const q = (modelSearch?.value || "").trim().toLowerCase();
    return getModels().filter(m => {
      const catOk = activeCategory === "ALL" ? true : ((m.category || "MODERNOS") === activeCategory);
      const label = `${m.name || ""} ${displayModelName(m)} ${m.id || ""} ${m.category || ""}`.toLowerCase();
      const searchOk = q ? label.includes(q) : true;
      return catOk && searchOk;
    });
  }

  async function renderModelGrid(models) {
    if (!modelGrid) return;
    modelGrid.innerHTML = "";

    for (const m of models) {
      const card = document.createElement("div");
      card.className = "model-card";
      card.dataset.modelId = m.id;

      const thumb = document.createElement("div");
      thumb.className = "model-thumb";
      thumb.innerHTML = `<div style="font-size:12px;color:#777;padding:8px;text-align:center;">Cargando…</div>`;

      const name = document.createElement("div");
      name.className = "model-name";
      name.textContent = displayModelName(m);

      card.appendChild(thumb);
      card.appendChild(name);

      card.addEventListener("click", async () => {
        currentModelId = m.id;
        if (modelSelect) modelSelect.value = m.id;

        syncViewButtonsForModel(m);

        setActiveModelCard(m.id);
        setMeta();
        await redraw();
      });

      modelGrid.appendChild(card);

      const svgEl = await createModelThumbSVG(m);
      if (svgEl) {
        thumb.innerHTML = "";
        thumb.appendChild(svgEl);
      } else {
        thumb.innerHTML = `<div style="font-size:12px;color:#777;padding:8px;text-align:center;">Sin vista previa</div>`;
      }
    }

    if (currentModelId) setActiveModelCard(currentModelId);
  }

  function loadModelsIntoSelect() {
    if (!modelSelect) return;
    modelSelect.innerHTML = `<option value="">Elige un modelo...</option>`;
    getModels().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = displayModelName(m);
      modelSelect.appendChild(opt);
    });
  }

  function ensureCategoryTabs() {
    if (categoryTabs) return;
    if (!modelSearch || !modelSearch.parentElement) return;

    categoryTabs = document.createElement("div");
    categoryTabs.id = "category-tabs";
    categoryTabs.className = "category-tabs";
    modelSearch.insertAdjacentElement("afterend", categoryTabs);
  }

  function renderCategoryTabs() {
    ensureCategoryTabs();
    if (!categoryTabs) return;

    categoryTabs.innerHTML = "";
    CATEGORY_ORDER.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "tab" + (cat === activeCategory ? " active" : "");
      btn.dataset.cat = cat;
      btn.textContent = CATEGORY_LABEL[cat] || cat;

      btn.addEventListener("click", async () => {
        activeCategory = cat;
        categoryTabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        await renderModelGrid(getFilteredModels());
      });

      categoryTabs.appendChild(btn);
    });
  }

  modelSearch?.addEventListener("input", async () => {
    await renderModelGrid(getFilteredModels());
  });

  resetBtn?.addEventListener("click", async () => {
    Object.keys(globalPalette).forEach(k => delete globalPalette[k]);
    updateInfoBar();
    await redraw();
  });

  exportBtn?.addEventListener("click", async () => {
    const model = getModelById(currentModelId);

    const usedHex = Object.values(globalPalette).filter(Boolean);
    const uniqueHex = Array.from(new Set(usedHex.map(h => h.toLowerCase())));

    const usedColors = uniqueHex.map(hex => {
      const meta = findColorMetaByHex(hex);
      return meta ? `${meta.id ? meta.id + " - " : ""}${meta.name}` : hex;
    });

    const modelLabel = model ? displayModelName(model) : "mosaico";

    window.ExportManager?.exportPNG({
      containerId: "preview-grid",
      fileName: `${modelLabel.replace(/\s+/g,"_")}.png`,
      meta: {
        modelName: modelLabel,
        colorsCount: uniqueHex.length,
        colorsList: usedColors
      }
    });
  });

  // ---------- Init ----------
  getModels().forEach(m => { if (!m.category) m.category = "MODERNOS"; });

  loadModelsIntoSelect();
  renderPalette();
  renderCategoryTabs();
  setMeta();
  updateInfoBar();

  renderModelGrid(getModels()).then(async () => {
    if (!currentModelId && getModels().length) {
      currentModelId = getModels()[0].id;
      syncViewButtonsForModel(getModelById(currentModelId));
      setActiveModelCard(currentModelId);
      await redraw();
    }
  });
});

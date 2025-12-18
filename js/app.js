// js/app.js
// Categorías + miniaturas + paleta global replicada + export PNG

document.addEventListener("DOMContentLoaded", () => {
  let currentModelId = "";
  let currentView = 4;
  let activeColorHex = null;

  const globalPalette = {}; // layerId -> hex (replica en todas las piezas)

  const modelSelect = document.getElementById("model-select"); // oculto (compat)
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

  const metaModel = document.getElementById("meta-model");
  const metaView = document.getElementById("meta-view");

  // Categorías soportadas (incluye FLORALES)
  const CATEGORY_ORDER = ["ALL", "GEOMETRICOS", "ORGANICOS", "FLORALES", "CLASICOS", "MODERNOS", "Cenefas",];
  const CATEGORY_LABEL = {
    ALL: "Todos",
    GEOMETRICOS: "Geométricos",
    ORGANICOS: "Orgánicos",
    FLORALES: "Florales",
    CLASICOS: "Clásicos",
    MODERNOS: "Modernos",
    CENEFAS: "Cenefas",
  };

  let activeCategory = "ALL";

  // ---------- Datos ----------
  function getModels() { return window.MOSAIC_MODELS || []; }
  function getModelById(id) { return getModels().find(m => m.id === id) || null; }

  function setMeta() {
    const model = getModelById(currentModelId);
    if (metaModel) metaModel.textContent = `Modelo: ${model ? (model.name || model.id) : "—"}`;
    if (metaView) metaView.textContent = `Vista: ${currentView === 1 ? "1 pieza" : currentView === 4 ? "4 piezas" : "24 piezas"}`;
  }

  function setActiveViewButton() {
    [btn1, btn4, btn24].forEach(b => b && b.classList.remove("btn-primary"));
    [btn1, btn4, btn24].forEach(b => b && b.classList.add("btn-outline"));

    const activeBtn = currentView === 1 ? btn1 : (currentView === 4 ? btn4 : btn24);
    if (activeBtn) {
      activeBtn.classList.add("btn-primary");
      activeBtn.classList.remove("btn-outline");
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
        activeColorHex = c.hex;
      });

      paletteEl.appendChild(btn);

      if (idx === 0 && !activeColorHex) {
        activeColorHex = c.hex;
        btn.classList.add("active");
      }
    });
  }

  // ---------- Motor de render ----------
  async function renderWithEngine({ container, model, view, palette, onLayerClick }) {
    if (typeof window.renderPattern === "function") {
      await window.renderPattern({ container, model, view, palette, onLayerClick });
      return;
    }
    if (window.PatternEngine && typeof window.PatternEngine.render === "function") {
      window.PatternEngine.render({ container, model, view, palette, onLayerClick });
      return;
    }
    container.innerHTML = `<div class="empty-state">No encuentro el motor de render.</div>`;
  }

  async function redraw() {
    setActiveViewButton();
    setMeta();

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
        if (!activeColorHex) return;
        globalPalette[layerId] = activeColorHex;
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
      console.warn("[CBA] thumb error:", model?.id, e);
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
      name.textContent = m.name || m.id;

      card.appendChild(thumb);
      card.appendChild(name);

      card.addEventListener("click", async () => {
        currentModelId = m.id;
        if (modelSelect) modelSelect.value = m.id;
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

  // ---------- Filtros ----------
  function getFilteredModels() {
    const q = (modelSearch?.value || "").trim().toLowerCase();
    return getModels().filter(m => {
      const catOk = activeCategory === "ALL" ? true : ((m.category || "MODERNOS") === activeCategory);
      const label = `${m.name || ""} ${m.id || ""} ${m.category || ""}`.toLowerCase();
      const searchOk = q ? label.includes(q) : true;
      return catOk && searchOk;
    });
  }

  async function refreshModelGrid() {
    await renderModelGrid(getFilteredModels());
  }

  function loadModelsIntoSelect() {
    if (!modelSelect) return;
    modelSelect.innerHTML = `<option value="">Elige un modelo...</option>`;
    getModels().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      modelSelect.appendChild(opt);
    });
  }

  // ---------- Tabs (crear si faltan) ----------
  function ensureCategoryTabs() {
    if (categoryTabs) return;

    // Si no existe, lo creamos debajo del buscador si podemos
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
        await refreshModelGrid();
      });

      categoryTabs.appendChild(btn);
    });
  }

  // ---------- Eventos ----------
  modelSearch?.addEventListener("input", refreshModelGrid);

  btn1?.addEventListener("click", async () => { currentView = 1; await redraw(); });
  btn4?.addEventListener("click", async () => { currentView = 4; await redraw(); });
  btn24?.addEventListener("click", async () => { currentView = 24; await redraw(); });

  resetBtn?.addEventListener("click", async () => {
    Object.keys(globalPalette).forEach(k => delete globalPalette[k]);
    await redraw();
  });

  exportBtn?.addEventListener("click", async () => {
    window.ExportManager?.exportPNG({ containerId: "preview-grid", fileName: "mosaico.png" });
  });

  // ---------- Init ----------
  // Normaliza categorías faltantes
  getModels().forEach(m => { if (!m.category) m.category = "MODERNOS"; });

  loadModelsIntoSelect();
  renderPalette();
  renderCategoryTabs();
  setMeta();

  renderModelGrid(getModels()).then(async () => {
    if (!currentModelId && getModels().length) {
      currentModelId = getModels()[0].id;
      setActiveModelCard(currentModelId);
      await redraw();
    }

  });
});

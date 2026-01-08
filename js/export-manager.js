// js/export-manager.js
// Exporta el contenido SVG del container a PNG y agrega un footer con info

window.ExportManager = (() => {

  async function exportPNG({ containerId, fileName = "mosaico.png", meta = null }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Tomamos el primer SVG visible dentro del contenedor
    const svg = container.querySelector("svg");
    if (!svg) {
      console.warn("[ExportManager] No se encontró SVG para exportar.");
      return;
    }

    // Serializar SVG
    const cloned = svg.cloneNode(true);
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Asegura viewBox si falta
    if (!cloned.getAttribute("viewBox")) {
      const w = svg.getBoundingClientRect().width || 1000;
      const h = svg.getBoundingClientRect().height || 1000;
      cloned.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    const svgString = new XMLSerializer().serializeToString(cloned);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.decoding = "async";

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Tamaño base desde el SVG renderizado
      const rect = svg.getBoundingClientRect();
      const baseW = Math.max(800, Math.round(rect.width));
      const baseH = Math.max(800, Math.round(rect.height));

      // Footer
      const padding = 24;
      const lineH = 22;

      const lines = [];
      if (meta?.modelName) lines.push(`Modelo: ${meta.modelName}`);
      if (typeof meta?.colorsCount === "number") lines.push(`Colores usados: ${meta.colorsCount}`);
      if (meta?.colorsList?.length) {
        // si hay muchos, lo partimos en varias líneas
        const joined = meta.colorsList.join(", ");
        const chunks = splitText(joined, 70);
        chunks.forEach((t, i) => lines.push(i === 0 ? `Colores: ${t}` : `         ${t}`));
      }

      const footerH = lines.length ? (padding + lines.length * lineH + padding) : 0;

      const canvas = document.createElement("canvas");
      canvas.width = baseW;
      canvas.height = baseH + footerH;

      const ctx = canvas.getContext("2d");

      // Fondo blanco total
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dibuja imagen del mosaico centrada
      const scale = Math.min(baseW / img.width, baseH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (baseW - drawW) / 2;
      const dy = (baseH - drawH) / 2;

      ctx.drawImage(img, dx, dy, drawW, drawH);

      // Footer
      if (footerH) {
        const y0 = baseH;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, y0, baseW, footerH);

        ctx.strokeStyle = "rgba(0,0,0,.08)";
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(baseW, y0);
        ctx.stroke();

        ctx.fillStyle = "#111";
        ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        let y = y0 + padding + 4;

        lines.forEach((text, idx) => {
          if (idx === 1) ctx.font = "600 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
          if (idx >= 2) ctx.font = "500 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
          ctx.fillText(text, padding, y);
          y += lineH;
        });
      }

      // Descargar
      const a = document.createElement("a");
      a.download = fileName;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn("[ExportManager] Error cargando SVG como imagen.");
    };

    img.src = url;
  }

  // Divide texto largo en líneas
  function splitText(text, maxLen) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? (cur + " " + w) : w;
      if (next.length > maxLen) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  return { exportPNG };
})();

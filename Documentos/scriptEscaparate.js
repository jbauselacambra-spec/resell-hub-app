/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ResellHub — Script de Extracción de Inventario Vinted (Escaparate)
 * Versión: 2.1 (fix título sobreescrito + parsing de precio europeo)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * INSTRUCCIONES:
 *  1. Abre tu escaparate en Vinted (ordenador / navegador)
 *  2. Haz scroll hasta el final de la página para cargar TODOS los productos
 *  3. Pulsa F12 → pestaña "Consola"
 *  4. Pega este script completo y pulsa Enter
 *  5. El JSON se copia al portapapeles automáticamente (+ descarga de respaldo)
 *  6. Abre ResellHub en tu móvil → Importar → adjunta el .json (o pega el texto)
 *
 * CAMBIOS v2.1:
 *  - FIX CRÍTICO: el título calculado desde el alt (marca/talla/color) se
 *    sobreescribía después con un querySelector que casi nunca encontraba
 *    nada en este tipo de tarjeta → títulos vacíos en la mayoría de productos.
 *    Ahora se usa el título del alt como fuente principal, con fallback a
 *    los selectores DOM solo si el alt no aporta nada útil.
 *  - FIX: parsing de precio soporta formato europeo "1.234,56 €" sin romperse.
 *  - FIX: extracción de ID con fallback al href del enlace del producto.
 *  - Resumen final más claro (encontrados / sin título / sin ID / omitidos).
 * ═══════════════════════════════════════════════════════════════════════════
 */

const scriptResellHub = (() => {
  console.log('🚀 ResellHub v2.1 — Iniciando extracción de escaparate...');

  if (typeof document === 'undefined') {
    console.error('❌ Este script debe ejecutarse en la consola del navegador, sobre la página de Vinted.');
    return;
  }

  // ─── 1. Selectores de contenedores de producto ────────────────────────────
  const items = document.querySelectorAll('.new-item-box__container');

  if (!items.length) {
    console.error('❌ No se encontraron productos.');
    console.error('   Asegúrate de estar en tu escaparate de Vinted.');
    console.error('   Si la página no cargó todos los productos, haz scroll hasta el final primero.');
    return;
  }

  const products = [];
  const seenIds  = new Set();
  const now      = new Date().toISOString();

  let skippedNoId    = 0;
  let skippedNoTitle = 0;
  let skippedDupe    = 0;

  // ─── Helper: parseo de precio robusto a formato europeo ───────────────────
  // Soporta "12,50 €", "1.234,56 €", "12.50", "12" sin confundir separador
  // de miles con decimal.
  function parsePrice(raw) {
    if (!raw) return 0;
    let s = raw.replace(/[^\d.,]/g, '').trim();
    if (!s) return 0;

    const hasComma = s.includes(',');
    const hasDot   = s.includes('.');

    if (hasComma && hasDot) {
      // El último separador es el decimal; el otro es de miles → se elimina
      const lastComma = s.lastIndexOf(',');
      const lastDot    = s.lastIndexOf('.');
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Solo coma → es el separador decimal
      s = s.replace(',', '.');
    }
    // Solo dot o ningún separador → ya es válido para parseFloat

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // ─── Helper: extraer ID robusto ────────────────────────────────────────────
  function extractId(item) {
    const testId = item.getAttribute('data-testid') || '';
    const fromTestId = testId.split('-').pop();
    if (fromTestId && fromTestId !== testId && /^\d+$/.test(fromTestId)) {
      return fromTestId;
    }
    // Fallback: buscar el link del producto → /items/123456789-titulo-slug
    const link = item.querySelector('a[href*="/items/"]');
    if (link) {
      const m = link.getAttribute('href').match(/\/items\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  items.forEach((item) => {
    try {
      // ── ID ────────────────────────────────────────────────────────────────
      const rawId = extractId(item);
      if (!rawId) { skippedNoId++; return; }
      const id = `vinted_${rawId}`;
      if (seenIds.has(id)) { skippedDupe++; return; }
      seenIds.add(id);

      // ── Imagen y alt ──────────────────────────────────────────────────────
      const imgElement = item.querySelector('img[data-testid], img');
      const altText    = imgElement ? (imgElement.alt || '').trim() : '';
      const imageUrl   = imgElement ? imgElement.src : '';

      // ── Título — FUENTE PRINCIPAL: alt-text (antes de la primera coma) ────
      // Alt típico: "Capa de baño Mayoral, marca: Mayoral, talla: 2 años, color: azul"
      let title = (altText.split(',')[0] || '').trim();

      // Fallback SOLO si el alt no dio nada útil (título vacío o genérico)
      if (!title || title.length < 3) {
        const fallbackTitle =
          item.querySelector('[data-testid="item-title"]')?.textContent?.trim() ||
          item.querySelector('.web_ui__Text__title')?.textContent?.trim() ||
          item.querySelector('h2')?.textContent?.trim() || '';
        title = fallbackTitle || '';
      }

      if (!title) skippedNoTitle++; // se registra pero no se descarta el producto

      // ── Marca: buscar "marca: X" en el alt ──────────────────────────────────
      const brandMatch = altText.match(/marca:\s*([^,]+)/i);
      const brand      = brandMatch ? brandMatch[1].trim() : 'Genérico';

      // ── Descripción: construir desde los datos disponibles ────────────────
      const sizMatch   = altText.match(/talla:\s*([^,]+)/i);
      const colorMatch = altText.match(/color:\s*([^,]+)/i);
      let description = title || 'Producto sin título';
      if (brand && brand !== 'Genérico') description += `. Marca: ${brand}`;
      if (sizMatch)   description += `. Talla: ${sizMatch[1].trim()}`;
      if (colorMatch) description += `. Color: ${colorMatch[1].trim()}`;

      // ── Estado: buscar "Vendido" en el texto del contenedor ────────────────
      const innerText = item.innerText || '';
      const isSold     = innerText.toLowerCase().includes('vendido');

      // ── Vistas y Favoritos ──────────────────────────────────────────────────
      const viewsEl = item.querySelector('[data-testid$="--description-title"]');
      const favsEl  = item.querySelector('[data-testid$="--description-subtitle"]');
      const views     = viewsEl ? (parseInt(viewsEl.innerText.replace(/[^0-9]/g, ''), 10) || 0) : 0;
      const favorites = favsEl  ? (parseInt(favsEl.innerText.replace(/[^0-9]/g, ''), 10) || 0) : 0;

      // ── Precio (parser robusto europeo) ─────────────────────────────────────
      const priceEl   = item.querySelector('[data-testid$="--price-text"]');
      const priceText = priceEl ? priceEl.innerText : '0';
      const price     = parsePrice(priceText);

      products.push({
        id,
        title: title || 'Producto sin título',
        brand,
        price,
        description,
        images:    imageUrl ? [imageUrl] : [],
        status:    isSold ? 'sold' : 'available',
        views,
        favorites,
        soldDate:  isSold ? now : null,
        createdAt: now,
      });

    } catch (err) {
      console.warn('⚠️ Error procesando item:', err.message);
    }
  });

  if (!products.length) {
    console.error('❌ Se encontraron contenedores pero no se pudo extraer ningún producto.');
    return;
  }

  const jsonStr = JSON.stringify(products, null, 2);

  // ─── Copiar al portapapeles ────────────────────────────────────────────────
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity  = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (e) {
      return false;
    }
  };

  // ─── Descarga como .json (respaldo) ────────────────────────────────────────
  const downloadJson = (text, filename) => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(text);
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      return false;
    }
  };

  (async () => {
    const active = products.filter(p => p.status === 'available').length;
    const sold   = products.filter(p => p.status === 'sold').length;
    const filename = `resellhub_${Date.now()}.json`;

    const copied     = await copyToClipboard(jsonStr);
    const downloaded  = downloadJson(jsonStr, filename);

    console.log(`\n✅ ResellHub — Extracción completada`);
    console.log(`   📦 Productos activos: ${active}`);
    console.log(`   ✔️  Productos vendidos: ${sold}`);
    console.log(`   📊 Total extraído: ${products.length}`);
    if (skippedNoId)    console.log(`   ⏭️  Omitidos sin ID: ${skippedNoId}`);
    if (skippedDupe)    console.log(`   ⏭️  Omitidos duplicados: ${skippedDupe}`);
    if (skippedNoTitle) console.log(`   ⚠️  Sin título detectado (revisar manualmente): ${skippedNoTitle}`);
    console.log('');
    if (copied) {
      console.log('   📋 JSON copiado al portapapeles ✅');
      console.log('      → Abre ResellHub → Importar → pega o adjunta el archivo');
    } else {
      console.warn('   ⚠️ No se pudo copiar al portapapeles');
    }
    if (downloaded) {
      console.log(`   💾 Archivo descargado: ${filename}`);
    }
    if (!copied && !downloaded) {
      console.error('❌ No se pudo copiar ni descargar. Copia el JSON manualmente:');
      console.log(jsonStr);
    }
  })();

  return products;
})();

/**
 * =========================================================================
 * ResellHub - Script de Extracción: Ventas del Año Actual
 * Versión: 1.0 (Sprint 7)
 * =========================================================================
 *
 * INSTRUCCIONES:
 *  1. Abre Vinted en el navegador del PC → Ve a "Mis pedidos" (ventas)
 *     URL: https://www.vinted.es/my-orders/sold
 *  2. Haz scroll hasta el final para cargar todos los pedidos
 *  3. Abre DevTools (F12) → Consola
 *  4. Pega este script completo y pulsa Enter
 *  5. El JSON se copia al portapapeles automáticamente
 *  6. Abre ResellHub → Importar → Pegar
 *
 * CAMPOS EXTRAÍDOS:
 *  orderId, title, amount, type, status, date, imageUrl
 *  sourceFormat: 'json_sales_current'
 *
 * NOTA: Este script reemplaza el método de "copiar HTML de la página"
 *       que Vinted ya no permite desde su app móvil.
 * =========================================================================
 */

const scriptVentasActuales = (() => {
    console.log('ResellHub v1.0 - Extrayendo ventas del ano actual...');

    const results = [];
    const seenIds = new Set();
    const now     = new Date().toISOString();

    // Selector principal: items de pedidos con data-testid="my-orders-item"
    const items = document.querySelectorAll('[data-testid="my-orders-item"]');

    if (!items.length) {
        // Fallback: buscar por clase de celda
        const fallback = document.querySelectorAll('.web_ui__Cell__cell[href^="/inbox/"]');
        console.warn('Selector primario no encontrado. Items por fallback: ' + fallback.length);
        if (!fallback.length) {
            console.error('ERROR: No se encontraron pedidos.');
            console.error('Asegurate de estar en la pagina de "Mis pedidos vendidos".');
            console.error('URL: https://www.vinted.es/my-orders/sold');
            return;
        }
    }

    const allItems = items.length
        ? Array.from(items)
        : Array.from(document.querySelectorAll('.web_ui__Cell__cell[href^="/inbox/"]'));

    allItems.forEach((item) => {
        try {
            // 1. Order ID desde href del enlace
            const link = item.tagName === 'A'
                ? item
                : item.querySelector('a[href^="/inbox/"]');
            if (!link) return;

            const hrefMatch = (link.getAttribute('href') || '').match(/\/inbox\/(\d+)/);
            if (!hrefMatch) return;
            const orderId = hrefMatch[1];
            if (seenIds.has(orderId)) return;
            seenIds.add(orderId);

            // 2. Titulo
            const titleEl = item.querySelector('[data-testid="my-orders-item--title"]')
                         || item.querySelector('.web_ui__Cell__title');
            const title = titleEl ? titleEl.innerText.trim() : 'Articulo desconocido';

            // 3. Precio (primer h3 con valor numerico)
            let amount = 0;
            const h3s = item.querySelectorAll('h3');
            for (const h3 of h3s) {
                const txt   = h3.innerText.replace(/[^0-9,.]/g, '').replace(',', '.');
                const parsed = parseFloat(txt);
                if (!isNaN(parsed) && parsed > 0) { amount = parsed; break; }
            }

            // 4. Estado desde SVG title
            let status = 'desconocido';
            const svgTitle = item.querySelector('title');
            if (svgTitle) {
                const raw = svgTitle.textContent.toLowerCase();
                if (raw.includes('complet') || raw.includes('finaliz')) status = 'completada';
                else if (raw.includes('proceso'))                        status = 'en_proceso';
                else if (raw.includes('cancel'))                         status = 'cancelada';
                else                                                     status = svgTitle.textContent.trim();
            }

            // 5. Imagen
            const img = item.querySelector('img[data-testid="my-orders-item-image--img"]')
                     || item.querySelector('img');
            const imageUrl = img ? img.src : null;

            // 6. Fecha: no disponible en esta pagina (se rellena en la app)
            results.push({
                orderId,
                title,
                amount,
                type:         'venta',
                status,
                date:         null,
                soldDateReal: null,
                imageUrl,
                sourceFormat: 'json_sales_current',
                extractedAt:  now,
            });

        } catch (err) {
            console.warn('Error en item:', err.message);
        }
    });

    if (!results.length) {
        console.error('No se pudo extraer ninguna venta. Comprueba que hay pedidos visibles en pantalla.');
        return;
    }

    const jsonStr = JSON.stringify(results, null, 2);

    // Copiar al portapapeles
    (async () => {
        let copied = false;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(jsonStr);
                copied = true;
            } else {
                const ta = document.createElement('textarea');
                ta.value = jsonStr;
                ta.style.position = 'fixed';
                ta.style.opacity  = '0';
                document.body.appendChild(ta);
                ta.select();
                copied = document.execCommand('copy');
                document.body.removeChild(ta);
            }
        } catch (e) { /* silencioso */ }

        // Descarga de respaldo
        try {
            const a = document.createElement('a');
            a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr);
            a.download = 'resellhub_ventas_actuales_' + Date.now() + '.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) { /* silencioso */ }

        console.log('');
        console.log('ResellHub - Ventas ano actual');
        console.log('  Ventas extraidas: ' + results.length);
        console.log('  Vendidos: '  + results.filter(r => r.status === 'completada').length);
        console.log('  En proceso: ' + results.filter(r => r.status === 'en_proceso').length);
        console.log('  Portapapeles: ' + (copied ? 'COPIADO OK' : 'FALLO - usa el archivo descargado'));
        console.log('  -> Abre ResellHub -> Importar -> Pegar');
        console.log('  NOTA: La fecha de venta no esta disponible en esta pagina.');
        console.log('        Podras introducirla manualmente en la app.');
    })();

    return results;
})();

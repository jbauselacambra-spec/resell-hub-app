/**
 * =========================================================================
 * ResellHub - Script de Extracción: Historial Completo de Transacciones
 * Versión: 1.0 (Sprint 7)
 * =========================================================================
 *
 * INSTRUCCIONES:
 *  1. Abre Vinted en el navegador del PC → Perfil → Saldo y pagos
 *     URL: https://www.vinted.es/balance
 *     O: Perfil → Ver historial de transacciones
 *  2. Haz scroll hasta el final para cargar TODAS las transacciones
 *  3. Abre DevTools (F12) → Consola
 *  4. Pega este script completo y pulsa Enter
 *  5. El JSON se copia al portapapeles automáticamente
 *  6. Abre ResellHub → Importar → Pegar
 *
 * CAMPOS EXTRAÍDOS:
 *  orderId, title, amount (positivo=venta, negativo=compra),
 *  type (venta/compra), date (ISO), sourceFormat: 'json_sales_history'
 *
 * DIFERENCIAS vs scriptVentasActuales:
 *  - Incluye COMPRAS ademas de ventas
 *  - Incluye FECHA de cada transaccion
 *  - Cubre TODOS los anos, no solo el actual
 *  - No incluye imagenes (la pagina no las muestra)
 * =========================================================================
 */

const scriptHistorialVentas = (() => {
    console.log('ResellHub v1.0 - Extrayendo historial de transacciones...');

    const MONTHS_ES = {
        'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
        'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12
    };

    function parseSpanishDate(str) {
        if (!str) return null;
        const clean = str.trim().toLowerCase();
        const m = clean.match(/(\d{1,2})\s+de\s+([a-z\u00e1\u00e9\u00ed\u00f3\u00fa]+)\s+de\s+(\d{4})/);
        if (!m) return null;
        const d  = m[1].padStart(2, '0');
        const mo = String(MONTHS_ES[m[2]] || 1).padStart(2, '0');
        return m[3] + '-' + mo + '-' + d + 'T12:00:00.000Z';
    }

    function parseAmount(str) {
        if (!str) return 0;
        const clean = str.replace(/[^\d,.\-]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }

    function stripTags(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    const results = [];
    const seenIds = new Set();
    const now     = new Date().toISOString();

    // Selector A: pile__element (historial de transacciones clasico)
    const pileItems = document.querySelectorAll('.pile__element');

    // Selector B: cualquier celda con link a /inbox/
    const cellItems = document.querySelectorAll('a[href^="/inbox/"]');

    const sourceItems = pileItems.length ? pileItems : null;
    const sourceLinks = pileItems.length ? null : cellItems;

    if (!pileItems.length && !cellItems.length) {
        console.error('ERROR: No se encontraron transacciones.');
        console.error('Asegurate de estar en la pagina de historial de transacciones.');
        console.error('URL: https://www.vinted.es/balance o perfil -> transacciones');
        return;
    }

    console.log('Items encontrados: ' + (pileItems.length || cellItems.length));

    const processLink = (link) => {
        const hrefMatch = (link.getAttribute('href') || '').match(/\/inbox\/(\d+)/);
        if (!hrefMatch) return;
        const orderId = hrefMatch[1];
        if (seenIds.has(orderId)) return;
        seenIds.add(orderId);

        // Tipo (Compra / Venta)
        const titleEl = link.querySelector('.web_ui__Cell__title');
        const typeRaw = titleEl ? titleEl.innerText.trim().toLowerCase() : '';
        const type    = typeRaw.includes('venta') ? 'venta'
                      : typeRaw.includes('compra') ? 'compra'
                      : 'desconocido';

        // Titulo del articulo
        const bodyEl = link.querySelector('.web_ui__Cell__body');
        const title  = bodyEl ? bodyEl.innerText.trim() : 'Articulo desconocido';

        // Sufijo: importe + fecha
        const suffixEl = link.querySelector('.web_ui__Cell__suffix');
        let amount = 0;
        let date   = null;

        if (suffixEl) {
            const h2 = suffixEl.querySelector('h2');
            if (h2) {
                amount = parseAmount(h2.innerText);
                // Normalizar signo segun tipo
                if (type === 'venta')  amount =  Math.abs(amount);
                if (type === 'compra') amount = -Math.abs(amount);
            }

            // Fecha: texto que queda tras eliminar el h2
            const suffixHTML = suffixEl.innerHTML;
            const afterH2 = suffixHTML.replace(/<h2[\s\S]*?<\/h2>/i, '');
            const dateText = stripTags(afterH2).trim();
            date = parseSpanishDate(dateText);
        }

        results.push({
            orderId,
            title,
            amount,
            type,
            status:       type === 'venta' ? 'completada' : 'pagado',
            date,
            soldDateReal: type === 'venta' ? date : null,
            soldPriceReal:type === 'venta' ? Math.abs(amount) : null,
            imageUrl:     null,
            sourceFormat: 'json_sales_history',
            extractedAt:  now,
        });
    };

    if (pileItems.length) {
        pileItems.forEach(li => {
            const link = li.querySelector('a[href^="/inbox/"]');
            if (link) processLink(link);
        });
    } else {
        cellItems.forEach(processLink);
    }

    if (!results.length) {
        console.error('No se extrajo ninguna transaccion.');
        return;
    }

    const jsonStr = JSON.stringify(results, null, 2);

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

        try {
            const a = document.createElement('a');
            a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr);
            a.download = 'resellhub_historial_' + Date.now() + '.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) { /* silencioso */ }

        const ventas   = results.filter(r => r.type === 'venta');
        const compras  = results.filter(r => r.type === 'compra');
        const totalV   = ventas.reduce((s, r) => s + Math.abs(r.amount), 0).toFixed(2);
        const totalC   = compras.reduce((s, r) => s + Math.abs(r.amount), 0).toFixed(2);
        const conFecha = results.filter(r => r.date).length;

        console.log('');
        console.log('ResellHub - Historial de transacciones');
        console.log('  Total transacciones: ' + results.length);
        console.log('  Ventas:   ' + ventas.length  + ' (' + totalV + ' EUR)');
        console.log('  Compras:  ' + compras.length + ' (' + totalC + ' EUR)');
        console.log('  Con fecha: ' + conFecha + '/' + results.length);
        console.log('  Portapapeles: ' + (copied ? 'COPIADO OK' : 'FALLO - usa el archivo descargado'));
        console.log('  -> Abre ResellHub -> Importar -> Pegar');
    })();

    return results;
})();

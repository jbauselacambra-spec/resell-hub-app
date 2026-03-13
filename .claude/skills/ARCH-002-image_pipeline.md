# Skill: ARCH-002 - Image Pipeline 🖼️

**Descripción:** Pipeline de procesamiento para invalidar metadatos de Vinted.
**Pasos:**
1. Detectar formato (webp, png, jpg, heic).
2. Convertir a **JPEG** (calidad: 92).
3. **Recortar 1px** por cada lado (top, right, bottom, left).
4. Calcular **MD5 hash** del buffer resultante.
5. Registrar en DB: `{originalPath, processedPath, imageHash, processedAt}`.
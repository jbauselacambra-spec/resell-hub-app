# Skill: DS-002 - Staleness Score Algorithm 🧠

**Fórmula de Puntuación (0-100):**
$score = (days\_factor \times 0.4) + (view\_decay \times 0.25) + (fav\_decay \times 0.2) + (cat\_deviation \times 0.15)$.

**Umbrales de Acción:**
- **Score 100:** Producto estancado, acción inmediata requerida.
- **Frecuencia:** Ejecutar cada 24 horas o al abrir la app.
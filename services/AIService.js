// services/AIService.js
// v2.2: seoTags eliminado del output — tags provienen del diccionario de categorías
const OPENAI_API_KEY = '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'; // <--- PEGA AQUÍ TU KEY REAL

export const AIService = {
  analyzeProduct: async (userTitle) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un experto en ventas de Vinted. Basado en el título, devuelve un JSON con: brand, suggestedTitle, description (vendedora y con emojis), price (solo número), category (categoría principal), subcategory (opcional, subcategoría si aplica)."
            },
            {
              role: "user",
              content: `Analiza este artículo: "${userTitle}"`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const productInfo = JSON.parse(data.choices[0].message.content);
      const category = productInfo.category;
      const subcategory = productInfo.subcategory; // default to null if not found

      function getCategoryTags(category, subcategory) {
        // This function should return the tags based on the categories dictionary
        // It is not shown here, please replace with the actual logic
        // For this example, I'll just return a random string
        return `tags-from-${category}-${subcategory}`;
      }

      function updateProduct(product) {
        const productInfo = JSON.parse(data.choices[0].message.content);
        const category = productInfo.category;
        const subcategory = productInfo.subcategory;
        const tags = getCategoryTags(category, subcategory);
        const updatedProduct = { ...product, tags };
        return updatedProduct;
      }

      return updateProduct(productInfo);
    } catch (error) {
      console.error("Error en OpenAI:", error);
      throw error;
    }
  }
};
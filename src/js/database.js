/**
 * Handles all API communication for the frontend.
 */

const API_BASE_URL = window.location.origin;

/**
 * Performs a fetch request and handles common error scenarios.
 * @param {string} url - The URL to fetch.
 * @param {object} options - The options for the fetch request.
 * @returns {Promise<any>} The JSON response from the server.
 * @throws {Error} If the network response is not ok.
 */
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Respons tidak valid dari server' }));
            throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Fetch Error: ${error.message}`, { url, options });
        // Re-throw the error so the calling function can handle it (e.g., show a UI notification)
        throw error; 
    }
}

/**
 * Searches for products by calling the backend search API.
 * @param {string} query - The search query (SKU or product name).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of product objects.
 */
export function searchProducts(query) {
    const url = new URL(`${API_BASE_URL}/api/search`);
    url.searchParams.set('q', query);
    return apiFetch(url);
}

/**
 * Adds a new product by calling the backend add_product API.
 * @param {object} productData - The product data to add.
 * @returns {Promise<object>} The server response.
 */
export function addProduct(productData) {
    return apiFetch(`${API_BASE_URL}/api/add_product`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
    });
}

/**
 * Updates an existing product by calling the backend update_product API.
 * @param {object} productData - The product data to update, must include SKU.
 * @returns {Promise<object>} The server response.
 */
export function updateProduct(productData) {
    return apiFetch(`${API_BASE_URL}/api/update_product`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
    });
}

/**
 * Enriches a SKU by calling the backend AI enrichment API.
 * @param {string} sku - The SKU to enrich.
 * @param {string} provider - The AI provider to use ('gemini' or 'chatgpt').
 * @returns {Promise<object>} The enriched product data from the AI.
 */
export function enrichWithAI(sku, provider) {
    const url = new URL(`${API_BASE_URL}/api/enrich_with_ai`);
    url.searchParams.set('sku', sku);
    url.searchParams.set('provider', provider);
    return apiFetch(url);
}
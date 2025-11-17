import { displayResults, showAddProductForm } from './ui.js';

async function searchProduct() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    document.getElementById('results-section').innerHTML = `<p style="text-align:center;">Mencari di database lokal...</p>`;
    try {
        const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const products = await searchResponse.json();
        if (products.length > 0) {
            displayResults(products);
        } else {
            if (/^\d{8,}$/.test(query)) {
                document.getElementById('results-section').innerHTML = `<p style="text-align:center;">Produk tidak ditemukan. 🤖 Mencari data online dengan AI...</p>`;
                const aiResponse = await fetch(`/api/enrich_with_ai?sku=${encodeURIComponent(query)}`);
                const result = await aiResponse.json();
                if (!aiResponse.ok) throw new Error(result.error || 'Gagal dari AI.');
                showAddProductForm(result);
            } else {
                document.getElementById('results-section').innerHTML = `<p class="message-info">Tidak ada produk yang cocok ditemukan.</p>`;
            }
        }
    } catch (error) {
        document.getElementById('results-section').innerHTML = `<p class="message-error">Terjadi kesalahan: ${error.message}</p>`;
    }
}

async function submitProduct() {
    const productData = {
        SKU: document.getElementById('SKU').value,
        ITEMS_NAME: document.getElementById('ITEMS_NAME').value,
        CATEGORY: document.getElementById('CATEGORY').value,
        BRAND_NAME: document.getElementById('BRAND_NAME').value,
        VARIANT_NAME: document.getElementById('VARIANT_NAME').value,
        PRICE: document.getElementById('PRICE').value,
    };
    try {
        const response = await fetch('/api/add_product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menyimpan.');
        alert('Produk berhasil ditambahkan!');
        showSearch();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function submitUpdate(sku) {
     const productData = {
        SKU: sku,
        ITEMS_NAME: document.getElementById('ITEMS_NAME').value,
        CATEGORY: document.getElementById('CATEGORY').value,
        BRAND_NAME: document.getElementById('BRAND_NAME').value,
        VARIANT_NAME: document.getElementById('VARIANT_NAME').value,
        PRICE: document.getElementById('PRICE').value,
    };
    try {
        const response = await fetch('/api/update_product', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal memperbarui.');
        alert('Produk berhasil diperbarui!');
        showSearch();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Expose functions to global scope
window.searchProduct = searchProduct;
window.submitProduct = submitProduct;
window.submitUpdate = submitUpdate;
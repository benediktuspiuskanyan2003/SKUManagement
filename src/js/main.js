
import { searchProducts, addProduct, updateProduct, enrichWithAI } from './database.js';
import { displayResults, showSearch, showAddProductForm } from './ui.js';
import { loadCart } from './cart.js';

// --- Global UI Action Functions ---

// Attached to the main search button
window.searchProduct = async function() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput.value.trim();
    const resultsDiv = document.getElementById('results-section');
    
    // If query is empty, treat it as a request to get all products
    const fetchQuery = query === '' ? '*' : query;

    resultsDiv.innerHTML = `<p class="message-info">Mencari...</p>`;

    try {
        const results = await searchProducts(fetchQuery);
        if (results && results.length > 0) {
            displayResults(results);
        } else {
            // If no results for a specific query, show the "add product" form
            if (query !== '') {
                 resultsDiv.innerHTML = ''; // Clear "Mencari..."
                 showAddProductForm({ SKU: query });
            } else {
                 resultsDiv.innerHTML = `<p class="message-info">Tidak ada produk ditemukan.</p>`;
            }
        }
    } catch (error) {
        console.error('Error during search:', error);
        resultsDiv.innerHTML = `<p class="message-error">Terjadi kesalahan: ${error.message}</p>`;
    }
};

// Attached to the "Simpan" button on the Add New Product form
window.submitProduct = async function() {
    const productData = {
        SKU: document.getElementById('SKU').value,
        ITEMS_NAME: document.getElementById('ITEMS_NAME').value,
        CATEGORY: document.getElementById('CATEGORY').value,
        BRAND_NAME: document.getElementById('BRAND_NAME').value,
        VARIANT_NAME: document.getElementById('VARIANT_NAME').value,
        PRICE: document.getElementById('PRICE').value
    };

    if (!productData.SKU || !productData.ITEMS_NAME) {
        alert('SKU dan Nama Produk tidak boleh kosong.');
        return;
    }

    try {
        const result = await addProduct(productData);
        alert('Produk berhasil ditambahkan!');
        // Display the newly added product immediately
        displayResults(result.data);
    } catch (error) {
        console.error('Gagal menyimpan produk:', error);
        alert(`Gagal menyimpan produk: ${error.message}`);
    }
};

// Attached to the "Simpan Perubahan" button on the Edit Product form
window.submitUpdate = async function(originalSku) {
    const updatedData = {
        SKU: originalSku, // Include the original SKU for the backend to identify the product
        ITEMS_NAME: document.getElementById('ITEMS_NAME').value,
        CATEGORY: document.getElementById('CATEGORY').value,
        BRAND_NAME: document.getElementById('BRAND_NAME').value,
        VARIANT_NAME: document.getElementById('VARIANT_NAME').value,
        PRICE: document.getElementById('PRICE').value
    };

    try {
        const result = await updateProduct(updatedData);
        alert('Produk berhasil diperbarui!');
        // Display the updated product immediately
        displayResults(result.data);
    } catch (error) {
        console.error('Gagal memperbarui produk:', error);
        alert(`Gagal memperbarui produk: ${error.message}`);
    }
};

// Attached to the AI enrich button
window.fetchAiData = async function() {
    const skuInput = document.getElementById('SKU');
    const sku = skuInput.value.trim();
    if (!sku) {
        alert('Masukkan SKU untuk diperkaya dengan AI.');
        return;
    }

    const aiProviderSelect = document.getElementById('ai-provider-select');
    const provider = aiProviderSelect.value;

    const button = document.querySelector("button[onclick='fetchAiData()']");
    const originalButtonText = button.innerHTML;
    button.innerHTML = 'Memproses...';
    button.disabled = true;
    aiProviderSelect.disabled = true;

    try {
        // Pass the selected provider to the enrichWithAI function
        const aiData = await enrichWithAI(sku, provider);
        
        // Populate the form with the data received from the AI
        for (const key in aiData) {
            const input = document.getElementById(key.toUpperCase()); // Ensure matching with uppercase IDs
            if (input) {
                input.value = aiData[key];
            }
        }
    } catch (error) {
        console.error('AI Enrichment failed:', error);
        alert(`Gagal mengambil data AI: ${error.message}`);
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
        aiProviderSelect.disabled = false;
    }
};

// --- Download All Products CSV Function (Global) ---
window.downloadAllProductsCSV = async function() {
    console.log("Memulai unduhan CSV semua produk...");
    const button = document.getElementById('download-csv-btn');
    if(button) {
        button.innerHTML = 'Mengunduh...';
        button.disabled = true;
    }

    try {
        const products = await searchProducts('*'); 
        if (!products || products.length === 0) {
            alert("Tidak ada produk untuk diunduh.");
            return;
        }

        const headers = ["SKU", "ITEMS_NAME", "CATEGORY", "BRAND_NAME", "VARIANT_NAME", "PRICE"];
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

        products.forEach(product => {
            const row = headers.map(header => {
                let value = product[header];
                if (value === null || value === undefined) value = '';
                let stringValue = String(value).replace(/"/g, '""');
                if (stringValue.includes(',')) {
                    stringValue = `"${stringValue}"`;
                }
                return stringValue;
            });
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "semua_produk.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Gagal mengunduh CSV:", error);
        alert(`Gagal mengunduh CSV: ${error.message}`);
    } finally {
         if(button) {
            button.innerHTML = 'Unduh Semua Produk';
            button.disabled = false;
        }
    }
};


// --- Scanner Functions ---
let html5QrcodeScanner;
const scanSuccessSound = new Audio('/audio/beep-07a.mp3');

window.startScanner = function() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('scanner-container').style.display = 'block';

    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
    }
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText, decodedResult) => {
            scanSuccessSound.play();
            document.getElementById('search-input').value = decodedText;
            window.stopScanner(); 
            window.searchProduct();
        }, 
        (errorMessage) => { /* ignore */ }
    ).catch((err) => {
        console.error(`Gagal memulai pemindai: ${err}`);
    });
};

window.stopScanner = function() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(err => {
            console.error('Gagal menghentikan pemindai:', err);
        }).finally(() => {
            document.getElementById('main-content').style.display = 'block';
            document.getElementById('scanner-container').style.display = 'none';
        });
    }
};


// --- App Initialization ---
function initializeApp() {
    loadCart();
    showSearch();
    
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            window.searchProduct();
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Clear search input function
window.clearSearchInput = function() {
    document.getElementById('search-input').value = '';
};
import { searchProducts, addProduct, updateProduct, enrichWithAI } from './database.js';
import { displayResults, showSearch, showAddProductForm } from './ui.js';
import { loadCart } from './cart.js';

// --- Global UI Action Functions ---

// Attached to the main search button
window.searchProduct = async function() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput.value.trim();
    const resultsDiv = document.getElementById('results-section');
    
    if (!query) return;

    resultsDiv.innerHTML = `<p class="message-info">Mencari...</p>`;

    try {
        const results = await searchProducts(query);
        if (results && results.length > 0) {
            displayResults(results);
        } else {
            // If no results, show the "add product" form with the SKU pre-filled
            resultsDiv.innerHTML = ''; // Clear "Mencari..."
            showAddProductForm({ SKU: query });
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


// --- Scanner Functions ---
let html5QrcodeScanner;
const scanSuccessSound = new Audio('/audio/beep-07a.mp3'); // Create audio object

window.startScanner = function() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('scanner-container').style.display = 'block';

    // Lazily create the scanner instance
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
    }
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText, decodedResult) => {
            // On successful scan, play sound, stop scanner, pre-fill, and search.
            scanSuccessSound.play(); // Play the beep sound
            document.getElementById('search-input').value = decodedText;
            window.stopScanner(); 
            window.searchProduct();
        }, 
        (errorMessage) => {
            // Error callback, can be ignored.
        }
    ).catch((err) => {
        console.error(`Gagal memulai pemindai: ${err}`);
    });
};

window.stopScanner = function() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            // Success
        }).catch(err => {
            console.error('Gagal menghentikan pemindai:', err);
        }).finally(() => {
            // Always restore the main view
            document.getElementById('main-content').style.display = 'block';
            document.getElementById('scanner-container').style.display = 'none';
        });
    }
};


// --- App Initialization ---
function initializeApp() {
    loadCart(); // Load cart from localStorage
    showSearch(); // Set the initial view
    
    // Add event listener for 'Enter' key on the search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            window.searchProduct();
        }
    });
}

// Run the app initialization once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

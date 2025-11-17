const resultsDiv = document.getElementById('results-section');
const searchInput = document.getElementById('search-input');
let editingSku = null;

// --- Helper Functions ---
function copyToClipboard(text, buttonElement) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = buttonElement.innerHTML;
        buttonElement.innerText = 'Tersalin!';
        buttonElement.disabled = true;
        setTimeout(() => {
            buttonElement.innerText = originalText;
            buttonElement.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Gagal menyalin teks: ', err);
        alert('Gagal menyalin teks.');
    });
}

function clearInput(inputId) {
    document.getElementById(inputId).value = '';
    document.getElementById(inputId).focus();
}

function clearSearchInput() {
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    searchInput.focus();
}


// --- UI View Functions ---
function displayResults(products) {
    // MODIFIED: Mengubah 'Kategori' menjadi 'Produsen'
    let table = `<table id="results-table"><thead><tr><th>SKU</th><th>Nama Produk</th><th>Produsen</th><th>Harga</th><th>Aksi</th></tr></thead><tbody>`;
    products.forEach(p => {
        const price = p.PRICE ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.PRICE) : '';
        // Encode JSON for safe use in HTML onclick attribute
        const safeProductJson = JSON.stringify(p).replace(/'/g, '&#39;');

        table += `
            <tr>
                <td data-label="SKU">
                    ${p.SKU}
                    <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${p.SKU}', this)">Salin</button>
                </td>
                <td data-label="Nama Produk">${p.ITEMS_NAME}</td>
                <td data-label="Produsen">${p.PRODUSEN || ''}</td>
                <td data-label="Harga">${price}</td>
                <td data-label="Aksi">
                    <button class="btn btn-secondary btn-sm" onclick='editProduct(${safeProductJson})'>Edit</button>
                    <button class="btn btn-info btn-sm" onclick='window.addToCart(${safeProductJson})'>+ Keranjang</button>
                </td>
            </tr>`;
    });
    table += `</tbody></table>`;
    resultsDiv.innerHTML = table;
}

function showAddProductForm(product = {}) {
    const isUpdate = product && product.SKU && editingSku;
    const skuValue = product?.SKU || searchInput.value.match(/^\d+$/) ? searchInput.value : '';
    function createInput(id, label, value = '', disabled = false) {
         const finalValue = (value === null || value === undefined) ? '' : value;
         const disabledAttr = disabled ? 'disabled' : '';
         return `
            <div class="form-group">
                <label for="${id}">${label}</label>
                <div class="input-wrapper">
                    <input type="${id === 'PRICE' ? 'number' : 'text'}" id="${id}" value="${finalValue}" ${disabledAttr}> 
                    ${!disabled ? `<button class="clear-btn" onclick="clearInput('${id}')" type="button">&times;</button>` : ''}
                </div>
            </div>
         `;
    }
    resultsDiv.innerHTML = `
        <div id="product-form">
            <h3>${isUpdate ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <div class="form-grid">
                ${createInput('SKU', 'SKU / Barcode', product?.SKU || skuValue, isUpdate)}
                ${createInput('ITEMS_NAME', 'Nama Produk', product?.ITEMS_NAME)}
                ${createInput('PRODUSEN', 'Produsen', product?.PRODUSEN)} 
                ${createInput('BRAND_NAME', 'Merek', product?.BRAND_NAME)}
                ${createInput('VARIANT_NAME', 'Varian', product?.VARIANT_NAME)}
                ${createInput('PRICE', 'Harga', product?.PRICE)}
            </div>
            <div class="form-buttons">
                 <div class="ai-controls" style="margin-right: auto; display: flex; gap: 8px;">
                    <select id="ai-provider-select">
                        <option value="gemini">Gemini</option>
                        <option value="chatgpt">ChatGPT</option>
                    </select>
                    <button type="button" class="btn btn-ai" onclick="fetchAiData()">Isi dengan AI</button>
                 </div>
                <button class="btn" onclick="${isUpdate ? `submitUpdate('${product.SKU}')` : 'submitProduct()'}">${isUpdate ? 'Simpan Perubahan' : 'Simpan'}</button>
                <button class="btn btn-secondary" onclick="showSearch()">Batal</button>
            </div>
        </div>
    `;
    searchInput.value = '';
}

function editProduct(product) {
    editingSku = product.SKU;
    showAddProductForm(product);
}

function showSearch() {
    editingSku = null;
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('scanner-container').style.display = 'none';
}

// Expose functions to global scope for HTML onclick attributes
window.showAddProductForm = showAddProductForm;
window.editProduct = editProduct;
window.clearInput = clearInput;
window.showSearch = showSearch;
window.copyToClipboard = copyToClipboard;
window.clearSearchInput = clearSearchInput;

export { displayResults, showSearch, showAddProductForm };

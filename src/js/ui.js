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
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
        inputElement.value = '';
        inputElement.focus();
         if (inputId === 'VARIANT_NAME') {
            updateVariantButtons('');
        }
    }
}

function setVariantName(unit) {
    const variantInput = document.getElementById('VARIANT_NAME');
    if (variantInput) {
        variantInput.value = unit.toUpperCase();
        variantInput.focus();
        updateVariantButtons(unit.toUpperCase());
    }
}

function updateVariantButtons(currentValue) {
    const buttons = document.querySelectorAll('.btn-variant');
    buttons.forEach(btn => {
        if (btn.innerText.toUpperCase() === currentValue.toUpperCase()) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function clearSearchInput() {
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    searchInput.focus();
}

// --- Smart Paste Functionality ---
async function handleSmartPaste() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        function extractValue(key) {
            const regex = new RegExp(`${key}: ?\\(([^)]+)\\)`, 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        }

        const parsedData = {
            ITEMS_NAME: extractValue('ITEMS_NAME'),
            CATEGORY: extractValue('CATEGORY'),
            BRAND_NAME: extractValue('BRAND'), 
            VARIANT_NAME: extractValue('SATUAN')
        };

        for (const [key, value] of Object.entries(parsedData)) {
            if (value) {
                const inputElement = document.getElementById(key);
                if (inputElement) {
                    inputElement.value = value.toUpperCase();
                    if (key === 'VARIANT_NAME') {
                        updateVariantButtons(value.toUpperCase());
                    }
                }
            }
        }

    } catch (err) {
        console.error('Gagal membaca clipboard atau mem-parsing teks:', err);
        alert('Gagal membaca clipboard. Pastikan Anda telah memberikan izin dan format teks sudah benar.');
    }
}

// --- UI View Functions ---
function displayResults(products) {
    let table = `<table id="results-table"><thead><tr><th>SKU</th><th>Nama Produk</th><th>Merek</th><th>Varian</th><th>Kategori</th><th>Harga</th><th>Aksi</th></tr></thead><tbody>`;
    products.forEach(p => {
        const price = p.PRICE ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.PRICE) : '';
        const safeProductJson = JSON.stringify(p).replace(/'/g, '&#39;');

        table += `
            <tr>
                <td data-label="SKU">
                    ${p.SKU}
                    <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${p.SKU}', this)">Salin</button>
                </td>
                <td data-label="Nama Produk">${p.ITEMS_NAME}</td>
                <td data-label="Merek">${p.BRAND_NAME || ''}</td>
                <td data-label="Varian">${p.VARIANT_NAME || ''}</td>
                <td data-label="Kategori">${p.CATEGORY || ''}</td>
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
    
    const variantOptions = ['PCS', 'RENTENG', 'PACK', 'BOX', 'DUS', 'KARUNG', 'LUSIN', 'GROSS', 'CUP', 'CAN', 'BOTTLE', 'SACH'];
    const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6'];
    const variantButtons = variantOptions.map((opt, index) => 
        `<button type="button" class="btn btn-variant ${colorClasses[index % colorClasses.length]}" onclick="setVariantName('${opt}')">${opt}</button>`
    ).join('');

    function createInput(id, label, value = '', disabled = false, customHtml = '') {
         const finalValue = (value === null || value === undefined) ? '' : value;
         const disabledAttr = disabled ? 'disabled' : '';
         const onInputHandler = id === 'VARIANT_NAME' ? 'oninput="updateVariantButtons(this.value)' : '';

         return `
            <div class="form-group">
                <label for="${id}">${label}</label>
                <div class="input-wrapper">
                    <input type="${id === 'PRICE' ? 'number' : 'text'}" id="${id}" value="${finalValue}" ${disabledAttr} ${onInputHandler}> 
                    ${!disabled ? `<button class="clear-btn" onclick="clearInput('${id}')" type="button">&times;</button>` : ''}
                </div>
                ${customHtml}
            </div>
         `;
    }

    resultsDiv.innerHTML = `
        <div id="product-form">
            <h3>${isUpdate ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <div class="form-grid">
                ${createInput('SKU', 'SKU / Barcode', product?.SKU || skuValue, isUpdate)}
                ${createInput('ITEMS_NAME', 'Nama Produk', product?.ITEMS_NAME)}
                ${createInput('CATEGORY', 'Kategori', product?.CATEGORY)} 
                ${createInput('BRAND_NAME', 'Merek', product?.BRAND_NAME)}
                ${createInput('VARIANT_NAME', 'Varian', product?.VARIANT_NAME, false, `<div class="variant-buttons">${variantButtons}</div>`)}
                ${createInput('PRICE', 'Harga', product?.PRICE)}
            </div>
            <div class="form-buttons">
                 <div class="ai-controls" style="margin-right: auto; display: flex; gap: 8px;">
                    <select id="ai-provider-select">
                        <option value="gemini">Gemini</option>
                        <option value="chatgpt">ChatGPT</option>
                    </select>
                    <button type="button" class="btn btn-ai" onclick="fetchAiData()">Isi dengan AI</button>
                    <button type="button" class="btn btn-secondary" onclick="handleSmartPaste()">Tempel</button> 
                 </div>
                <button class="btn" onclick="${isUpdate ? `submitUpdate('${product.SKU}')` : 'submitProduct()'}">${isUpdate ? 'Simpan Perubahan' : 'Simpan'}</button>
                <button class="btn btn-secondary" onclick="showSearch()">Batal</button>
            </div>
        </div>
    `;
    searchInput.value = '';

    if (product?.VARIANT_NAME) {
        updateVariantButtons(product.VARIANT_NAME);
    }
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
window.handleSmartPaste = handleSmartPaste;
window.setVariantName = setVariantName;
window.updateVariantButtons = updateVariantButtons; // Expose for oninput

export { displayResults, showSearch, showAddProductForm };
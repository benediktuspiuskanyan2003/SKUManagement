
import { addProduct } from './database.js';

const resultsDiv = document.getElementById('results-section');
const searchInput = document.getElementById('search-input');
let editingSku = null;

// --- Add Variant Modal Elements ---
const addVariantModal = document.getElementById('add-variant-modal');
const variantModalSaveBtn = document.getElementById('variant-modal-save-btn');
const variantModalCancelBtn = document.getElementById('variant-modal-cancel-btn');

let parentProductForVariant = null;

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
    const buttons = document.querySelectorAll('#product-form .btn-variant');
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

// --- AI Data Fetching ---
async function fetchAiData() {
    const sku = document.getElementById('SKU').value;
    const nameHint = document.getElementById('ITEMS_NAME').value; 
    const provider = document.getElementById('ai-provider-select').value;
    const button = document.querySelector('.btn-ai');

    if (!sku) {
        alert('Harap masukkan SKU terlebih dahulu.');
        document.getElementById('SKU').focus();
        return;
    }
    
    if (!nameHint) {
        const proceed = confirm("Nama Produk masih kosong. Hasil AI mungkin kurang akurat. Lanjutkan?");
        if (!proceed) {
            document.getElementById('ITEMS_NAME').focus();
            return; 
        }
    }

    const originalButtonText = button.innerHTML;
    button.innerHTML = 'Memproses...';
    button.disabled = true;

    try {
        const url = new URL('/api/enrich_with_ai', window.location.origin);
        url.searchParams.append('sku', sku);
        if (nameHint) {
            url.searchParams.append('name_hint', nameHint);
        }
        url.searchParams.append('provider', provider);

        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal mengambil data dari AI.');
        }

        const data = await response.json();

        if (data.items_name) document.getElementById('ITEMS_NAME').value = data.items_name.toUpperCase();
        if (data.category) document.getElementById('CATEGORY').value = data.category.toUpperCase();
        if (data.brand_name) document.getElementById('BRAND_NAME').value = data.brand_name.toUpperCase();
        if (data.variant_name) {
            document.getElementById('VARIANT_NAME').value = data.variant_name.toUpperCase();
            updateVariantButtons(data.variant_name.toUpperCase());
        }

    } catch (error) {
        console.error('Error fetching AI data:', error);
        alert(`Terjadi kesalahan: ${error.message}`);
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
}


// --- UI View Functions ---
function displayResults(products) {
    let table = `<table id="results-table"><thead><tr><th>SKU</th><th>Nama Produk</th><th>Merek</th><th>Varian</th><th>Kategori</th><th>Harga</th><th>Aksi</th></tr></thead><tbody>`;
    
    const safeProductsListJson = JSON.stringify(products).replace(/'/g, '&#39;');

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
                    <button class="btn btn-success btn-sm" onclick='showAddVariantModal(${safeProductJson}, ${safeProductsListJson})'>(+) Varian</button>
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
    const variantButtonsHTML = variantOptions.map((opt, index) => 
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
                ${createInput('VARIANT_NAME', 'Varian', product?.VARIANT_NAME, false, `<div class="variant-buttons">${variantButtonsHTML}</div>`)}
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

// --- Add Variant Modal Logic ---
function setVariantModalName(unit) {
    const variantInput = document.getElementById('variant-modal-variant-name');
    if (variantInput) {
        variantInput.value = unit.toUpperCase();
        variantInput.focus();
        updateVariantModalButtons(unit.toUpperCase());
    }
}

function updateVariantModalButtons(currentValue) {
    const buttons = document.querySelectorAll('#add-variant-modal .btn-variant');
    buttons.forEach(btn => {
        if (btn.innerText.toUpperCase() === currentValue.toUpperCase()) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function generateNextSku(baseSku, existingProducts) {
    const rootSku = String(baseSku).replace(/[A-Z]$/, '');
    const suffixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const existingSkus = new Set(existingProducts.map(p => p.SKU));

    for (let i = 0; i < suffixes.length; i++) {
        const nextSku = rootSku + suffixes[i];
        if (!existingSkus.has(nextSku)) {
            return nextSku;
        }
    }
    return null; // All suffixes are taken
}

function showAddVariantModal(product, allProducts) {
    parentProductForVariant = product;
    const nextSku = generateNextSku(product.SKU, allProducts);

    if (!nextSku) {
        alert('Tidak dapat membuat SKU varian baru, semua sufiks (A-Z) sudah digunakan.');
        return;
    }
    // --- Create Variant Buttons for Modal ---
    const variantOptions = ['PCS', 'RENTENG', 'PACK', 'BOX', 'DUS', 'KARUNG', 'LUSIN', 'GROSS', 'CUP', 'CAN', 'BOTTLE', 'SACH'];
    const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6'];
    const variantButtonsHTML = variantOptions.map((opt, index) => 
        `<button type="button" class="btn btn-variant ${colorClasses[index % colorClasses.length]}" onclick="setVariantModalName('${opt}')">${opt}</button>`
    ).join('');
    
    document.getElementById('variant-modal-buttons-container').innerHTML = variantButtonsHTML;
    // ---

    document.getElementById('variant-modal-product-name').textContent = product.ITEMS_NAME || '';
    document.getElementById('variant-modal-brand-name').textContent = product.BRAND_NAME || '';
    document.getElementById('variant-modal-category').textContent = product.CATEGORY || '';
    document.getElementById('variant-modal-sku').value = nextSku;
    document.getElementById('variant-modal-variant-name').value = '';
    document.getElementById('variant-modal-price').value = '';

    updateVariantModalButtons(''); // Clear selection
    addVariantModal.classList.add('active');
    document.getElementById('variant-modal-variant-name').focus();
}

function hideAddVariantModal() {
    addVariantModal.classList.remove('active');
    parentProductForVariant = null;
}

async function saveNewVariant() {
    const newVariant = {
        SKU: document.getElementById('variant-modal-sku').value,
        ITEMS_NAME: parentProductForVariant.ITEMS_NAME,
        BRAND_NAME: parentProductForVariant.BRAND_NAME,
        CATEGORY: parentProductForVariant.CATEGORY,
        VARIANT_NAME: document.getElementById('variant-modal-variant-name').value,
        PRICE: document.getElementById('variant-modal-price').value
    };

    if (!newVariant.SKU || !newVariant.VARIANT_NAME) {
        alert('SKU dan Nama Varian Baru tidak boleh kosong.');
        return;
    }

    try {
        const result = await addProduct(newVariant);
        alert('Varian baru berhasil ditambahkan!');
        hideAddVariantModal();
        window.searchProduct(); 
    } catch (error) {
        console.error('Gagal menyimpan varian baru:', error);
        alert(`Gagal menyimpan varian baru: ${error.message}`);
    }
}

// --- Event Listeners & Global Exposure ---
variantModalSaveBtn.addEventListener('click', saveNewVariant);
variantModalCancelBtn.addEventListener('click', hideAddVariantModal);

// Expose functions to global scope for HTML onclick attributes
window.showAddProductForm = showAddProductForm;
window.editProduct = editProduct;
window.clearInput = clearInput;
window.showSearch = showSearch;
window.copyToClipboard = copyToClipboard;
window.clearSearchInput = clearSearchInput;
window.handleSmartPaste = handleSmartPaste;
window.setVariantName = setVariantName;
window.updateVariantButtons = updateVariantButtons; 
window.showAddVariantModal = showAddVariantModal;
window.fetchAiData = fetchAiData; // Expose the new AI function

// Expose MODAL specific functions
window.setVariantModalName = setVariantModalName;
window.updateVariantModalButtons = updateVariantModalButtons;


export { displayResults, showSearch, showAddProductForm };

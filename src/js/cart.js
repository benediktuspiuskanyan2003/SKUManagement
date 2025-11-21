
let cart = [];
const cartSection = document.getElementById('cart-section');
const modal = document.getElementById('confirmation-modal');
const modalProductInfo = document.getElementById('modal-product-info');
const confirmBtn = document.getElementById('modal-confirm-btn');
const cancelBtn = document.getElementById('modal-cancel-btn');
let productToRemove = null;

// --- TOAST NOTIFICATION FUNCTION ---
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function saveCart() {
    localStorage.setItem('skuManagementCart', JSON.stringify(cart));
}

function loadCart() {
    const savedCart = localStorage.getItem('skuManagementCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    displayCart();
}

function addToCart(product) {
    // Ensure product data is uppercase when adding to cart
    const uppercaseProduct = {};
    for (const key in product) {
        if (typeof product[key] === 'string') {
            uppercaseProduct[key] = product[key].toUpperCase();
        } else {
            uppercaseProduct[key] = product[key];
        }
    }

    if (cart.some(p => p.SKU === uppercaseProduct.SKU)) {
        showToast('Produk ini sudah ada di keranjang.');
        return;
    }
    cart.push(uppercaseProduct);
    saveCart();
    displayCart();
    showToast('Produk ditambahkan ke keranjang.');
}

function showConfirmationModal(product) {
    productToRemove = product;
    const price = product.PRICE ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.PRICE) : '<i>(tidak diatur)</i>';
    modalProductInfo.innerHTML = `
        <p><strong>SKU:</strong> ${product.SKU}</p>
        <p><strong>Nama:</strong> ${product.ITEMS_NAME || '<i>(tidak ada nama)</i>'}</p>
        <p><strong>Merek:</strong> ${product.BRAND_NAME || '<i>(tidak ada merek)</i>'}</p>
        <p><strong>Varian:</strong> ${product.VARIANT_NAME || '<i>(tidak ada varian)</i>'}</p>
        <p><strong>Kategori:</strong> ${product.CATEGORY || '<i>(tidak ada kategori)</i>'}</p>
        <p><strong>Harga:</strong> ${price}</p>
    `;
    modal.classList.add('active');
}

function hideModal() {
    modal.classList.remove('active');
    productToRemove = null;
}

function removeFromCart() {
    if (productToRemove) {
        cart = cart.filter(p => p.SKU !== productToRemove.SKU);
        saveCart();
        displayCart();
        showToast('Produk telah dihapus.'); // Show toast on successful removal
    }
    hideModal();
}

function clearCart() {
    if(confirm('Apakah Anda yakin ingin mengosongkan keranjang?')){
        cart = [];
        saveCart();
        displayCart();
        showToast('Keranjang telah dikosongkan.'); // Show toast on clear
    }
}

function displayCart() {
    if (cart.length === 0) {
        cartSection.innerHTML = '';
        return;
    }

    let table = `<h3>Keranjang (${cart.length})</h3><table id="cart-table">
        <thead><tr><th>SKU</th><th>Nama Produk</th><th>Merek</th><th>Varian</th><th>Kategori</th><th>Harga</th><th>Aksi</th></tr></thead>
        <tbody>`;
    
    cart.forEach(p => {
        const price = p.PRICE ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.PRICE) : '';
        table += `
            <tr>
                <td data-label="SKU">${p.SKU}</td>
                <td data-label="Nama Produk">${p.ITEMS_NAME}</td>
                <td data-label="Merek">${p.BRAND_NAME || ''}</td>
                <td data-label="Varian">${p.VARIANT_NAME || ''}</td>
                <td data-label="Kategori">${p.CATEGORY || ''}</td>
                <td data-label="Harga">${price}</td>
                <td data-label="Aksi"><button class="btn btn-danger btn-sm" onclick='showConfirmationModal(${JSON.stringify(p)})'>Hapus</button></td>
            </tr>`;
    });

    table += `</tbody></table>`;
    table += `
        <div class="form-buttons">
            <button class="btn btn-info" onclick="downloadCartCSV()">Unduh Keranjang (CSV)</button>
            <button class="btn btn-danger" onclick="clearCart()">Kosongkan Keranjang</button>
        </div>`;
    cartSection.innerHTML = table;

    const cartTitle = cartSection.querySelector('h3');
    if (cartTitle) {
        cartTitle.classList.add('flash-update');
        setTimeout(() => {
            cartTitle.classList.remove('flash-update');
        }, 700); 
    }
}

function downloadCartCSV() {
    if (cart.length === 0) {
        showToast('Keranjang kosong. Tidak ada data untuk diunduh.', 2500);
        return;
    }

    const storeName = prompt("Silakan masukkan Nama Toko:", "");

    if (storeName === null) {
        showToast("Unduhan dibatalkan.");
        return; 
    }

    const mokaHeaders = [
        'Category', 'SKU', 'Items Name (Do Not Edit)', 
        'Brand Name', 'Variant name', 'Basic - Price'
    ];
    const dataKeys = [
        'CATEGORY', 'SKU', 'ITEMS_NAME', 
        'BRAND_NAME', 'VARIANT_NAME', 'PRICE'
    ];

    let csvContent = "data:text/csv;charset=utf-8," + mokaHeaders.join(",") + "\n";
    cart.forEach(product => {
        const row = dataKeys.map(key => {
            let value = product[key];
            if (value === null || value === undefined) value = '';

            if (typeof value === 'string') {
                value = value.toUpperCase();
            } else {
                value = String(value);
            }

            let stringValue = value.replace(/"/g, '""');
            if (stringValue.includes(',')) {
                stringValue = `"${stringValue}"`;
            }
            return stringValue;
        });
        csvContent += row.join(",") + "\n";
    });

    const cleanStoreName = (storeName.trim() || "TANPA_NAMA").replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const now = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `${cleanStoreName}_${timestamp}.csv`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Unduhan CSV dimulai...");
}


// Event Listeners for Modal
confirmBtn.addEventListener('click', removeFromCart);
cancelBtn.addEventListener('click', hideModal);

// Expose functions to global scope
window.addToCart = addToCart;
window.showConfirmationModal = showConfirmationModal;
window.clearCart = clearCart;
window.downloadCartCSV = downloadCartCSV;

export { loadCart };

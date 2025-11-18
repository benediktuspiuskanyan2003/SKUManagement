
let cart = [];
const cartSection = document.getElementById('cart-section');
const modal = document.getElementById('confirmation-modal');
const modalProductInfo = document.getElementById('modal-product-info');
const confirmBtn = document.getElementById('modal-confirm-btn');
const cancelBtn = document.getElementById('modal-cancel-btn');
let productToRemove = null;

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
        alert('Produk ini sudah ada di keranjang.');
        return;
    }
    cart.push(uppercaseProduct);
    saveCart();
    displayCart();
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
    }
    hideModal();
}

function clearCart() {
    if(confirm('Apakah Anda yakin ingin mengosongkan keranjang?')){
        cart = [];
        saveCart();
        displayCart();
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
            <button class="btn btn-info" onclick="downloadCartCSV()">Unduh CSV Keranjang</button>
            <button class="btn btn-danger" onclick="clearCart()">Kosongkan Keranjang</button>
        </div>`;
    cartSection.innerHTML = table;
}

function downloadCartCSV() {
    if (cart.length === 0) {
        alert('Keranjang kosong. Tidak ada data untuk diunduh.');
        return;
    }

    const headers = ['SKU', 'ITEMS_NAME', 'CATEGORY', 'BRAND_NAME', 'VARIANT_NAME', 'PRICE'];
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

    cart.forEach(product => {
        const row = headers.map(header => {
            let value = product[header];
            if (value === null || value === undefined) {
                value = '';
            }

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

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "produk_keranjang_uppercase.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

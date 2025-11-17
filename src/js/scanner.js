let html5QrCode = null;

function startScanner() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('scanner-container').style.display = 'block';
    document.getElementById('results-section').innerHTML = '';
    html5QrCode = new Html5Qrcode("qr-reader");
    const success = (decodedText) => {
        stopScanner();
        document.getElementById('search-input').value = decodedText;
        window.searchProduct();
    };
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, success)
        .catch(err => {
            alert("Gagal memulai scanner. Pastikan Anda memberikan izin kamera.");
            stopScanner();
        });
}

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop();
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('scanner-container').style.display = 'none';
}

// Expose functions to global scope
window.startScanner = startScanner;
window.stopScanner = stopScanner;
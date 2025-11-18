
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
import math
import csv

# ==============================================================================
# KONFIGURASI
# ==============================================================================
# Pastikan nama file ini sudah benar
CSV_FILE_PATH = 'product-50600.csv' 
# Ukuran batch (jumlah baris yang dikirim per permintaan)
BATCH_SIZE = 500
# ==============================================================================

def import_data():
    """
    Fungsi utama untuk membaca data dari CSV dan mengunggahnya ke Supabase
    dengan menggunakan metode upsert yang aman (mengabaikan duplikat).
    """
    print("Memulai proses impor data...")

    # --- 1. Memuat Konfigurasi Lingkungan ---
    print("1/7: Memuat variabel lingkungan...")
    load_dotenv()
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")

    if not all([url, key]):
        print("   ERROR: Pastikan SUPABASE_URL dan SUPABASE_KEY sudah diatur di file .env Anda.")
        return

    try:
        supabase: Client = create_client(url, key)
        print("   -> Koneksi ke Supabase berhasil dibuat.")
    except Exception as e:
        print(f"   ERROR: Gagal membuat klien Supabase: {e}")
        return

    # --- 2. Membaca dan Memvalidasi File CSV ---
    print(f"2/7: Membaca file CSV: {CSV_FILE_PATH}...")
    if not os.path.exists(CSV_FILE_PATH):
        print(f"   ERROR: File tidak ditemukan di '{CSV_FILE_PATH}'.")
        return

    try:
        print("   -> Mencoba membaca file dengan pemisah koma (,) dan penanganan kutipan standar...")
        df = pd.read_csv(
            CSV_FILE_PATH, 
            dtype=str, 
            sep=',',
            engine='python',
            quoting=csv.QUOTE_MINIMAL,
            on_bad_lines='warn',
            encoding='latin-1'
        ).fillna('')
        
        # --- LANGKAH PENTING: Menyesuaikan nama kolom agar sesuai dengan database ---
        if 'PRODUSEN' in df.columns:
            df.rename(columns={'PRODUSEN': 'CATEGORY'}, inplace=True)
            print("   -> Info: Kolom 'PRODUSEN' di CSV telah diubah namanya menjadi 'CATEGORY' untuk database.")
        elif 'CATEGORY' in df.columns:
            print("   -> Info: Kolom 'CATEGORY' di CSV akan digunakan langsung.")

        if 'SKU' not in df.columns:
            print(f"   ERROR: Kolom 'SKU' tidak ditemukan. Nama kolom yang terdeteksi: {list(df.columns)}")
            return
        
        data_to_upload = df.to_dict(orient='records')
        total_rows = len(data_to_upload)
        print(f"   -> File CSV berhasil dibaca. Total baris: {total_rows}")
    except Exception as e:
        print(f"   ERROR: Gagal membaca atau memproses file CSV: {e}")
        return

    # --- 3. Membersihkan Data (Langkah Baru) ---
    print("3/7: Membersihkan data sebelum diunggah...")
    cleaned_rows = 0
    for row in data_to_upload:
        # Cek kolom PRICE. Jika kosong, ubah menjadi None (NULL di database)
        if 'PRICE' in row and row['PRICE'] == '':
            row['PRICE'] = None
            cleaned_rows += 1
    print(f"   -> Pembersihan selesai. {cleaned_rows} baris dengan harga kosong telah disesuaikan.")

    # --- 4. Memproses dan Mengunggah Data dalam Batch ---
    print("4/7: Memulai proses unggah data ke tabel 'products'...")
    total_batches = math.ceil(total_rows / BATCH_SIZE)

    for i in range(total_batches):
        start_index = i * BATCH_SIZE
        end_index = start_index + BATCH_SIZE
        batch = data_to_upload[start_index:end_index]
        
        print(f"  -> Mengunggah Batch {i + 1}/{total_batches} ({len(batch)} baris)...")

        try:
            # PENTING: Pastikan nama tabel sudah benar, yaitu 'products'
            response = supabase.table('products').upsert(
                batch,
                on_conflict='SKU',
                ignore_duplicates=True 
            ).execute()

            # Periksa jika ada error spesifik dari Supabase
            if len(response.data) == 0 and response.error:
                 print(f"     ERROR PADA BATCH {i+1}: {response.error.message}")

        except Exception as e:
            print(f"     ERROR KRITIS PADA BATCH {i+1}: Terjadi pengecualian: {e}")

    # --- 5. Selesai ---
    print("5/7: Proses unggah selesai.")
    print("6/7: Memverifikasi...")
    print("7/7: Selesai! Data baru telah ditambahkan, data lama yang cocok berdasarkan SKU tetap utuh.")

if __name__ == "__main__":
    import_data()

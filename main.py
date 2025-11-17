from flask import Flask, request, jsonify, render_template
from supabase import create_client, Client
import os
import google.generativeai as genai
# --- IMPORT BARU UNTUK GOOGLE CUSTOM SEARCH API ---
from googleapiclient.discovery import build
import json

# Konfigurasi Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Konfigurasi Gemini AI
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- KONFIGURASI BARU UNTUK GOOGLE SEARCH API ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.environ.get("GOOGLE_CSE_ID")

app = Flask(__name__, static_folder='src', static_url_path='/')

@app.route('/')
def index():
    return app.send_static_file('index.html')

# --- ENDPOINT AI DENGAN PENCARIAN GOOGLE SEARCH API RESMI ---
@app.route('/api/enrich_with_ai')
def enrich_with_ai():
    sku = request.args.get('sku', '')
    if not sku:
        return jsonify({'error': 'SKU/Barcode diperlukan'}), 400

    try:
        if not GEMINI_API_KEY:
            raise ValueError("Kunci API Gemini (GEMINI_API_KEY) tidak ditemukan.")
        if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
            raise ValueError("Kunci Google Search API (GOOGLE_API_KEY) atau CSE ID (GOOGLE_CSE_ID) tidak ditemukan.")

        # LANGKAH 1: Lakukan pencarian resmi via Google Custom Search API
        def google_search(search_term, api_key, cse_id, num=5):
            service = build("customsearch", "v1", developerKey=api_key)
            res = service.cse().list(q=search_term, cx=cse_id, num=num).execute()
            return res.get('items', [])

        search_results = google_search(sku, GOOGLE_API_KEY, GOOGLE_CSE_ID)
        
        if not search_results:
            return jsonify({'error': 'Tidak ada hasil pencarian Google API yang ditemukan untuk SKU ini.'}), 404

        # Format hasil pencarian menjadi konteks untuk AI
        search_context = "\n".join([f"Title: {res.get('title', '')}\nSnippet: {res.get('snippet', '')}\nURL: {res.get('link', '')}" for res in search_results])

        # LANGKAH 2: Berikan konteks ke AI untuk dianalisis
        model = genai.GenerativeModel('gemini-pro-latest')

        prompt = f"""
        Anda adalah asisten data entry yang sangat teliti. Berdasarkan konteks hasil pencarian Google berikut, identifikasi informasi produk yang paling akurat untuk barcode: {sku}.

        Konteks Hasil Pencarian:
        ---
        {search_context}
        ---

        Tugas Anda adalah menganalisis konteks di atas dan mengembalikan satu objek JSON yang ketat. Jangan mengarang informasi. Jika informasi tidak ada di konteks, kembalikan string kosong "".

        - "ITEMS_NAME": Nama produk utama, lengkap dengan berat/volume (contoh: "Gentle Gen Deterjen Tumbuhan Mint Bomb 700 ML").
        - "CATEGORY": Nama perusahaan produsen (misal: "PT Wings Surya"). Jika nama produsen tidak ditemukan secara eksplisit, gunakan nilai dari "BRAND_NAME" sebagai gantinya.
        - "BRAND_NAME": Merek produk (misal: "Gentle Gen").
        - "VARIANT_NAME": Satuan unit ("PCS", "Botol", "Pack"). Gunakan "PCS" jika tidak jelas.
        - "PRICE": Harga dalam Rupiah (hanya angka). Beri nilai 0 jika tidak ada.

        Sangat penting: Hanya kembalikan satu objek JSON yang valid berdasarkan konteks yang diberikan.
        """

        response = model.generate_content(prompt)
        
        if not response.text:
            raise ValueError("Respons dari AI kosong atau tidak valid.")

        cleaned_response = response.text.strip().replace('```json', '').replace('```', '').strip()
        
        if not cleaned_response:
            raise ValueError("Respons dari AI tidak berisi data JSON setelah dibersihkan.")

        product_data = json.loads(cleaned_response)
        return jsonify(product_data)

    except Exception as e:
        error_message = f'Gagal memproses permintaan AI. Detail: {str(e)}'
        print(f"Error in enrich_with_ai endpoint: {e}")
        # Penanganan error spesifik bisa ditambahkan di sini jika perlu
        return jsonify({'error': error_message}), 500


@app.route('/api/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    try:
        search_query = query.upper()
        response = supabase.table('products').select('*').or_(f'SKU.eq.{search_query},ITEMS_NAME.ilike.%{search_query}%').execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Error fetching data from Supabase: {e}")
        return jsonify({"error": "Failed to fetch data"}), 500

@app.route('/api/add_product', methods=['POST'])
def add_product():
    product_data = request.get_json()

    if not product_data or not product_data.get('SKU') or not product_data.get('ITEMS_NAME'):
        return jsonify({'error': 'SKU dan Nama Produk diperlukan'}), 400

    try:
        price_str = product_data.get('PRICE')
        if price_str and str(price_str).strip():
            product_data['PRICE'] = float(price_str)
        else:
            product_data['PRICE'] = None
    except (ValueError, TypeError):
        return jsonify({'error': 'Harga harus berupa angka yang valid'}), 400

    processed_data = {
        key: value.upper() if isinstance(value, str) else value
        for key, value in product_data.items()
    }

    try:
        response = supabase.table('products').insert(processed_data).execute()
        
        if response.data:
            return jsonify({'success': True, 'data': response.data}), 201
        else:
            error_message = 'Gagal menambahkan produk, SKU mungkin sudah ada'
            if hasattr(response, 'error') and response.error:
                error_message = response.error.message
            return jsonify({'error': error_message}), 409

    except Exception as e:
        print(f"Error inserting data to Supabase: {e}")
        return jsonify({'error': 'Kesalahan internal server'}), 500

@app.route('/api/update_product', methods=['PUT'])
def update_product():
    product_data = request.get_json()
    sku = product_data.get('SKU')

    if not sku:
        return jsonify({'error': 'SKU diperlukan untuk update'}), 400

    update_data = {}

    for field in ['ITEMS_NAME', 'CATEGORY', 'BRAND_NAME', 'VARIANT_NAME']:
        if field in product_data and product_data[field] is not None:
            update_data[field] = str(product_data[field]).upper()
        else:
            update_data[field] = None

    try:
        price_value = product_data.get('PRICE')
        if price_value and str(price_value).strip():
            update_data['PRICE'] = float(price_value)
        else:
            update_data['PRICE'] = None
    except (ValueError, TypeError):
        return jsonify({'error': 'Harga harus berupa angka yang valid'}), 400

    try:
        supabase.table('products').update(update_data).eq('SKU', sku).execute()

        fetch_response = supabase.table('products').select('*').eq('SKU', sku).single().execute()

        if fetch_response.data:
            return jsonify({'success': True, 'data': [fetch_response.data]}), 200
        else:
            return jsonify({'error': 'Gagal menyimpan. SKU tidak ditemukan di database.'}), 404

    except Exception as e:
        print(f"Error updating data in Supabase: {e}")
        return jsonify({'error': 'Kesalahan internal server'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)

from flask import Flask, request, jsonify, render_template
from supabase import create_client, Client
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__, static_folder='src', static_url_path='/')

@app.route('/')
def index():
    return app.send_static_file('index.html')

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

    # --- LOGIKA BARU YANG LEBIH AMAN ---
    update_data = {}

    # 1. Proses semua field yang berupa teks.
    for field in ['ITEMS_NAME', 'CATEGORY', 'BRAND_NAME', 'VARIANT_NAME']:
        if field in product_data and product_data[field] is not None:
            update_data[field] = str(product_data[field]).upper()
        else:
            # Pastikan field yang kosong atau tidak ada dikirim sebagai null
            update_data[field] = None

    # 2. Proses field PRICE secara terpisah dan eksplisit.
    try:
        price_value = product_data.get('PRICE')
        if price_value and str(price_value).strip():
            update_data['PRICE'] = float(price_value)
        else:
            update_data['PRICE'] = None
    except (ValueError, TypeError):
        return jsonify({'error': 'Harga harus berupa angka yang valid'}), 400
    # --- AKHIR LOGIKA BARU ---

    try:
        # Gunakan `update_data` yang sudah bersih.
        supabase.table('products').update(update_data).eq('SKU', sku).execute()

        # Selalu ambil data terbaru dari database sebagai sumber kebenaran.
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

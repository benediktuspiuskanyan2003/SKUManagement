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
        # PERBAIKAN: Menggunakan nama kolom 'ITEMS_NAME' yang benar
        response = supabase.table('products').select('*').or_(f'SKU.eq.{search_query},ITEMS_NAME.ilike.%{search_query}%').execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Error fetching data from Supabase: {e}")
        return jsonify({"error": "Failed to fetch data"}), 500

@app.route('/api/add_product', methods=['POST'])
def add_product():
    product_data = request.get_json()

    # PERBAIKAN: Memeriksa kunci 'ITEMS_NAME' yang benar
    if not product_data or not product_data.get('SKU') or not product_data.get('ITEMS_NAME'):
        return jsonify({'error': 'SKU dan Nama Produk diperlukan'}), 400

    # ATURAN: Ubah semua nilai string menjadi huruf besar
    # Ini akan memproses semua kunci (CATEGORY, SKU, dll) apa adanya
    processed_data = {
        key: value.upper() if isinstance(value, str) else value
        for key, value in product_data.items()
    }

    try:
        response = supabase.table('products').insert(processed_data).execute()
        
        if response.data:
            return jsonify({'success': True, 'data': response.data}), 201
        else:
            return jsonify({'error': 'Gagal menambahkan produk, SKU mungkin sudah ada'}), 409

    except Exception as e:
        print(f"Error inserting data to Supabase: {e}")
        return jsonify({'error': 'Kesalahan internal server'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=8080)
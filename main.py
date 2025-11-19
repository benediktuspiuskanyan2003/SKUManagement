
import os
import json
import google.generativeai as genai
import openai
from flask import Flask, request, jsonify, render_template, send_from_directory
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- App Initialization and Configuration ---
app = Flask(__name__, static_folder='src', template_folder='src')

# --- Supabase and AI Configuration ---
# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Initialize AI clients
# Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
# OpenAI (New v1.0.0+ syntax)
openai_client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# --- Helper Function for Uppercasing Data ---
def uppercase_data(data):
    """
    Recursively converts all string values in a dictionary to uppercase.
    """
    for key, value in data.items():
        if isinstance(value, str):
            data[key] = value.upper()
    return data

# --- Frontend Routes ---
@app.route("/")
def index():
    """
    Serves the main application page.
    """
    return render_template("index.html")

# Serve static files like CSS, JS
@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('src', path)


# --- API Routes ---
@app.route("/api/search")
def search():
    query = request.args.get('q', '').upper() # Uppercase the search query
    if not query:
        return jsonify([])

    try:
        if query == '*':
            # If the query is a wildcard, select all products
            response = supabase.table('products').select('*').execute()
        else:
            # Otherwise, perform a search based on SKU or ITEMS_NAME
            # The data in the DB is already uppercase, so we search with an uppercase query
            response = supabase.table('products').select('*').or_(f'SKU.ilike.%{query}%,ITEMS_NAME.ilike.%{query}%').execute()
        
        return jsonify(response.data)

    except Exception as e:
        print(f"Supabase search error: {e}")
        return jsonify({"error": "Terjadi kesalahan saat mencari data di database."}), 500

@app.route("/api/add_product", methods=['POST'])
def add_product():
    data = uppercase_data(request.json)
    # Convert empty string for PRICE to None, so it becomes NULL in the database
    if 'PRICE' in data and data['PRICE'] == '':
        data['PRICE'] = None

    try:
        response = supabase.table('products').insert(data).execute()
        # The data from the response is already in the correct list format
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        print(f"Supabase insert error: {e}")
        # Return a JSON error response with a 500 status code
        return jsonify({"error": f"Gagal menambahkan produk ke database: {str(e)}"}), 500


@app.route("/api/update_product", methods=['PUT'])
def update_product():
    data = uppercase_data(request.json)
    sku = data.pop('SKU', None)
    if not sku:
        return jsonify({"error": "SKU is required"}), 400
    
    # Convert empty string for PRICE to None, so it becomes NULL in the database
    if 'PRICE' in data and data['PRICE'] == '':
        data['PRICE'] = None

    try:
        # First, update the product
        supabase.table('products').update(data).eq('SKU', sku.upper()).execute()
        # Then, fetch the complete updated record to send back to the frontend
        updated_data_response = supabase.table('products').select('*').eq('SKU', sku.upper()).execute()

        return jsonify({"status": "success", "data": updated_data_response.data})
    except Exception as e:
        print(f"Supabase update error: {e}")
        # Return a JSON error response with a 500 status code
        return jsonify({"error": f"Gagal memperbarui produk di database: {str(e)}"}), 500

@app.route("/api/enrich_with_ai")
def enrich_with_ai():
    sku = request.args.get('sku')
    name_hint = request.args.get('name_hint', '') # Get product name hint
    provider = request.args.get('provider', 'gemini')

    if not sku:
        return jsonify({"error": "SKU is required"}), 400

    # Build the prompt dynamically
    prompt_intro = f"Anda adalah asisten data produk yang akurat. Berikan data untuk produk dengan SKU/barcode '{sku}'"
    if name_hint:
        prompt_intro += f" dan nama produk yang mirip dengan '{name_hint}'"
    
    prompt_intro += " dalam format JSON."

    prompt = f"""{prompt_intro}
Nama field harus huruf kecil dan snake_case: 'items_name', 'category', 'brand_name', dan 'variant_name'.
Untuk field 'category', isi dengan nama perusahaan manufaktur legal (PT, CV, Corp, Ltd., dsb).

PENTING: Jika Anda tidak dapat menemukan informasi yang 100% akurat dan terverifikasi untuk sebuah field, Anda WAJIB mengembalikan string kosong "" untuk field tersebut. JANGAN MENEBAK atau mengarang informasi. 
Pastikan outputnya hanya JSON, tanpa formatting markdown atau teks tambahan."""

    try:
        if provider == 'chatgpt':
            completion = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an accurate product data assistant that only outputs JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            response_text = completion.choices[0].message.content
        else: # Default to Gemini
            model = genai.GenerativeModel('gemini-pro')
            generation_config = genai.types.GenerationConfig(temperature=0.2)
            response = model.generate_content(prompt, generation_config=generation_config)
            response_text = response.text

        # Clean the response to ensure it's valid JSON
        clean_response = response_text.strip().replace('\n', '').replace('`', '')
        if clean_response.startswith('json'):
            clean_response = clean_response[4:]

        ai_data = json.loads(clean_response)
        return jsonify(ai_data)

    except Exception as e:
        print(f"Error calling AI API: {e}")
        return jsonify({"error": f"Gagal memanggil AI API: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8080)

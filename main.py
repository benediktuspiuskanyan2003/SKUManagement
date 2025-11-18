
import os
import json
import google.generativeai as genai
import openai
from functools import wraps
from flask import Flask, request, jsonify, render_template, session, send_from_directory
from flask_session import Session
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- App Initialization and Configuration ---
app = Flask(__name__, static_folder='src', template_folder='src')

# --- Session Configuration ---
# Load secret key for session management
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")
if not app.config["SECRET_KEY"]:
    raise ValueError("SECRET_KEY tidak ditemukan di file .env. Mohon buat kunci rahasia.")

# Configure session to use the filesystem (server-side)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
app.config['SESSION_FILE_DIR'] = './.flask_session'
Session(app)


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

# --- Decorators for Authentication ---
def login_required(f):
    """
    Decorator to ensure a user is logged in before accessing a route.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"error": "Akses ditolak. Silakan login terlebih dahulu."}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Authentication Routes ---
@app.route("/api/login", methods=["POST"])
def login():
    """
    Handles user login.
    """
    password = request.json.get("password")
    correct_password = os.environ.get("LOGIN_PASSWORD")

    if not correct_password:
         return jsonify({"error": "LOGIN_PASSWORD tidak diatur di server."}), 500

    if password == correct_password:
        session["logged_in"] = True
        return jsonify({"message": "Login berhasil"}), 200
    else:
        return jsonify({"error": "Password salah"}), 401

@app.route("/api/logout")
def logout():
    """
    Handles user logout.
    """
    session.clear()
    return jsonify({"message": "Logout berhasil"}), 200

@app.route("/api/status")
def status():
    """
    Checks the current login status.
    """
    is_logged_in = session.get("logged_in", False)
    return jsonify({"logged_in": is_logged_in}), 200

# --- Frontend Routes ---
@app.route("/")
def index():
    """
    Serves the main application or the login page.
    """
    if not session.get("logged_in"):
        return render_template("login.html")
    return render_template("index.html")

@app.route("/login")
def login_page():
    """
    Explicitly serves the login page.
    """
    return render_template("login.html")

# Serve static files like CSS, JS
@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('src', path)


# --- Protected API Routes ---
@app.route("/api/search")
@login_required
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])

    try:
        if query == '*':
            # If the query is a wildcard, select all products
            response = supabase.table('products').select('*').execute()
        else:
            # Otherwise, perform a search based on SKU or ITEMS_NAME
            response = supabase.table('products').select('*').or_(f'SKU.ilike.%{query}%,ITEMS_NAME.ilike.%{query}%').execute()
        
        return jsonify(response.data)

    except Exception as e:
        print(f"Supabase search error: {e}")
        return jsonify({"error": "Terjadi kesalahan saat mencari data di database."}), 500

@app.route("/api/add_product", methods=['POST'])
@login_required
def add_product():
    data = request.json
    response = supabase.table('products').insert(data).execute()
    return jsonify({"status": "success", "data": response.data})


@app.route("/api/update_product", methods=['PUT'])
@login_required
def update_product():
    data = request.json
    sku = data.pop('SKU', None)
    if not sku:
        return jsonify({"error": "SKU is required"}), 400
    
    response = supabase.table('products').update(data).eq('SKU', sku).execute()
    updated_data = supabase.table('products').select('*').eq('SKU', sku).execute()

    return jsonify({"status": "success", "data": updated_data.data})

@app.route("/api/enrich_with_ai")
@login_required
def enrich_with_ai():
    sku = request.args.get('sku')
    provider = request.args.get('provider', 'gemini') # Default to Gemini

    if not sku:
        return jsonify({"error": "SKU is required"}), 400

    # MODIFIED: Stricter prompt to prevent guessing.
    prompt = f"""Anda adalah asisten data produk yang akurat. Berikan data untuk produk dengan SKU/barcode '{sku}' dalam format JSON. 
Nama field harus huruf kecil dan snake_case: 'items_name', 'category', 'brand_name', dan 'variant_name'.
Untuk field 'category', isi dengan nama perusahaan manufaktur legal (PT, CV, Corp, Ltd., dsb).

PENTING: Jika Anda tidak dapat menemukan informasi yang 100% akurat dan terverifikasi untuk sebuah field, Anda WAJIB mengembalikan string kosong "" untuk field tersebut. JANGAN MENEBAK atau mengarang informasi. 
Pastikan outputnya hanya JSON, tanpa formatting markdown atau teks tambahan."""

    try:
        if provider == 'chatgpt':
            # MODIFIED: Added temperature parameter to reduce creativity.
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
            # MODIFIED: Added generation_config with temperature.
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

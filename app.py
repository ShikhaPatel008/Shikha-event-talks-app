import re
import os
import requests
import sqlite3
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
DB_FILE = "releases.db"

# Simple manual dotenv parser
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

load_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Check if Supabase credentials are configured and not placeholders
def is_supabase_active():
    return (
        SUPABASE_URL and 
        SUPABASE_KEY and 
        "your-project" not in SUPABASE_URL and 
        "your-anon" not in SUPABASE_KEY
    )

# --------------------------------------------------------------------------
# SQLite Cache Fallback Layer
# --------------------------------------------------------------------------
def init_sqlite():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS bigquery_releases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                category TEXT,
                html TEXT,
                text TEXT,
                link TEXT,
                UNIQUE(date, category, link) ON CONFLICT IGNORE
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        # Seed default theme if not present
        c.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('theme', 'dark')")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"SQLite init error: {e}")

# Initialize SQLite database file on start
init_sqlite()

def get_sqlite_releases():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, date, category, html, text, link FROM bigquery_releases ORDER BY id DESC")
    rows = c.fetchall()
    releases = [dict(row) for row in rows]
    conn.close()
    return releases

def save_sqlite_releases(releases):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    for item in releases:
        c.execute('''
            INSERT OR IGNORE INTO bigquery_releases (date, category, html, text, link)
            VALUES (?, ?, ?, ?, ?)
        ''', (item['date'], item['category'], item['html'], item['text'], item['link']))
    conn.commit()
    conn.close()

def get_sqlite_setting(key):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def save_sqlite_setting(key, value):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

# --------------------------------------------------------------------------
# Supabase Integration Layer (Direct REST API)
# --------------------------------------------------------------------------
def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

def get_supabase_releases():
    if not is_supabase_active():
        return None
    try:
        url = f"{SUPABASE_URL}/rest/v1/bigquery_releases?select=*"
        response = requests.get(url, headers=get_supabase_headers(), timeout=5)
        if response.status_code == 200:
            # Sort by id desc for standard order
            releases = response.json()
            releases.sort(key=lambda x: x.get('id', 0), reverse=True)
            return releases
        print(f"Supabase GET releases failed: {response.status_code} - {response.text}")
        return None
    except Exception as e:
        print(f"Supabase GET releases connection error: {e}")
        return None

def save_supabase_releases(releases):
    if not is_supabase_active():
        return False
    try:
        # Fetch existing to avoid duplicates if table doesn't have unique constraint
        existing = get_supabase_releases() or []
        existing_keys = { (x['date'], x['category'], x['link']) for x in existing if 'date' in x }
        
        new_items = []
        for item in releases:
            key = (item['date'], item['category'], item['link'])
            if key not in existing_keys:
                new_items.append({
                    "date": item['date'],
                    "category": item['category'],
                    "html": item['html'],
                    "text": item['text'],
                    "link": item['link']
                })
        
        if new_items:
            url = f"{SUPABASE_URL}/rest/v1/bigquery_releases"
            response = requests.post(url, headers=get_supabase_headers(), json=new_items, timeout=5)
            return response.status_code in [200, 201]
        return True
    except Exception as e:
        print(f"Supabase POST releases error: {e}")
        return False

def get_supabase_setting(key):
    if not is_supabase_active():
        return None
    try:
        url = f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.{key}&select=value"
        response = requests.get(url, headers=get_supabase_headers(), timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data[0]['value'] if data else None
        return None
    except Exception as e:
        print(f"Supabase GET setting error: {e}")
        return None

def save_supabase_setting(key, value):
    if not is_supabase_active():
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/app_settings"
        # Upsert using POST with resolution preferences or try POST and update if fail
        payload = {"key": key, "value": value}
        headers = get_supabase_headers().copy()
        headers["Prefer"] = "resolution=merge-duplicates"
        response = requests.post(url, headers=headers, json=payload, timeout=5)
        
        # Fallback if upsert header isn't supported or fails: try PUT
        if response.status_code not in [200, 201]:
            url_put = f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.{key}"
            response = requests.put(url_put, headers=get_supabase_headers(), json={"value": value}, timeout=5)
            
        return response.status_code in [200, 201, 204]
    except Exception as e:
        print(f"Supabase POST setting error: {e}")
        return False

# --------------------------------------------------------------------------
# XML Parser & Feed Sync
# --------------------------------------------------------------------------
def clean_text(html_content):
    text = re.sub('<[^<]+?>', '', html_content)
    text = " ".join(text.split())
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return text

def sync_release_feed():
    parsed_items = []
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        for entry in root.findall('atom:entry', ns):
            date_str = entry.find('atom:title', ns).text or "Unknown Date"
            updated_str = entry.find('atom:updated', ns).text or ""
            link_elem = entry.find('atom:link', ns)
            entry_link = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', ns)
            if content_elem is None or not content_elem.text:
                continue
                
            content_html = content_elem.text.strip()
            parts = re.split(r'<h3>(.*?)</h3>', content_html)
            
            if parts[0].strip():
                clean_html = parts[0].strip()
                parsed_items.append({
                    "date": date_str,
                    "category": "General",
                    "html": clean_html,
                    "text": clean_text(clean_html),
                    "link": entry_link
                })
            
            for i in range(1, len(parts), 2):
                if i + 1 < len(parts):
                    category = parts[i].strip()
                    html_chunk = parts[i+1].strip()
                    
                    anchor = f"#{date_str.replace(' ', '_')}"
                    item_link = entry_link if entry_link else f"https://docs.cloud.google.com/bigquery/docs/release-notes{anchor}"

                    parsed_items.append({
                        "date": date_str,
                        "category": category,
                        "html": f"<h3>{category}</h3>\n{html_chunk}",
                        "text": clean_text(html_chunk),
                        "link": item_link
                    })
        
        # Save parsed entries to active DB (Supabase + Local SQLite as fallback)
        if is_supabase_active():
            save_supabase_releases(parsed_items)
        save_sqlite_releases(parsed_items)
        
    except Exception as e:
        print(f"Error fetching/parsing XML feed: {e}")

# --------------------------------------------------------------------------
# Flask Routes
# --------------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    # Sync live feed into database first
    sync_release_feed()
    
    # Try fetching from Supabase, fallback to SQLite
    data = None
    source = "SQLite Fallback Database"
    
    if is_supabase_active():
        data = get_supabase_releases()
        if data is not None:
            source = "Active Supabase Database"
            
    if data is None:
        data = get_sqlite_releases()
        
    return jsonify({
        "title": "BigQuery Release Notes",
        "updates": data,
        "source": source
    })

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        req_data = request.get_json() or {}
        theme = req_data.get('theme', 'dark')
        
        # Save theme setting to DB
        saved_ok = False
        if is_supabase_active():
            saved_ok = save_supabase_setting('theme', theme)
        
        save_sqlite_setting('theme', theme)
        return jsonify({"success": True, "theme": theme, "supabase_synced": saved_ok})
    
    else:
        # GET setting
        theme = None
        if is_supabase_active():
            theme = get_supabase_setting('theme')
        
        if theme is None:
            theme = get_sqlite_setting('theme')
            
        return jsonify({"theme": theme or "dark"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

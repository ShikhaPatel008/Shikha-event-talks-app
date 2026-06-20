import re
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_text(html_content):
    # Remove HTML tags to get clean plain text
    text = re.sub('<[^<]+?>', '', html_content)
    # Remove extra spaces, newlines, and tabs
    text = " ".join(text.split())
    # Unescape common HTML entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return text

def parse_release_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return {"error": "Failed to fetch feed from Google Cloud. Please try again later."}, 500

    try:
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        feed_title = root.find('atom:title', ns)
        feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"

        releases = []
        # Unique ID counter
        update_id = 1

        for entry in root.findall('atom:entry', ns):
            date_str = entry.find('atom:title', ns).text or "Unknown Date"
            updated_str = entry.find('atom:updated', ns).text or ""
            link_elem = entry.find('atom:link', ns)
            entry_link = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', ns)
            if content_elem is None or not content_elem.text:
                continue
                
            content_html = content_elem.text.strip()
            
            # Split by <h3> to extract multiple updates (e.g., Features, Announcements, Issues) within a single day
            parts = re.split(r'<h3>(.*?)</h3>', content_html)
            
            # If there's text before the first <h3>, add it as General
            if parts[0].strip():
                clean_html = parts[0].strip()
                plain_txt = clean_text(clean_html)
                releases.append({
                    "id": update_id,
                    "date": date_str,
                    "updated": updated_str,
                    "category": "General",
                    "html": clean_html,
                    "text": plain_txt,
                    "link": entry_link
                })
                update_id += 1
            
            # Process categories and their HTML blocks
            for i in range(1, len(parts), 2):
                if i + 1 < len(parts):
                    category = parts[i].strip()
                    html_chunk = parts[i+1].strip()
                    
                    plain_txt = clean_text(html_chunk)
                    
                    # Construct proper anchor link if entry link exists
                    anchor = f"#{date_str.replace(' ', '_')}"
                    item_link = entry_link if entry_link else f"https://docs.cloud.google.com/bigquery/docs/release-notes{anchor}"

                    releases.append({
                        "id": update_id,
                        "date": date_str,
                        "updated": updated_str,
                        "category": category,
                        "html": f"<h3>{category}</h3>\n{html_chunk}",
                        "text": plain_txt,
                        "link": item_link
                    })
                    update_id += 1
                    
        return {
            "title": feed_title_text,
            "updates": releases
        }, 200

    except Exception as e:
        print(f"Error parsing feed: {e}")
        return {"error": f"Failed to parse XML feed. Details: {str(e)}"}, 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    data, status = parse_release_feed()
    return jsonify(data), status

if __name__ == '__main__':
    app.run(debug=True, port=5000)

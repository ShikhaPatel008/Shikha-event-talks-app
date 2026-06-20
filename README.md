# BigQuery Release Radar & X-Post Composer 📡

A modern, high-performance web dashboard built with **Python Flask** and **Vanilla HTML, CSS, and JS**. This application fetches the official live Google Cloud BigQuery Release Notes RSS/Atom feed, parses and splits complex daily updates (like multiple Features or Issues on the same day) into individual items, and provides a sleek interface to search, filter, and draft updates to share on **X (formerly Twitter)**.

---

## 🚀 Key Features

*   **Live XML Feed Parser**: Pulls data directly from the official Google Cloud BigQuery feeds.
*   **Granular Update Splitting**: Automatically extracts individual updates from daily entries, allowing you to Tweet or copy specific notes.
*   **Instant Search & Filters**: Live client-side full-text search and category filtering (Feature, Issue, Announcement, General).
*   **Draft Post Composer**:
    *   One-click "Tweet This" drawer interface.
    *   **Auto-Draft** mode: Truncates and templates updates cleanly to fit within X's 280-character limit.
    *   **Bullets Format**: Automatically converts technical updates into bulleted lists.
    *   Direct publishing integration via Twitter Web Intents.
*   **Premium Visual Design**: Dark space theme, glassmorphism card panels (`backdrop-filter`), hover scaling, and status counts.

---

## 🛠️ Tech Stack

*   **Backend**: Python 3.x, Flask, Requests, XML ElementTree (standard library)
*   **Frontend**: Plain HTML5, CSS3 Grid/Flexbox, Vanilla Javascript (ES6+)
*   **Icons**: FontAwesome 6

---

## 📂 Project Structure

```text
bigquery-release-tracker/
├── app.py                 # Flask server & XML parsing engine
├── templates/
│   └── index.html         # Main dashboard layout template
├── static/
│   ├── app.js             # Client logic, filters, and Tweet composer
│   └── style.css          # Theme styles, animation, and responsive layout
├── .gitignore             # Git ignore patterns
└── README.md              # Project documentation (this file)
```

---

## 💻 Quick Start & Setup

### 1. Prerequisites
Ensure you have Python 3.x installed.

### 2. Install Dependencies
Run the following command to install the required libraries:
```bash
pip install flask requests
```

### 3. Run the Development Server
Navigate to the project directory and launch `app.py`:
```bash
python app.py
```

### 4. Access the App
Open your web browser and navigate to:
*   **Web Dashboard**: [http://127.0.0.1:5000](http://127.0.0.1:5000)
*   **Parsed Data API**: [http://127.0.0.1:5000/api/releases](http://127.0.0.1:5000/api/releases)

---

## 📝 Configuration override
To customize the application behavior or run configurations, refer to Flask command line options or adjust host/port settings inside the `app.py` entrypoint.

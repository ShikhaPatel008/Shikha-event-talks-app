// State Management
let updatesState = {
    title: "BigQuery Release Notes",
    updates: [],
    filteredUpdates: [],
    selectedUpdate: null,
    currentCategory: "all",
    searchQuery: "",
    sortBy: "newest"
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    spinnerIcon: document.getElementById('spinner-icon'),
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statIssues: document.getElementById('stat-issues'),
    statAnnouncements: document.getElementById('stat-announcements'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    categoryFilters: document.querySelectorAll('.filter-tag'),
    sortSelect: document.getElementById('sort-select'),
    lastUpdatedTime: document.getElementById('last-updated-time'),
    errorBanner: document.getElementById('error-banner'),
    feedSubtitle: document.getElementById('feed-subtitle'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    cardsContainer: document.getElementById('cards-container'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    themeCheckbox: document.getElementById('theme-checkbox'),
    
    // Tweet Drawer Elements
    tweetDrawer: document.getElementById('tweet-drawer'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    closeDrawerBtn: document.getElementById('close-drawer-btn'),
    sourceDate: document.getElementById('source-date'),
    sourceCategory: document.getElementById('source-category'),
    sourceText: document.getElementById('source-text'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    sendTweetBtn: document.getElementById('send-tweet-btn'),
    
    // Auto Formatter buttons
    formatShortenBtn: document.getElementById('format-action-shorten'),
    formatBulletsBtn: document.getElementById('format-action-bullets'),
    formatClearBtn: document.getElementById('format-action-clear')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        elements.themeCheckbox.checked = true;
        document.body.classList.add('light-theme');
    }
    
    fetchReleases();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Refresh feed
    elements.refreshBtn.addEventListener('click', fetchReleases);
    
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        updatesState.searchQuery = e.target.value.toLowerCase();
        elements.clearSearch.style.display = updatesState.searchQuery ? 'block' : 'none';
        applyFiltersAndRender();
    });
    
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        updatesState.searchQuery = '';
        elements.clearSearch.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Category filters
    elements.categoryFilters.forEach(button => {
        button.addEventListener('click', (e) => {
            elements.categoryFilters.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updatesState.currentCategory = button.getAttribute('data-category');
            applyFiltersAndRender();
        });
    });
    
    // Sort
    elements.sortSelect.addEventListener('change', (e) => {
        updatesState.sortBy = e.target.value;
        applyFiltersAndRender();
    });
    
    // Drawer Close
    elements.closeDrawerBtn.addEventListener('click', closeDrawer);
    elements.drawerBackdrop.addEventListener('click', closeDrawer);
    
    // Character Counter
    elements.tweetTextarea.addEventListener('input', updateCharCount);
    
    // Drawer Composition format actions
    elements.formatShortenBtn.addEventListener('click', () => formatDraft('shorten'));
    elements.formatBulletsBtn.addEventListener('click', () => formatDraft('bullets'));
    elements.formatClearBtn.addEventListener('click', () => formatDraft('clear'));
    
    // Export and Theme switches
    elements.exportCsvBtn.addEventListener('click', exportToCSV);
    elements.themeCheckbox.addEventListener('change', toggleTheme);
    
    // Post and Copy
    elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    elements.sendTweetBtn.addEventListener('click', sendTweetToTwitter);
    
    // Alert close
    const alertClose = document.querySelector('.alert-close');
    if (alertClose) {
        alertClose.addEventListener('click', () => {
            elements.errorBanner.style.display = 'none';
        });
    }
}

// Fetch Data from Server API
async function fetchReleases() {
    showLoading(true);
    elements.errorBanner.style.display = 'none';
    
    try {
        const response = await fetch('/api/releases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        updatesState.title = data.title;
        updatesState.updates = data.updates || [];
        
        // Update last updated timestamp
        const now = new Date();
        elements.lastUpdatedTime.textContent = now.toLocaleTimeString();
        
        // Populate and render
        updateStats();
        applyFiltersAndRender();
        
    } catch (error) {
        console.error("Fetch releases error:", error);
        elements.errorBanner.style.display = 'flex';
        showLoading(false);
    }
}

// Update stats cards in sidebar
function updateStats() {
    const list = updatesState.updates;
    const total = list.length;
    const features = list.filter(item => item.category.toLowerCase() === 'feature').length;
    const issues = list.filter(item => item.category.toLowerCase() === 'issue').length;
    const announcements = list.filter(item => item.category.toLowerCase() === 'announcement').length;
    
    elements.statTotal.textContent = total;
    elements.statFeatures.textContent = features;
    elements.statIssues.textContent = issues;
    elements.statAnnouncements.textContent = announcements;
}

// Loading Spinner State Controls
function showLoading(isLoading) {
    if (isLoading) {
        elements.spinnerIcon.classList.add('spin');
        elements.refreshBtn.disabled = true;
        elements.loadingState.style.display = 'flex';
        elements.cardsContainer.style.display = 'none';
        elements.emptyState.style.display = 'none';
    } else {
        elements.spinnerIcon.classList.remove('spin');
        elements.refreshBtn.disabled = false;
        elements.loadingState.style.display = 'none';
    }
}

// Apply Search, Filters, and Sort
function applyFiltersAndRender() {
    let result = [...updatesState.updates];
    
    // 1. Filter Category
    if (updatesState.currentCategory !== 'all') {
        result = result.filter(item => item.category.toLowerCase() === updatesState.currentCategory.toLowerCase());
    }
    
    // 2. Filter Search Query
    if (updatesState.searchQuery) {
        const query = updatesState.searchQuery;
        result = result.filter(item => 
            item.text.toLowerCase().includes(query) || 
            item.category.toLowerCase().includes(query) ||
            item.date.toLowerCase().includes(query)
        );
    }
    
    // 3. Sort Order
    if (updatesState.sortBy === 'newest') {
        // Assume default order is newest or sort by date/updated
        // Our backend parses XML from top to bottom, which is newest first
    } else if (updatesState.sortBy === 'oldest') {
        result.reverse();
    }
    
    updatesState.filteredUpdates = result;
    renderCards();
}

// Render release cards in main area
function renderCards() {
    showLoading(false);
    elements.cardsContainer.innerHTML = '';
    
    if (updatesState.filteredUpdates.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.cardsContainer.style.display = 'none';
        elements.feedSubtitle.textContent = `Found 0 updates`;
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.cardsContainer.style.display = 'flex';
    elements.feedSubtitle.textContent = `Showing ${updatesState.filteredUpdates.length} of ${updatesState.updates.length} updates`;
    
    updatesState.filteredUpdates.forEach(update => {
        const card = document.createElement('div');
        const catClass = `category-${update.category.toLowerCase()}`;
        const badgeClass = `badge-${update.category.toLowerCase()}`;
        
        card.className = `release-card ${catClass}`;
        card.setAttribute('data-id', update.id);
        
        card.innerHTML = `
            <div class="card-header-meta">
                <div class="card-badge-group">
                    <span class="badge ${badgeClass}">${update.category}</span>
                    <span class="card-date">
                        <i class="fa-regular fa-calendar"></i>
                        ${update.date}
                    </span>
                </div>
                <div class="card-actions">
                    <button class="action-icon-btn copy-item-btn" title="Copy raw text">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <a href="${update.link}" target="_blank" class="action-icon-btn" title="View in Google Cloud Docs">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>
            </div>
            <div class="card-body">
                ${update.html}
            </div>
            <div class="card-footer">
                <span class="text-muted" style="font-size: 11px;">ID: #${update.id}</span>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-secondary copy-card-btn">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy Note</span>
                    </button>
                    <button class="btn btn-sm btn-twitter tweet-trigger-btn">
                        <i class="fa-brands fa-x-twitter"></i>
                        <span>Tweet This</span>
                    </button>
                </div>
            </div>
        `;
        
        // Wire top copy icon button
        card.querySelector('.copy-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(update.text);
            showFeedbackTooltip(e.currentTarget, '<i class="fa-solid fa-check"></i>');
        });
        
        // Wire explicit copy button
        card.querySelector('.copy-card-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(update.text);
            showFeedbackTooltip(e.currentTarget, '<i class="fa-solid fa-check"></i> Copied!');
        });
        
        // Wire tweet trigger
        card.querySelector('.tweet-trigger-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTweetDrawer(update);
        });
        
        elements.cardsContainer.appendChild(card);
    });
}

// Tooltip action feed feedback
function showFeedbackTooltip(btn, htmlContent) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = htmlContent;
    btn.style.borderColor = 'var(--primary)';
    btn.style.color = 'var(--primary)';
    
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.borderColor = '';
        btn.style.color = '';
    }, 1500);
}

// Open Composer Drawer
function openTweetDrawer(update) {
    updatesState.selectedUpdate = update;
    
    // Fill source preview details
    elements.sourceDate.textContent = update.date;
    elements.sourceCategory.textContent = update.category;
    elements.sourceCategory.className = `badge badge-${update.category.toLowerCase()}`;
    elements.sourceText.textContent = update.text;
    
    // Reset/Draft text content
    formatDraft('shorten'); // default
    
    // Open panel
    elements.tweetDrawer.classList.add('open');
    elements.drawerBackdrop.classList.add('open');
}

// Close Composer Drawer
function closeDrawer() {
    elements.tweetDrawer.classList.remove('open');
    elements.drawerBackdrop.classList.remove('open');
    updatesState.selectedUpdate = null;
}

// Auto-Draft/Summarize and formatting configurations
function formatDraft(type) {
    if (!updatesState.selectedUpdate) return;
    
    const update = updatesState.selectedUpdate;
    const date = update.date;
    const category = update.category.toUpperCase();
    const origText = update.text;
    const link = update.link;
    
    let draft = "";
    
    switch (type) {
        case 'shorten':
            // Generate standard format with link and hashtags
            let contentText = origText;
            
            // Limit main text length so combined tweet length stays within 280
            const prefix = `📢 #BigQuery ${category} Update (${date}):\n\n`;
            const suffix = `\n\n🔗 ${link}`;
            const remaining = 280 - prefix.length - suffix.length;
            
            if (contentText.length > remaining) {
                contentText = contentText.substring(0, remaining - 3) + "...";
            }
            
            draft = `${prefix}${contentText}${suffix}`;
            break;
            
        case 'bullets':
            // Split into bullet points
            const sentences = origText.split(/(?<=[.!?])\s+/);
            let bulletLines = sentences
                .map(s => s.trim())
                .filter(s => s.length > 5)
                .map(s => `• ${s}`)
                .join('\n');
            
            const bPrefix = `📢 #BigQuery ${category} (${date}):\n`;
            const bSuffix = `\n🔗 ${link}`;
            const bRemaining = 280 - bPrefix.length - bSuffix.length;
            
            if (bulletLines.length > bRemaining) {
                bulletLines = bulletLines.substring(0, bRemaining - 3) + "...";
            }
            
            draft = `${bPrefix}${bulletLines}${bSuffix}`;
            break;
            
        case 'clear':
        default:
            draft = origText;
            break;
    }
    
    elements.tweetTextarea.value = draft;
    updateCharCount();
}

// Update Character count UI
function updateCharCount() {
    const len = elements.tweetTextarea.value.length;
    elements.charCounter.textContent = `${len} / 280`;
    
    // Styling thresholds
    elements.charCounter.classList.remove('warning', 'danger');
    if (len > 280) {
        elements.charCounter.classList.add('danger');
    } else if (len > 250) {
        elements.charCounter.classList.add('warning');
    }
}

// Clipboard Integration
function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showFeedbackTooltip(elements.copyTweetBtn, '<i class="fa-solid fa-check"></i> Copied!');
        })
        .catch(err => {
            console.error("Clipboard copy error:", err);
        });
}

// Open Twitter web intent in a new window/tab
function sendTweetToTwitter() {
    const text = elements.tweetTextarea.value;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
}

// Toggle light/dark theme switch
function toggleTheme(e) {
    if (e.target.checked) {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
    }
}

// Client side CSV export engine
function exportToCSV() {
    if (updatesState.filteredUpdates.length === 0) return;
    
    // Define headers
    const headers = ["ID", "Date", "Category", "Clean Text", "Link"];
    
    // Map rows
    const rows = updatesState.filteredUpdates.map(item => [
        item.id,
        item.date,
        item.category,
        item.text.replace(/"/g, '""'), // escape quotes
        item.link
    ]);
    
    // Construct CSV String
    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");
    
    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


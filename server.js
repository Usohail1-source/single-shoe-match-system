const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists (needed for Render/cloud deployments)
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

//////////////////// SECURITY ////////////////////

app.set('trust proxy', 1);

app.use(session({
    secret: 'single-shoe-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 8
    }
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

app.use((req, res, next) => {
    if (req.session && req.session.network_id) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

//////////////////// FILE UPLOAD ////////////////////

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueName + ext);
    }
});

function fileFilter(req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image uploads are allowed.'));
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 }
});

//////////////////// HELPERS ////////////////////

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatCurrency(value) {
    return '$' + Number(value || 0).toFixed(2);
}

function getBadgeClass(type, value) {
    const cleanValue = (value || '').toLowerCase();

    if (type === 'side') {
        if (cleanValue === 'left') return 'badge badge-left';
        if (cleanValue === 'right') return 'badge badge-right';
    }

    if (type === 'gender') {
        if (cleanValue === 'men') return 'badge badge-men';
        if (cleanValue === 'women') return 'badge badge-women';
        if (cleanValue === 'kids') return 'badge badge-kids';
    }

    return 'badge';
}

function renderImage(imagePath, altText) {
    altText = altText || 'Shoe image';
    if (!imagePath) {
        return '<div class="shoe-image-placeholder">No Image</div>';
    }
    return '<img class="shoe-image" src="' + escapeHtml(imagePath) + '" alt="' + escapeHtml(altText) + '" style="cursor:zoom-in;">';
}

function renderImageWrap(imagePath, altText) {
    altText = altText || 'Shoe';
    if (!imagePath) {
        return '<div class="shoe-card-image-wrap"><div class="shoe-image-placeholder">No Image</div></div>';
    }
    return '<div class="shoe-card-image-wrap" onclick="openLightbox(\'' + imagePath.replace(/'/g, "\\'") + '\')">' +
        '<img class="shoe-image" src="' + escapeHtml(imagePath) + '" alt="' + escapeHtml(altText) + '" style="cursor:zoom-in;">' +
        '</div>';
}

function generateJoinCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizePairIds(a, b) {
    return a < b ? [a, b] : [b, a];
}

function requireNetwork(req, res, next) {
    if (!req.session.network_id) {
        return res.redirect('/');
    }
    next();
}

function renderPage(title, bodyHtml, options) {
    options = options || {};
    const session = options.session || {};
    const showSidebar = options.showSidebar !== false;
    const currentPath = options.currentPath || '';

    function navLink(href, icon, label, badge) {
        const active = currentPath === href ? ' active' : '';
        return '<a href="' + href + '" class="' + active + '">' +
            '<span class="nav-icon">' + icon + '</span>' + escapeHtml(label) +
            (badge !== undefined ? '<span class="nav-badge">' + badge + '</span>' : '') +
            '</a>';
    }

    const sidebar = showSidebar ? (
        '<aside class="app-sidebar">' +
        '<div class="sidebar-brand">' +
        '<div class="sidebar-brand-name">Mismatch</div>' +
        '</div>' +
        '<nav class="sidebar-nav">' +
        '<div class="sidebar-nav-section">' +
        navLink('/network', '◈', 'Home') +
        navLink('/unmatched', '◎', 'Single Shoes') +
        navLink('/awaiting-confirmation', '◷', 'Awaiting Confirmation') +
        navLink('/add', '+', 'Add Single Shoe') +
        '</div>' +
        '</nav>' +
        '<div class="sidebar-footer">' +
        '<a href="/logout">⎋ &nbsp;Log Out</a>' +
        '</div>' +
        '</aside>'
    ) : '';

    const topbar =
        '<div class="app-topbar">' +
        '<span class="app-topbar-title">' + escapeHtml(title) + '</span>' +
        '<div class="app-topbar-right">' +
        '<div class="secure-indicator"><div class="secure-dot"></div>Network Active</div>' +
        '<a href="/logout" class="mobile-logout">Log Out</a>' +
        '</div>' +
        '</div>';

    return '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<title>' + escapeHtml(title) + ' — Mismatch</title>' +
        '<link rel="stylesheet" href="/css/style.css">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">' +
        '</head>' +
        '<body>' +
        '<div class="container app-shell">' +
        sidebar +
        '<div class="app-main">' +
        topbar +
        '<div class="app-content">' +
        bodyHtml +
        '</div>' +
        '</div>' +
        '</div>' +
        '<script>' +
        'function toggleSection(titleEl, bodyId) {' +
        '  var body = document.getElementById(bodyId);' +
        '  if (!body) return;' +
        '  var isHidden = body.classList.toggle("hidden");' +
        '  titleEl.classList.toggle("collapsed", isHidden);' +
        '}' +
        'document.addEventListener("DOMContentLoaded", function() {' +
        '  document.querySelectorAll("form").forEach(function(f) { f.setAttribute("autocomplete","off"); });' +
        '  document.querySelectorAll("input,select,textarea").forEach(function(i) { i.setAttribute("autocomplete","off"); });' +
        '});' +
        'function openLightbox(src) {' +
        '  var lb = document.getElementById("img-lightbox");' +
        '  var img = document.getElementById("lightbox-img");' +
        '  if (!lb || !img || !src) return;' +
        '  img.src = src;' +
        '  lb.classList.add("open");' +
        '}' +
        'function closeLightbox() {' +
        '  var lb = document.getElementById("img-lightbox");' +
        '  if (lb) lb.classList.remove("open");' +
        '}' +
        'var _confirmCallback = null;' +
        'function showConfirm(message, onConfirm) {' +
        '  _confirmCallback = onConfirm;' +
        '  var box = document.getElementById("confirm-overlay");' +
        '  var msg = document.getElementById("confirm-message");' +
        '  if (msg) msg.textContent = message;' +
        '  if (box) box.classList.add("open");' +
        '}' +
        'function confirmAction() {' +
        '  var box = document.getElementById("confirm-overlay");' +
        '  if (box) box.classList.remove("open");' +
        '  if (_confirmCallback) _confirmCallback();' +
        '  _confirmCallback = null;' +
        '}' +
        'function cancelConfirm() {' +
        '  var box = document.getElementById("confirm-overlay");' +
        '  if (box) box.classList.remove("open");' +
        '  _confirmCallback = null;' +
        '}' +
        'function confirmDelete(form) {' +
        '  showConfirm("Are you sure you want to delete this shoe? This cannot be undone.", function() { form.submit(); });' +
        '}' +
        'function confirmCancel(form) {' +
        '  showConfirm("Cancel this pending match request?", function() { form.submit(); });' +
        '}' +
        '</script>' +
        '<div class="mobile-nav">' +
        '<a href="/network" class="' + (title === 'Home' ? 'active' : '') + '">' +
        '<span class="mobile-nav-icon">◈</span>' +
        '<span class="mobile-nav-label">Home</span>' +
        '</a>' +
        '<a href="/unmatched" class="' + (title === 'View Singles' ? 'active' : '') + '">' +
        '<span class="mobile-nav-icon">◎</span>' +
        '<span class="mobile-nav-label">Singles</span>' +
        '</a>' +
        '<a href="/awaiting-confirmation" class="' + (title === 'Awaiting Confirmation' ? 'active' : '') + '">' +
        '<span class="mobile-nav-icon">◷</span>' +
        '<span class="mobile-nav-label">Confirm</span>' +
        '</a>' +
        '<a href="/add" class="' + (title === 'Add Single Shoe' ? 'active' : '') + '">' +
        '<span class="mobile-nav-icon">+</span>' +
        '<span class="mobile-nav-label">Add Shoe</span>' +
        '</a>' +
        '</div>' +
        '<img id="lightbox-img" src="" alt="Shoe">' +
        '</div>' +
        '<div class="confirm-overlay" id="confirm-overlay">' +
        '<div class="confirm-box">' +
        '<div class="confirm-box-icon">🗑️</div>' +
        '<h3>Are you sure?</h3>' +
        '<p id="confirm-message">This action cannot be undone.</p>' +
        '<div class="confirm-box-actions">' +
        '<button type="button" class="confirm-cancel-btn" onclick="cancelConfirm()">Cancel</button>' +
        '<button type="button" class="confirm-delete-btn" onclick="confirmAction()">Yes, Delete</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</body>' +
        '</html>';
}

function renderMessagePage(title, message, links, boxClass) {
    links = links || [];
    boxClass = boxClass || 'info-box';

    const linksHtml = links.map(function(link) {
        return '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a><br><br>';
    }).join('');

    return renderPage(title,
        '<div class="hero">' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<p>Mismatch/p>' +
        '</div>' +
        '<div class="' + escapeHtml(boxClass) + '">' + escapeHtml(message) + '</div>' +
        '<div class="top-links" style="margin-top: 24px;">' + linksHtml + '</div>'
    );
}

function renderTopLinks(links) {
    const inner = links.map(function(link) {
        return '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a>';
    }).join('');
    return '<div class="top-links">' + inner + '</div>';
}

function renderStatCardLink(number, label, href, extraClass) {
    extraClass = extraClass || '';
    return '<a href="' + escapeHtml(href) + '" class="stat-card stat-card-link ' + escapeHtml(extraClass) + '">' +
        '<h3>' + escapeHtml(String(number)) + '</h3>' +
        '<p>' + escapeHtml(label) + '</p>' +
        '</a>';
}

function getConditionBadge(condition) {
    const c = (condition || 'new').toLowerCase();
    if (c === 'worn') return '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;"><strong style="color:var(--text-primary);">Condition:</strong> Worn</p>';
    return '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;"><strong style="color:var(--text-primary);">Condition:</strong> New</p>';
}

function getPriceTypeBadge(priceType) {
    const p = (priceType || 'original').toLowerCase();
    if (p === 'sale') return '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;"><strong style="color:var(--text-primary);">Price Type:</strong> Sale</p>';
    return '';
}

function renderShoeCard(shoe, options) {
    options = options || {};
    const title = options.title ? '<h2 class="section-title">' + escapeHtml(options.title) + '</h2>' : '';
    const altText = options.altText || 'Shoe';

    return '<div class="match-card">' +
        title +
        '<div class="shoe-card-layout">' +
        renderImageWrap(shoe.image_path, altText) +
        '<div class="shoe-card-details">' +
        '<p style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + escapeHtml(formatText(shoe.brand)) + ' ' + escapeHtml(formatText(shoe.model)) + '</p>' +
        '<div class="card-badges">' +
        '<span class="' + getBadgeClass('side', shoe.side) + '">' + escapeHtml(formatText(shoe.side)) + '</span>' +
        '<span class="' + getBadgeClass('gender', shoe.gender) + '">' + escapeHtml(formatText(shoe.gender)) + '</span>' +
        '</div>' +
        getConditionBadge(shoe.condition) +
        getPriceTypeBadge(shoe.price_type) +
        '<p><strong>Store:</strong> ' + escapeHtml(formatText(shoe.store_name)) + ' (' + escapeHtml(shoe.store_number) + ')</p>' +
        '<p><strong>Size:</strong> ' + escapeHtml(shoe.size) + ' &nbsp;•&nbsp; <strong>Color:</strong> ' + escapeHtml(formatText(shoe.color)) + '</p>' +
        '<p><strong>SKU:</strong> ' + escapeHtml(shoe.sku || 'N/A') + '</p>' +
        '<p><strong>Price:</strong> ' + escapeHtml(formatCurrency(shoe.original_price)) + (shoe.price_type && shoe.price_type !== 'original' ? ' <span style="font-size:11px;opacity:0.6;">(' + escapeHtml(formatText(shoe.price_type)) + ')</span>' : '') + '</p>' +
        '</div>' +
        '</div>' +
        '</div>';
}

function buildShoeFromPrefix(row, prefix) {
    return {
        id: row[prefix + '_id'],
        store_name: row[prefix + '_store_name'],
        store_number: row[prefix + '_store_number'],
        brand: row[prefix + '_brand'],
        model: row[prefix + '_model'],
        sku: row[prefix + '_sku'],
        gender: row[prefix + '_gender'],
        size: row[prefix + '_size'],
        color: row[prefix + '_color'],
        side: row[prefix + '_side'],
        original_price: row[prefix + '_original_price'],
        image_path: row[prefix + '_image_path']
    };
}

function pendingRequestSelectFields(alias1, alias2) {
    alias1 = alias1 || 's1';
    alias2 = alias2 || 's2';
    return alias1 + '.id AS shoe1_id, ' +
        alias1 + '.store_name AS shoe1_store_name, ' +
        alias1 + '.store_number AS shoe1_store_number, ' +
        alias1 + '.brand AS shoe1_brand, ' +
        alias1 + '.model AS shoe1_model, ' +
        alias1 + '.sku AS shoe1_sku, ' +
        alias1 + '.gender AS shoe1_gender, ' +
        alias1 + '.size AS shoe1_size, ' +
        alias1 + '.color AS shoe1_color, ' +
        alias1 + '.side AS shoe1_side, ' +
        alias1 + '.original_price AS shoe1_original_price, ' +
        alias1 + '.image_path AS shoe1_image_path, ' +
        alias2 + '.id AS shoe2_id, ' +
        alias2 + '.store_name AS shoe2_store_name, ' +
        alias2 + '.store_number AS shoe2_store_number, ' +
        alias2 + '.brand AS shoe2_brand, ' +
        alias2 + '.model AS shoe2_model, ' +
        alias2 + '.sku AS shoe2_sku, ' +
        alias2 + '.gender AS shoe2_gender, ' +
        alias2 + '.size AS shoe2_size, ' +
        alias2 + '.color AS shoe2_color, ' +
        alias2 + '.side AS shoe2_side, ' +
        alias2 + '.original_price AS shoe2_original_price, ' +
        alias2 + '.image_path AS shoe2_image_path';
}

// Reusable password page HTML generator
function pwPageHtml(opts) {
    const hiddenInputs = (opts.hiddenFields || []).map(function(f) {
        return '<input type="hidden" name="' + escapeHtml(f.name) + '" value="' + escapeHtml(f.value) + '">';
    }).join('');

    return '<!DOCTYPE html><html lang="en"><head>' +
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">' +
        '<title>Mismatch</title>' +
        '<link rel="stylesheet" href="/css/style.css">' +
        '<style>' +
        'body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg);padding:20px;}' +
        '.pw-wrap{width:100%;max-width:400px;}' +
        '.pw-card{background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg);padding:36px 32px;text-align:center;box-shadow:var(--shadow-lg);}' +
        '.pw-icon{font-size:32px;margin-bottom:12px;}' +
        '.pw-title{font-size:24px;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;margin-bottom:8px;}' +
        '.pw-sub{font-size:13px;color:var(--text-muted);margin-bottom:28px;line-height:1.6;}' +
        '.pw-card label{text-align:left;font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);letter-spacing:0.10em;text-transform:uppercase;margin-bottom:8px;margin-top:0;display:block;}' +
        '.pw-card input[type="password"]{font-size:15px;padding:13px 16px;background:var(--surface-2);color:var(--text-primary) !important;margin-bottom:16px;width:100%;border:1px solid var(--border-2);border-radius:var(--radius-sm);outline:none;}' +
        '.pw-card input[type="password"]:focus{border-color:rgba(200,240,80,0.4);box-shadow:0 0 0 3px rgba(200,240,80,0.07);}' +
        'input[type="password"]::placeholder{color:var(--text-faint);}' +
        '.pw-card button{width:100%;justify-content:center;padding:13px;font-size:15px;font-weight:700;margin-top:4px;}' +
        '.pw-back{display:block;text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted);text-decoration:none;transition:color 0.15s;}' +
        '.pw-back:hover{color:var(--text-secondary);}' +
        '</style></head><body>' +
        '<div class="pw-wrap"><div class="pw-card">' +
        '<div class="pw-icon">' + opts.icon + '</div>' +
        '<div class="pw-title">' + opts.title + '</div>' +
        '<div class="pw-sub">' + escapeHtml(opts.subtitle) + '</div>' +
        '<form method="POST" action="' + escapeHtml(opts.action) + '" autocomplete="off">' +
        hiddenInputs +
        '<label>' + escapeHtml(opts.label) + '</label>' +
        '<input type="password" name="network_password" placeholder="' + escapeHtml(opts.placeholder) + '" required autofocus>' +
        '<button type="submit">' + escapeHtml(opts.button) + '</button>' +
        '</form>' +
        '<a href="' + escapeHtml(opts.back) + '" class="pw-back">← Back</a>' +
        '</div></div></body></html>';
}

//////////////////// HOME ////////////////////

app.get('/', (req, res) => {
    if (req.session.network_id) {
        return res.redirect('/network');
    }
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

//////////////////// CREATE NETWORK ////////////////////

app.get('/create-network', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'create-network.html'));
});

app.post('/create-network', (req, res) => {
    const networkName = (req.body.network_name || '').trim();
    const storeName = (req.body.store_name || '').trim();
    const storeNumber = (req.body.store_number || '').trim();

    if (!networkName || !storeName || !storeNumber) {
        return res.send(renderMessagePage(
            'Missing Information',
            'Please complete all required fields.',
            [{ href: '/', label: 'Back to Home' }, { href: '/create-network', label: 'Back to Create Network' }],
            'error-box'
        ));
    }

    const joinCode = generateJoinCode();

    db.run('INSERT INTO networks (name, join_code) VALUES (?, ?)', [networkName, joinCode], function(err) {
        if (err) {
            console.error(err.message);
            return res.send(renderMessagePage('Error', 'Could not create network.',
                [{ href: '/', label: 'Back to Home' }, { href: '/create-network', label: 'Back to Create Network' }], 'error-box'));
        }

        const networkId = this.lastID;

        db.run('INSERT OR IGNORE INTO network_members (network_id, store_name, store_number, is_creator) VALUES (?, ?, ?, 1)',
            [networkId, storeName, storeNumber], function(memberErr) {
                if (memberErr) {
                    console.error(memberErr.message);
                    return res.send(renderMessagePage('Error', 'Could not save store.',
                        [{ href: '/', label: 'Back to Home' }], 'error-box'));
                }

                req.session.network_id = networkId;
                req.session.store_name = storeName;
                req.session.store_number = storeNumber;
                res.redirect('/network');
            });
    });
});

//////////////////// JOIN NETWORK ////////////////////

app.get('/join-network', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'join-network.html'));
});

app.post('/join-network', (req, res) => {
    const joinCode = (req.body.join_code || '').trim().toUpperCase();
    const storeName = (req.body.store_name || '').trim();
    const storeNumber = (req.body.store_number || '').trim();

    if (!joinCode || !storeName || !storeNumber) {
        return res.send(renderMessagePage('Missing Information', 'Please complete all required fields.',
            [{ href: '/', label: 'Back to Home' }, { href: '/join-network', label: 'Back to Join Network' }], 'error-box'));
    }

    db.get('SELECT * FROM networks WHERE join_code = ?', [joinCode], (err, network) => {
        if (err || !network) {
            return res.send(renderMessagePage('Invalid Join Code', 'No network was found for that join code.',
                [{ href: '/', label: 'Back to Home' }, { href: '/join-network', label: 'Try Again' }], 'error-box'));
        }

        db.run('INSERT OR IGNORE INTO network_members (network_id, store_name, store_number) VALUES (?, ?, ?)',
            [network.id, storeName, storeNumber], function(memberErr) {
                if (memberErr) {
                    return res.send(renderMessagePage('Error', 'Could not add store to network.',
                        [{ href: '/join-network', label: 'Try Again' }], 'error-box'));
                }

                req.session.network_id = network.id;
                req.session.store_name = storeName;
                req.session.store_number = storeNumber;
                res.redirect('/network');
            });
    });
});

//////////////////// FORGOT JOIN CODE ////////////////////

app.get('/forgot-code', (req, res) => {
    res.send('<!DOCTYPE html><html lang="en"><head>' +
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">' +
        '<title>Forgot Join Code — Mismatch</title>' +
        '<link rel="stylesheet" href="/css/style.css">' +
        '<style>' +
        'body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg);padding:20px;}' +
        '.pw-wrap{width:100%;max-width:400px;}' +
        '.pw-card{background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg);padding:36px 32px;text-align:center;box-shadow:var(--shadow-lg);}' +
        '.pw-icon{font-size:32px;margin-bottom:12px;}' +
        '.pw-title{font-size:24px;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;margin-bottom:8px;}' +
        '.pw-sub{font-size:13px;color:var(--text-muted);margin-bottom:28px;line-height:1.6;}' +
        '.pw-card label{text-align:left;font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);letter-spacing:0.10em;text-transform:uppercase;margin-bottom:8px;margin-top:16px;display:block;}' +
        '.pw-card label:first-of-type{margin-top:0;}' +
        '.pw-card input{font-size:15px;padding:13px 16px;background:var(--surface-2);color:var(--text-primary) !important;width:100%;border:1px solid var(--border-2);border-radius:var(--radius-sm);outline:none;}' +
        '.pw-card input:focus{border-color:rgba(200,240,80,0.4);box-shadow:0 0 0 3px rgba(200,240,80,0.07);}' +
        'input::placeholder{color:var(--text-faint);}' +
        '.pw-card button{width:100%;justify-content:center;padding:13px;font-size:15px;font-weight:700;margin-top:20px;}' +
        '.pw-back{display:block;text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted);text-decoration:none;}' +
        '.pw-back:hover{color:var(--text-secondary);}' +
        '</style></head><body>' +
        '<div class="pw-wrap"><div class="pw-card">' +
        '<div class="pw-icon">🔍</div>' +
        '<div class="pw-title">Forgot Join Code?</div>' +
        '<div class="pw-sub">Enter your network name and store details — we\'ll log you back in.</div>' +
        '<form method="POST" action="/forgot-code" autocomplete="off">' +
        '<label>Network Name</label>' +
        '<input type="text" name="network_name" placeholder="Your network name" required autofocus>' +
        '<label>Store Name</label>' +
        '<input type="text" name="store_name" placeholder="Your store name" required>' +
        '<label>Store Number</label>' +
        '<input type="text" name="store_number" placeholder="Your store number" required>' +
        '<button type="submit">Log Me In →</button>' +
        '</form>' +
        '<a href="/join-network" class="pw-back">← Back to Join Network</a>' +
        '</div></div></body></html>');
});

app.post('/forgot-code', (req, res) => {
    const networkName = (req.body.network_name || '').trim().toLowerCase();
    const storeName = (req.body.store_name || '').trim();
    const storeNumber = (req.body.store_number || '').trim();

    if (!networkName || !storeName || !storeNumber) {
        return res.send(renderMessagePage('Missing Information', 'Please fill in all fields.',
            [{ href: '/forgot-code', label: 'Try Again' }], 'error-box'));
    }

    db.get('SELECT * FROM networks WHERE LOWER(name) = ?', [networkName], (err, network) => {
        if (err || !network) {
            return res.send(renderMessagePage('Not Found', 'No network found with that name.',
                [{ href: '/forgot-code', label: 'Try Again' }], 'error-box'));
        }

        db.get('SELECT * FROM network_members WHERE network_id = ? AND LOWER(store_name) = ? AND store_number = ?',
            [network.id, storeName.toLowerCase(), storeNumber], (memberErr, member) => {
                if (memberErr || !member) {
                    return res.send(renderMessagePage('Store Not Found', 'That store is not part of this network.',
                        [{ href: '/forgot-code', label: 'Try Again' }], 'error-box'));
                }

                req.session.network_id = network.id;
                req.session.store_name = member.store_name;
                req.session.store_number = member.store_number;
                res.redirect('/network');
            });
    });
});

//////////////////// REMOVE STORE ////////////////////

app.post('/remove-store', requireNetwork, (req, res) => {
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;
    const targetStoreName = (req.body.target_store_name || '').trim();
    const targetStoreNumber = (req.body.target_store_number || '').trim();

    // Check requester is creator
    db.get('SELECT * FROM network_members WHERE network_id = ? AND store_name = ? AND store_number = ? AND is_creator = 1',
        [networkId, storeName, storeNumber], (err, creator) => {
            if (err || !creator) {
                return res.send(renderMessagePage('Not Allowed', 'Only the network creator can remove stores.',
                    [{ href: '/network', label: 'Back to Home' }], 'error-box'));
            }

            // Can't remove yourself
            if (targetStoreName === storeName && targetStoreNumber === storeNumber) {
                return res.send(renderMessagePage('Not Allowed', 'You cannot remove yourself from the network.',
                    [{ href: '/network', label: 'Back to Home' }], 'error-box'));
            }

            db.run('DELETE FROM network_members WHERE network_id = ? AND store_name = ? AND store_number = ?',
                [networkId, targetStoreName, targetStoreNumber], function(deleteErr) {
                    if (deleteErr) {
                        return res.send(renderMessagePage('Error', 'Could not remove store.',
                            [{ href: '/network', label: 'Back to Home' }], 'error-box'));
                    }
                    res.redirect('/network');
                });
        });
});

//////////////////// LOG OUT ////////////////////

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

//////////////////// NETWORK DASHBOARD ////////////////////

app.get('/network', requireNetwork, (req, res) => {
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;
    const myStoreFilterEncoded = encodeURIComponent(storeName + '|||' + storeNumber);

    const statsQuery = `
        SELECT
            (SELECT COUNT(*) FROM shoes WHERE matched = 0 AND network_id = ?) AS total_single_count,
            (SELECT COUNT(*) FROM confirmed_matches WHERE network_id = ?) AS total_pairs_made,
            (SELECT COALESCE(SUM(recovered_value), 0) FROM confirmed_matches WHERE network_id = ?) AS total_recovered_value,
            (SELECT COUNT(*) FROM shoes WHERE matched = 0 AND network_id = ? AND store_name = ? AND store_number = ?) AS store_single_count,
            (
                SELECT COUNT(*) FROM (
                    SELECT MIN(s1.id, s2.id) AS shoe_a, MAX(s1.id, s2.id) AS shoe_b
                    FROM shoes s1
                    JOIN shoes s2
                        ON s1.network_id = s2.network_id
                        AND s1.brand = s2.brand
                        AND s1.model = s2.model
                        AND s1.gender = s2.gender
                        AND s1.size = s2.size
                        AND s1.side != s2.side
                        AND s1.color = s2.color
                        AND s1.id < s2.id
                    WHERE s1.network_id = ?
                      AND s1.matched = 0
                      AND s2.matched = 0
                      AND ((s1.store_name = ? AND s1.store_number = ?) OR (s2.store_name = ? AND s2.store_number = ?))
                      AND NOT EXISTS (
                        SELECT 1 FROM pending_match_requests pmr
                        WHERE pmr.network_id = s1.network_id AND pmr.shoe1_id = s1.id AND pmr.shoe2_id = s2.id AND pmr.status = 'pending'
                      )
                ) AS unique_pairs
            ) AS store_potential_count,
            (
                SELECT COUNT(*) FROM pending_match_requests
                WHERE network_id = ? AND status = 'pending'
                  AND ((target_store_name = ? AND target_store_number = ?) OR (requesting_store_name = ? AND requesting_store_number = ?))
            ) AS awaiting_confirmation_count,
            (
                SELECT COALESCE(SUM(cm.recovered_value), 0) FROM confirmed_matches cm
                WHERE cm.network_id = ?
                  AND ((cm.confirming_store_name = ? AND cm.confirming_store_number = ?)
                    OR EXISTS (SELECT 1 FROM shoes s WHERE s.network_id = cm.network_id AND s.id IN (cm.shoe1_id, cm.shoe2_id) AND s.store_name = ? AND s.store_number = ?))
            ) AS store_recovered_value,
            (
                SELECT COUNT(*) FROM confirmed_matches cm
                WHERE cm.network_id = ?
                  AND EXISTS (SELECT 1 FROM shoes s WHERE s.network_id = cm.network_id AND s.id IN (cm.shoe1_id, cm.shoe2_id) AND s.store_name = ? AND s.store_number = ?)
            ) AS store_pairs_made
    `;

    db.get(statsQuery, [
        networkId,
        networkId,
        networkId,
        networkId, storeName, storeNumber,
        networkId, storeName, storeNumber, storeName, storeNumber,
        networkId, storeName, storeNumber, storeName, storeNumber,
        networkId, storeName, storeNumber, storeName, storeNumber,
        networkId, storeName, storeNumber
    ], (statsErr, stats) => {
        if (statsErr) {
            console.error(statsErr.message);
            return res.send('Error loading dashboard');
        }

        db.get('SELECT * FROM networks WHERE id = ?', [networkId], (networkErr, network) => {
            if (networkErr || !network) {
                return res.send('Error loading network');
            }

            db.all('SELECT store_name, store_number, is_creator FROM network_members WHERE network_id = ? ORDER BY is_creator DESC, store_name, store_number',
                [networkId], (membersErr, members) => {
                    if (membersErr) {
                        return res.send('Error loading network members');
                    }

                    const isCreator = members.some(function(m) {
                        return m.store_name === storeName && m.store_number === storeNumber && m.is_creator === 1;
                    });

                    const membersHtml = members.length
                        ? members.map(function(member) {
                            const isMe = member.store_name === storeName && member.store_number === storeNumber;
                            const creatorBadge = member.is_creator ? ' <span style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;color:var(--accent);text-transform:uppercase;background:var(--accent-dim);padding:2px 7px;border-radius:100px;border:1px solid rgba(200,240,80,0.2);">Creator</span>' : '';
                            const removeBtn = isCreator && !isMe
                                ? '<form method="POST" action="/remove-store" class="delete-form" onsubmit="event.preventDefault(); confirmDelete(this);" style="margin-top:10px;">' +
                                  '<input type="hidden" name="target_store_name" value="' + escapeHtml(member.store_name) + '">' +
                                  '<input type="hidden" name="target_store_number" value="' + escapeHtml(member.store_number) + '">' +
                                  '<button type="submit">Remove Store</button></form>'
                                : '';
                            return '<div class="match-card">' +
                                '<p><strong>' + escapeHtml(formatText(member.store_name)) + '</strong>' + creatorBadge + (isMe ? ' <span style="font-size:11px;color:var(--text-muted);">(you)</span>' : '') + '</p>' +
                                '<p style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-top:3px;">Store #' + escapeHtml(member.store_number) + '</p>' +
                                removeBtn +
                                '</div>';
                        }).join('')
                        : '<div class="info-box">No stores are currently in this network.</div>';

                    const dashboardHtml =
                        renderTopLinks([{ href: '/logout', label: 'Log Out' }]) +

                        '<div class="hero">' +
                        '<h1 class="network-name">' + escapeHtml(formatText(network.name)) + '</h1>' +
                        '<div class="connected-as">Connected as &nbsp;<strong>' + escapeHtml(formatText(storeName)) + '</strong> &nbsp;·&nbsp; <strong>' + escapeHtml(storeNumber) + '</strong></div>' +
                        '<div class="hero-join-code">' +
                        '<div class="join-code-row">' +
                        '<code id="joinCode">' + escapeHtml(network.join_code) + '</code>' +
                        '<button type="button" onclick="copyJoinCode()">Copy</button>' +
                        '</div>' +
                        '<span id="copyStatus" class="copy-status"></span>' +
                        '</div>' +
                        '<script>' +
                        'function copyJoinCode() {' +
                        '  var code = document.getElementById("joinCode").innerText;' +
                        '  navigator.clipboard.writeText(code).then(function() {' +
                        '    var status = document.getElementById("copyStatus");' +
                        '    status.innerText = "Copied!";' +
                        '    status.style.opacity = 1;' +
                        '    setTimeout(function() { status.style.opacity = 0; }, 1500);' +
                        '  });' +
                        '}' +
                        '</script>' +
                        '</div>' +

                        '<h2 class="section-title collapsible" onclick="toggleSection(this, \'network-overview-body\')">' +
                        'Network Overview <span class="toggle-icon">▾</span>' +
                        '</h2>' +
                        '<div class="collapsible-body" id="network-overview-body">' +
                        '<div class="stats-grid">' +
                        '<div class="stat-card normal-card"><a href="/unmatched" class="stat-card-link"><h3>' + escapeHtml(String(stats.total_single_count)) + '</h3><p>Total Singles</p></a></div>' +
                        renderStatCardLink(stats.total_pairs_made, 'Total Pairs Made', '/confirmed-matches/all', 'gain-card') +
                        '<div class="stat-card gain-card"><h3>' + escapeHtml(formatCurrency(stats.total_recovered_value)) + '</h3><p>Total Recovered Value</p></div>' +
                        '</div>' +
                        '</div>' +

                        '<h2 class="section-title">My Store</h2>' +
                        '<div class="stats-grid">' +
                        renderStatCardLink(stats.store_single_count, 'Singles', '/unmatched?store_filter=' + myStoreFilterEncoded, 'normal-card') +
                        renderStatCardLink(stats.store_potential_count, 'Potential Matches', '/potential-matches') +
                        '</div>' +

                        '<div class="stats-grid">' +
                        renderStatCardLink(stats.store_pairs_made, 'Pairs Made', '/confirmed-matches', 'gain-card') +
                        '<div class="stat-card gain-card"><h3>' + escapeHtml(formatCurrency(stats.store_recovered_value)) + '</h3><p>Recovered Value</p></div>' +
                        '</div>' +

                        '<div class="stats-grid" style="grid-template-columns:1fr;">' +
                        renderStatCardLink(stats.awaiting_confirmation_count, 'Awaiting Confirmation', '/awaiting-confirmation') +
                        '</div>' +

                        '<a href="/add" class="add-shoe-banner">' +
                        '<div class="add-shoe-banner-left">' +
                        '<div class="add-shoe-banner-icon">+</div>' +
                        '<div>' +
                        '<div class="add-shoe-banner-title">Add Single Shoe</div>' +
                        '<div class="add-shoe-banner-sub">Post a shoe — we\'ll check for a match instantly</div>' +
                        '</div>' +
                        '</div>' +
                        '<div class="add-shoe-banner-arrow">→</div>' +
                        '</a>' +

                        '<h2 class="section-title collapsible collapsed" onclick="toggleSection(this, \'stores-body\')">' +
                        (isCreator ? '⚙ Manage Network' : 'Stores In This Network') + ' <span class="toggle-icon">▾</span>' +
                        '</h2>' +
                        '<div class="collapsible-body hidden" id="stores-body">' +
                        (isCreator ? '<div class="info-box" style="margin-bottom:12px;">As network creator you can remove stores from this network.</div>' : '') +
                        '<div class="unmatched-grid">' + membersHtml + '</div>' +
                        '</div>';

                    res.send(renderPage('Home', dashboardHtml));
                });
        });
    });
});

//////////////////// ADD SHOE ////////////////////

app.get('/add', requireNetwork, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add-shoe.html'));
});

app.post('/add-shoe', requireNetwork, upload.single('shoe_image'), (req, res) => {
    let { brand, model, sku, gender, size, color, side, original_price, condition, price_type } = req.body;

    const storeName = (req.session.store_name || '').trim();
    const storeNumber = (req.session.store_number || '').trim();
    const networkId = req.session.network_id;

    brand = brand ? brand.toLowerCase().trim() : '';
    model = model ? model.toLowerCase().trim() : '';
    sku = sku ? sku.trim() : '';
    gender = gender ? gender.toLowerCase().trim() : '';
    size = parseFloat(size);
    original_price = parseFloat(original_price);
    color = color ? color.trim() : '';
    side = side ? side.toLowerCase().trim() : '';
    condition = ['new', 'worn'].includes((condition || '').toLowerCase()) ? condition.toLowerCase() : 'new';
    price_type = ['original', 'sale'].includes((price_type || '').toLowerCase()) ? price_type.toLowerCase() : 'original';

    const allowedSides = ['left', 'right'];
    const allowedGenders = ['men', 'women', 'kids'];

    if (!storeName || !storeNumber || !brand || !model || !gender || !color || !side || Number.isNaN(size) || Number.isNaN(original_price)) {
        return res.send(renderMessagePage('Invalid Submission', 'Please complete all required shoe details correctly.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/add', label: 'Back to Add Single Shoe' }], 'error-box'));
    }

    if (!allowedSides.includes(side)) {
        return res.send(renderMessagePage('Invalid Side', 'Side must be left or right.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/add', label: 'Back to Add Single Shoe' }], 'error-box'));
    }

    if (!allowedGenders.includes(gender)) {
        return res.send(renderMessagePage('Invalid Gender', 'Gender must be men, women, or kids.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/add', label: 'Back to Add Single Shoe' }], 'error-box'));
    }

    if (size <= 0) {
        return res.send(renderMessagePage('Invalid Size', 'Shoe size must be greater than 0.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/add', label: 'Back to Add Single Shoe' }], 'error-box'));
    }

    if (original_price < 0) {
        return res.send(renderMessagePage('Invalid Price', 'Original price cannot be negative.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/add', label: 'Back to Add Single Shoe' }], 'error-box'));
    }

    const imagePath = req.file ? '/uploads/' + req.file.filename : '';

    db.run(
        'INSERT INTO shoes (network_id, store_name, store_number, brand, model, sku, gender, size, color, side, original_price, image_path, matched, condition, price_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
        [networkId, storeName, storeNumber, brand, model, sku, gender, size, color, side, original_price, imagePath, condition, price_type],
        function(err) {
            if (err) {
                console.error(err.message);
                return res.send('Error saving shoe');
            }

            const newShoeId = this.lastID;

            db.all(
                'SELECT * FROM shoes WHERE network_id = ? AND matched = 0 AND brand = ? AND model = ? AND gender = ? AND size = ? AND side != ? AND color = ? AND id != ?',
                [networkId, brand, model, gender, size, side, color, newShoeId],
                (matchErr, matches) => {
                    if (matchErr) {
                        console.error(matchErr.message);
                        return res.redirect('/unmatched');
                    }

                    if (!matches.length) {
                        return res.send(renderMessagePage('No Match Yet', 'Your shoe was added successfully. No match was found yet.',
                            [{ href: '/network', label: 'Back to Home' }, { href: '/unmatched', label: 'View Singles' }, { href: '/add', label: 'Add Another Shoe' }],
                            'info-box'));
                    }

                    const addedShoe = { id: newShoeId, store_name: storeName, store_number: storeNumber, brand, model, sku, gender, size, color, side, original_price, image_path: imagePath };

                    const matchesHtml = matches.map(function(match) {
                        return '<div class="match-card">' +
                            renderShoeCard(addedShoe, { title: 'Your Shoe', altText: 'Your shoe' }) +
                            renderShoeCard(match, { title: 'Possible Match', altText: 'Possible match shoe' }) +
                            '<form method="POST" action="/send-match-request" autocomplete="off">' +
                            '<input type="hidden" name="shoe1_id" value="' + newShoeId + '">' +
                            '<input type="hidden" name="shoe2_id" value="' + match.id + '">' +
                            '<label>Requested By</label>' +
                            '<input type="text" name="requested_by" required>' +
                            '<label>Request Note (optional)</label>' +
                            '<input type="text" name="request_note">' +
                            '<div style="margin-top:20px;">' +
                            '<button type="submit">Send Confirmation Request</button>' +
                            '</div>' +
                            '</form>' +
                            '</div>';
                    }).join('');

                    res.send(renderPage('Match Found',
                        renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/unmatched', label: 'View Singles' }, { href: '/potential-matches', label: 'Potential Matches' }]) +
                        '<div class="hero"><h1>Match Found</h1><p>Your shoe was added and a possible match was found right away.</p></div>' +
                        '<div class="unmatched-grid">' + matchesHtml + '</div>'
                    ));
                }
            );
        }
    );
});

//////////////////// CONFIRMED (ALL NETWORK) ////////////////////

app.get('/confirmed-matches/all', requireNetwork, (req, res) => {
    const networkId = req.session.network_id;

    const query =
        'SELECT cm.id AS match_id, cm.confirmed_at, cm.confirmed_by, cm.confirming_store_name, cm.confirming_store_number, cm.recovered_value, ' +
        pendingRequestSelectFields('s1', 's2') +
        ' FROM confirmed_matches cm' +
        ' JOIN shoes s1 ON s1.id = cm.shoe1_id' +
        ' JOIN shoes s2 ON s2.id = cm.shoe2_id' +
        ' WHERE cm.network_id = ?' +
        ' ORDER BY cm.confirmed_at DESC';

    db.all(query, [networkId], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send('Error loading confirmed matches');
        }

        const matchesHtml = rows.length
            ? rows.map(function(row) {
                const shoe1 = buildShoeFromPrefix(row, 'shoe1');
                const shoe2 = buildShoeFromPrefix(row, 'shoe2');
                const pairId = 'pair-all-' + row.match_id;
                return '<div class="confirmed-pair-card" onclick="togglePair(\'' + pairId + '\', this)">' +
                    '<div class="confirmed-pair-summary">' +
                    '<div class="confirmed-pair-image">' + renderImage(shoe1.image_path || shoe2.image_path, 'Confirmed pair') + '</div>' +
                    '<div class="confirmed-pair-info">' +
                    '<div class="confirmed-pair-title">' + escapeHtml(formatText(shoe1.brand)) + ' ' + escapeHtml(formatText(shoe1.model)) + '</div>' +
                    '<div class="confirmed-pair-meta">Size ' + escapeHtml(shoe1.size) + ' &nbsp;·&nbsp; ' + escapeHtml(formatText(shoe1.color)) + '</div>' +
                    '<div class="confirmed-pair-stores">' + escapeHtml(formatText(shoe1.store_name)) + ' (' + escapeHtml(shoe1.store_number) + ') &nbsp;+&nbsp; ' + escapeHtml(formatText(shoe2.store_name)) + ' (' + escapeHtml(shoe2.store_number) + ')</div>' +
                    '<div class="confirmed-pair-value">' + escapeHtml(formatCurrency(row.recovered_value)) + ' recovered</div>' +
                    '</div>' +
                    '<div class="confirmed-pair-chevron">▾</div>' +
                    '</div>' +
                    '<div class="confirmed-pair-details" id="' + pairId + '" style="display:none;">' +
                    renderShoeCard(shoe1, { altText: 'Shoe 1' }) +
                    renderShoeCard(shoe2, { altText: 'Shoe 2' }) +
                    '<div class="success-box" style="margin-top:12px;">Confirmed by ' + escapeHtml(formatText(row.confirmed_by)) + ' &nbsp;·&nbsp; Recovered ' + escapeHtml(formatCurrency(row.recovered_value)) + '</div>' +
                    '</div>' +
                    '</div>';
            }).join('')
            : '<div class="info-box">No pairs have been confirmed in this network yet.</div>';

        res.send(renderPage('All Confirmed Pairs',
            renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/confirmed-matches', label: 'My Store Pairs' }]) +
            '<script>function togglePair(id, card) { var el = document.getElementById(id); if (!el) return; var open = el.style.display === "block"; el.style.display = open ? "none" : "block"; card.classList.toggle("confirmed-pair-open", !open); }</script>' +
            '<div class="hero"><h1>All Confirmed Pairs</h1><p>Every pair confirmed across the entire network.</p></div>' +
            '<div class="confirmed-list">' + matchesHtml + '</div>'
        ));
    });
});

//////////////////// CONFIRMED ////////////////////

app.get('/confirmed-matches', requireNetwork, (req, res) => {
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;

    const query =
        'SELECT cm.id AS match_id, cm.confirmed_at, cm.confirmed_by, cm.confirming_store_name, cm.confirming_store_number, cm.recovered_value, ' +
        pendingRequestSelectFields('s1', 's2') +
        ' FROM confirmed_matches cm' +
        ' JOIN shoes s1 ON s1.id = cm.shoe1_id' +
        ' JOIN shoes s2 ON s2.id = cm.shoe2_id' +
        ' WHERE cm.network_id = ?' +
        ' AND ((s1.store_name = ? AND s1.store_number = ?) OR (s2.store_name = ? AND s2.store_number = ?))' +
        ' ORDER BY cm.confirmed_at DESC';

    db.all(query, [networkId, storeName, storeNumber, storeName, storeNumber], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send('Error loading confirmed matches');
        }

        const matchesHtml = rows.length
            ? rows.map(function(row) {
                const shoe1 = buildShoeFromPrefix(row, 'shoe1');
                const shoe2 = buildShoeFromPrefix(row, 'shoe2');
                const pairId = 'pair-' + row.match_id;
                return '<div class="confirmed-pair-card" onclick="togglePair(\'' + pairId + '\', this)">' +

                    '<div class="confirmed-pair-summary">' +
                    '<div class="confirmed-pair-image">' + renderImage(shoe1.image_path || shoe2.image_path, 'Confirmed pair') + '</div>' +
                    '<div class="confirmed-pair-info">' +
                    '<div class="confirmed-pair-title">' + escapeHtml(formatText(shoe1.brand)) + ' ' + escapeHtml(formatText(shoe1.model)) + '</div>' +
                    '<div class="confirmed-pair-meta">' +
                    'Size ' + escapeHtml(shoe1.size) + ' &nbsp;·&nbsp; ' + escapeHtml(formatText(shoe1.color)) +
                    '</div>' +
                    '<div class="confirmed-pair-stores">' +
                    escapeHtml(formatText(shoe1.store_name)) + ' (' + escapeHtml(shoe1.store_number) + ')' +
                    ' &nbsp;+&nbsp; ' +
                    escapeHtml(formatText(shoe2.store_name)) + ' (' + escapeHtml(shoe2.store_number) + ')' +
                    '</div>' +
                    '<div class="confirmed-pair-value">' + escapeHtml(formatCurrency(row.recovered_value)) + ' recovered</div>' +
                    '</div>' +
                    '<div class="confirmed-pair-chevron">▾</div>' +
                    '</div>' +

                    '<div class="confirmed-pair-details" id="' + pairId + '" style="display:none;">' +
                    renderShoeCard(shoe1, { altText: 'Shoe 1' }) +
                    renderShoeCard(shoe2, { altText: 'Shoe 2' }) +
                    '<div class="success-box" style="margin-top:12px;">Confirmed by ' + escapeHtml(formatText(row.confirmed_by)) + ' &nbsp;·&nbsp; Recovered ' + escapeHtml(formatCurrency(row.recovered_value)) + '</div>' +
                    '</div>' +

                    '</div>';
            }).join('')
            : '<div class="info-box">None of your shoes have been confirmed into pairs yet.</div>';

        res.send(renderPage('Confirmed',
            renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/awaiting-confirmation', label: 'Awaiting Confirmation' }]) +
            '<div class="hero"><h1>Confirmed</h1><p>Confirmed pairs involving shoes posted by your store.</p></div>' +
            '<script>function togglePair(id, card) {' +
            '  var el = document.getElementById(id);' +
            '  if (!el) return;' +
            '  var open = el.style.display === "block";' +
            '  el.style.display = open ? "none" : "block";' +
            '  card.classList.toggle("confirmed-pair-open", !open);' +
            '}</script>' +
            '<div class="confirmed-list">' + matchesHtml + '</div>'
        ));
    });
});

//////////////////// AWAITING CONFIRMATION ////////////////////

app.get('/awaiting-confirmation', requireNetwork, (req, res) => {
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;

    const incomingQuery =
        'SELECT pmr.*, ' + pendingRequestSelectFields('s1', 's2') +
        ' FROM pending_match_requests pmr' +
        ' JOIN shoes s1 ON s1.id = pmr.shoe1_id' +
        ' JOIN shoes s2 ON s2.id = pmr.shoe2_id' +
        ' WHERE pmr.network_id = ? AND pmr.target_store_name = ? AND pmr.target_store_number = ? AND pmr.status = \'pending\'' +
        ' ORDER BY pmr.requested_at DESC';

    const outgoingQuery =
        'SELECT pmr.*, ' + pendingRequestSelectFields('s1', 's2') +
        ' FROM pending_match_requests pmr' +
        ' JOIN shoes s1 ON s1.id = pmr.shoe1_id' +
        ' JOIN shoes s2 ON s2.id = pmr.shoe2_id' +
        ' WHERE pmr.network_id = ? AND pmr.requesting_store_name = ? AND pmr.requesting_store_number = ? AND pmr.status = \'pending\'' +
        ' ORDER BY pmr.requested_at DESC';

    db.all(incomingQuery, [networkId, storeName, storeNumber], (incomingErr, incomingRows) => {
        if (incomingErr) {
            console.error(incomingErr.message);
            return res.send('Error loading incoming confirmations');
        }

        db.all(outgoingQuery, [networkId, storeName, storeNumber], (outgoingErr, outgoingRows) => {
            if (outgoingErr) {
                console.error(outgoingErr.message);
                return res.send('Error loading sent confirmations');
            }

            const incomingHtml = incomingRows.length
                ? incomingRows.map(function(row) {
                    const shoe1 = buildShoeFromPrefix(row, 'shoe1');
                    const shoe2 = buildShoeFromPrefix(row, 'shoe2');
                    return '<div class="match-card">' +
                        '<h2 class="section-title">Waiting On Your Store</h2>' +
                        renderShoeCard(shoe1, { altText: 'Incoming shoe 1' }) +
                        renderShoeCard(shoe2, { altText: 'Incoming shoe 2' }) +
                        '<div class="info-box">Requested by ' + escapeHtml(formatText(row.requesting_store_name)) + ' (' + escapeHtml(row.requesting_store_number) + ')</div>' +
                        (row.request_note ? '<p><strong>Request Note:</strong> ' + escapeHtml(row.request_note) + '</p>' : '') +
                        '<div class="card-actions">' +
                        '<button type="button" class="btn-confirm" onclick="toggleRequestForm(\'approve-' + row.id + '\', \'reject-' + row.id + '\')">✓ Confirm</button>' +
                        '<button type="button" class="btn-reject" onclick="toggleRequestForm(\'reject-' + row.id + '\', \'approve-' + row.id + '\')">✕ Reject</button>' +
                        '</div>' +
                        '<form id="approve-' + row.id + '" method="POST" action="/approve-request/' + row.id + '" style="display:none;">' +
                        '<label>Confirmed By</label><input type="text" name="approved_by" required>' +
                        '<label>Confirmation Note (optional)</label><input type="text" name="response_note">' +
                        '<button type="submit">Submit Confirmation</button>' +
                        '</form>' +
                        '<form id="reject-' + row.id + '" method="POST" action="/reject-request/' + row.id + '" class="delete-form" style="display:none;">' +
                        '<label>Rejected By</label><input type="text" name="rejected_by" required>' +
                        '<label>Rejection Note (optional)</label><input type="text" name="response_note">' +
                        '<button type="submit">Submit Rejection</button>' +
                        '</form>' +
                        '</div>';
                }).join('')
                : '<div class="info-box">No confirmations are waiting on your store right now.</div>';

            const outgoingHtml = outgoingRows.length
                ? outgoingRows.map(function(row) {
                    const shoe1 = buildShoeFromPrefix(row, 'shoe1');
                    const shoe2 = buildShoeFromPrefix(row, 'shoe2');
                    return '<div class="match-card">' +
                        '<h2 class="section-title">Sent By Your Store</h2>' +
                        renderShoeCard(shoe1, { altText: 'Outgoing shoe 1' }) +
                        renderShoeCard(shoe2, { altText: 'Outgoing shoe 2' }) +
                        '<div class="info-box">Waiting on ' + escapeHtml(formatText(row.target_store_name)) + ' (' + escapeHtml(row.target_store_number) + ')</div>' +
                        (row.request_note ? '<p><strong>Your Note:</strong> ' + escapeHtml(row.request_note) + '</p>' : '') +
                        '<form method="POST" action="/cancel-request/' + row.id + '" class="delete-form" onsubmit="event.preventDefault(); confirmCancel(this);">' +
                        '<button type="submit">Cancel Request</button>' +
                        '</form>' +
                        '</div>';
                }).join('')
                : '<div class="info-box">You have not sent any pending confirmations.</div>';

            res.send(renderPage('Awaiting Confirmation',
                renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/confirmed-matches', label: 'Confirmed' }]) +
                '<div class="hero"><h1>Awaiting Confirmation</h1><p>Review pending requests sent by your store and requests waiting on your store.</p></div>' +
                '<script>' +
                'function toggleRequestForm(showId, hideId) {' +
                '  var show = document.getElementById(showId);' +
                '  var hide = hideId ? document.getElementById(hideId) : null;' +
                '  if (hide) hide.style.display = "none";' +
                '  if (show) show.style.display = show.style.display === "none" ? "block" : "none";' +
                '}' +
                '</script>' +
                '<h2 class="section-title collapsible" onclick="toggleSection(this, \'incoming-body\')">Waiting On Your Store <span class="toggle-icon">▾</span></h2>' +
                '<div class="collapsible-body" id="incoming-body"><div class="unmatched-grid">' + incomingHtml + '</div></div>' +
                '<h2 class="section-title collapsible" onclick="toggleSection(this, \'outgoing-body\')">Sent By Your Store <span class="toggle-icon">▾</span></h2>' +
                '<div class="collapsible-body" id="outgoing-body"><div class="unmatched-grid">' + outgoingHtml + '</div></div>'
            ));
        });
    });
});

//////////////////// SEND REQUEST ////////////////////

app.post('/send-match-request', requireNetwork, (req, res) => {
    const shoe1Id = parseInt(req.body.shoe1_id);
    const shoe2Id = parseInt(req.body.shoe2_id);
    const requestedBy = (req.body.requested_by || '').trim();
    const requestNote = (req.body.request_note || '').trim();

    const networkId = req.session.network_id;
    const requestingStoreName = req.session.store_name;
    const requestingStoreNumber = req.session.store_number;

    if (Number.isNaN(shoe1Id) || Number.isNaN(shoe2Id) || shoe1Id === shoe2Id) {
        return res.send(renderMessagePage('Invalid Pair', 'The selected shoes could not be used for a request.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/potential-matches', label: 'Back to Potential Matches' }], 'error-box'));
    }

    const [pairShoe1Id, pairShoe2Id] = normalizePairIds(shoe1Id, shoe2Id);

    db.all('SELECT * FROM shoes WHERE network_id = ? AND id IN (?, ?) AND matched = 0',
        [networkId, pairShoe1Id, pairShoe2Id], (err, shoes) => {
            if (err) {
                console.error(err.message);
                return res.send('Error checking selected shoes.');
            }

            if (shoes.length !== 2) {
                return res.send(renderMessagePage('Shoes Not Available', 'One or both shoes are missing or already matched.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/potential-matches', label: 'Back to Potential Matches' }], 'error-box'));
            }

            const ownsOne = shoes.some(function(shoe) {
                return shoe.store_name === requestingStoreName && shoe.store_number === requestingStoreNumber;
            });

            if (!ownsOne) {
                return res.send(renderMessagePage('Not Allowed', 'You can only send requests for pairs involving one of your store\'s shoes.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/potential-matches', label: 'Back to Potential Matches' }], 'error-box'));
            }

            const targetShoe = shoes.find(function(shoe) {
                return !(shoe.store_name === requestingStoreName && shoe.store_number === requestingStoreNumber);
            });

            if (!targetShoe) {
                return res.send(renderMessagePage('Same Store Pair', 'A request is only needed when the opposite shoe belongs to another store.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/potential-matches', label: 'Back to Potential Matches' }], 'error-box'));
            }

            db.get('SELECT id FROM pending_match_requests WHERE network_id = ? AND shoe1_id = ? AND shoe2_id = ? AND status = \'pending\'',
                [networkId, pairShoe1Id, pairShoe2Id], (checkErr, existing) => {
                    if (checkErr) {
                        console.error(checkErr.message);
                        return res.send('Error checking existing request.');
                    }

                    if (existing) {
                        return res.send(renderMessagePage('Request Already Sent', 'A pending request already exists for this pair.',
                            [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Open Awaiting Confirmation' }], 'info-box'));
                    }

                    db.run(
                        'INSERT INTO pending_match_requests (network_id, shoe1_id, shoe2_id, requesting_store_name, requesting_store_number, target_store_name, target_store_number, status, requested_by, request_note) VALUES (?, ?, ?, ?, ?, ?, ?, \'pending\', ?, ?)',
                        [networkId, pairShoe1Id, pairShoe2Id, requestingStoreName, requestingStoreNumber, targetShoe.store_name, targetShoe.store_number,
                            requestedBy || (requestingStoreName + ' ' + requestingStoreNumber), requestNote],
                        function(insertErr) {
                            if (insertErr) {
                                console.error(insertErr.message);
                                return res.send('Error creating request.');
                            }

                            res.send(renderMessagePage('Request Sent', 'The pair request was sent to the opposite store for confirmation.',
                                [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Open Awaiting Confirmation' }, { href: '/potential-matches', label: 'Back to Potential Matches' }],
                                'success-box'));
                        }
                    );
                });
        });
});

//////////////////// APPROVE REQUEST ////////////////////

app.post('/approve-request/:id', requireNetwork, (req, res) => {
    const requestId = parseInt(req.params.id);
    const approvedBy = (req.body.approved_by || '').trim();
    const responseNote = (req.body.response_note || '').trim();

    const networkId = req.session.network_id;
    const targetStoreName = req.session.store_name;
    const targetStoreNumber = req.session.store_number;

    if (Number.isNaN(requestId) || !approvedBy) {
        return res.send('Missing approval details.');
    }

    db.get(
        'SELECT * FROM pending_match_requests WHERE id = ? AND network_id = ? AND target_store_name = ? AND target_store_number = ? AND status = \'pending\'',
        [requestId, networkId, targetStoreName, targetStoreNumber], (err, requestRow) => {
            if (err) {
                console.error(err.message);
                return res.send('Error loading request.');
            }

            if (!requestRow) {
                return res.send(renderMessagePage('Request Not Found', 'That request could not be found or is no longer pending.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'error-box'));
            }

            db.all('SELECT * FROM shoes WHERE network_id = ? AND id IN (?, ?)',
                [networkId, requestRow.shoe1_id, requestRow.shoe2_id], (shoeErr, shoes) => {
                    if (shoeErr) {
                        console.error(shoeErr.message);
                        return res.send('Error checking shoes.');
                    }

                    if (shoes.length !== 2 || shoes.some(function(s) { return s.matched === 1; })) {
                        return res.send(renderMessagePage('Shoes Not Available', 'One or both shoes are already matched or unavailable.',
                            [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'error-box'));
                    }

                    const recoveredValue = Number(shoes[0].original_price || 0);
                    const [pairShoe1Id, pairShoe2Id] = normalizePairIds(requestRow.shoe1_id, requestRow.shoe2_id);

                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        db.run(
                            'UPDATE pending_match_requests SET status = \'confirmed\', responded_at = CURRENT_TIMESTAMP, responded_by = ?, response_note = ? WHERE id = ? AND status = \'pending\'',
                            [approvedBy, responseNote, requestId],
                            function(updateRequestErr) {
                                if (updateRequestErr || this.changes === 0) {
                                    db.run('ROLLBACK');
                                    return res.send('Error updating request.');
                                }

                                db.run('UPDATE shoes SET matched = 1 WHERE network_id = ? AND id IN (?, ?)',
                                    [networkId, pairShoe1Id, pairShoe2Id], function(updateShoesErr) {
                                        if (updateShoesErr) {
                                            db.run('ROLLBACK');
                                            return res.send('Error matching shoes.');
                                        }

                                        db.run(
                                            'INSERT INTO confirmed_matches (network_id, shoe1_id, shoe2_id, confirming_store_name, confirming_store_number, confirmed_by, recovered_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                            [networkId, pairShoe1Id, pairShoe2Id, targetStoreName, targetStoreNumber, approvedBy, recoveredValue],
                                            function(insertErr) {
                                                if (insertErr) {
                                                    db.run('ROLLBACK');
                                                    return res.send('Error saving confirmed match.');
                                                }

                                                db.run('COMMIT', function(commitErr) {
                                                    if (commitErr) {
                                                        db.run('ROLLBACK');
                                                        return res.send('Error finalizing approval.');
                                                    }

                                                    res.send(renderMessagePage('Pair Approved', 'The pair was fully confirmed and counted toward recovered value.',
                                                        [{ href: '/network', label: 'Back to Home' }, { href: '/confirmed-matches', label: 'Open Confirmed' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }],
                                                        'success-box'));
                                                });
                                            }
                                        );
                                    });
                            }
                        );
                    });
                });
        });
});

//////////////////// REJECT REQUEST ////////////////////

app.post('/reject-request/:id', requireNetwork, (req, res) => {
    const requestId = parseInt(req.params.id);
    const rejectedBy = (req.body.rejected_by || '').trim();
    const responseNote = (req.body.response_note || '').trim();

    const networkId = req.session.network_id;
    const targetStoreName = req.session.store_name;
    const targetStoreNumber = req.session.store_number;

    if (Number.isNaN(requestId) || !rejectedBy) {
        return res.send('Missing rejection details.');
    }

    db.run(
        'UPDATE pending_match_requests SET status = \'rejected\', responded_at = CURRENT_TIMESTAMP, responded_by = ?, response_note = ? WHERE id = ? AND network_id = ? AND target_store_name = ? AND target_store_number = ? AND status = \'pending\'',
        [rejectedBy, responseNote, requestId, networkId, targetStoreName, targetStoreNumber],
        function(err) {
            if (err) {
                console.error(err.message);
                return res.send('Error rejecting request.');
            }

            if (this.changes === 0) {
                return res.send(renderMessagePage('Request Not Found', 'That request could not be found or is no longer pending.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'error-box'));
            }

            res.send(renderMessagePage('Request Rejected', 'The pair request was rejected. The shoes remain unmatched.',
                [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'info-box'));
        }
    );
});

//////////////////// CANCEL REQUEST ////////////////////

app.post('/cancel-request/:id', requireNetwork, (req, res) => {
    const requestId = parseInt(req.params.id);
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;

    if (Number.isNaN(requestId)) {
        return res.send(renderMessagePage('Invalid Request', 'That request could not be found.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'error-box'));
    }

    db.run(
        'UPDATE pending_match_requests SET status = \'cancelled\', responded_at = CURRENT_TIMESTAMP WHERE id = ? AND network_id = ? AND requesting_store_name = ? AND requesting_store_number = ? AND status = \'pending\'',
        [requestId, networkId, storeName, storeNumber],
        function(err) {
            if (err) {
                console.error(err.message);
                return res.send('Error cancelling request.');
            }

            if (this.changes === 0) {
                return res.send(renderMessagePage('Request Not Found', 'That request could not be found or is no longer pending.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Back to Awaiting Confirmation' }], 'error-box'));
            }

            res.redirect('/awaiting-confirmation');
        }
    );
});

//////////////////// DELETE OWN SHOE ////////////////////

app.post('/delete-shoe/:id', requireNetwork, (req, res) => {
    const shoeId = parseInt(req.params.id);
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;

    if (Number.isNaN(shoeId)) {
        return res.send(renderMessagePage('Invalid Shoe', 'That shoe could not be found.',
            [{ href: '/network', label: 'Back to Home' }, { href: '/unmatched', label: 'Back to View Singles' }], 'error-box'));
    }

    db.get('SELECT * FROM shoes WHERE id = ? AND network_id = ? AND store_name = ? AND store_number = ?',
        [shoeId, networkId, storeName, storeNumber], (err, shoe) => {
            if (err) {
                console.error(err.message);
                return res.send('Error checking shoe');
            }

            if (!shoe) {
                return res.send(renderMessagePage('Not Allowed', 'You can only delete your own shoe submissions.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/unmatched', label: 'Back to View Singles' }], 'error-box'));
            }

            if (shoe.matched === 1) {
                return res.send(renderMessagePage('Cannot Delete', 'Matched shoes cannot be deleted.',
                    [{ href: '/network', label: 'Back to Home' }, { href: '/unmatched', label: 'Back to View Singles' }], 'error-box'));
            }

            db.get('SELECT id FROM pending_match_requests WHERE network_id = ? AND status = \'pending\' AND (shoe1_id = ? OR shoe2_id = ?)',
                [networkId, shoeId, shoeId], (pendingErr, pendingRequest) => {
                    if (pendingErr) {
                        console.error(pendingErr.message);
                        return res.send('Error checking pending requests.');
                    }

                    if (pendingRequest) {
                        return res.send(renderMessagePage('Cannot Delete', 'This shoe is part of a pending match request. Cancel the request first.',
                            [{ href: '/network', label: 'Back to Home' }, { href: '/awaiting-confirmation', label: 'Open Awaiting Confirmation' }], 'error-box'));
                    }

                    db.run('DELETE FROM shoes WHERE id = ? AND network_id = ? AND store_name = ? AND store_number = ? AND matched = 0',
                        [shoeId, networkId, storeName, storeNumber], function(deleteErr) {
                            if (deleteErr) {
                                console.error(deleteErr.message);
                                return res.send('Error deleting shoe');
                            }

                            res.redirect('/unmatched');
                        });
                });
        });
});

//////////////////// VIEW SINGLES ////////////////////

app.get('/unmatched', requireNetwork, (req, res) => {
    let { search, brand, gender, side, store_filter } = req.query;

    const networkId = req.session.network_id;
    const currentStoreName = req.session.store_name;
    const currentStoreNumber = req.session.store_number;

    search = search ? search.toLowerCase().trim() : '';
    brand = brand ? brand.toLowerCase().trim() : '';
    gender = gender ? gender.toLowerCase().trim() : '';
    side = side ? side.toLowerCase().trim() : '';
    store_filter = store_filter ? store_filter.trim() : '';

    db.all('SELECT DISTINCT store_name, store_number FROM shoes WHERE matched = 0 AND network_id = ? ORDER BY store_name, store_number',
        [networkId], (storeErr, stores) => {
            if (storeErr) {
                console.error(storeErr.message);
                return res.send('Error loading store list');
            }

            let query = 'SELECT * FROM shoes WHERE matched = 0 AND network_id = ?';
            const params = [networkId];

            if (search) {
                query += ' AND (LOWER(model) LIKE ? OR LOWER(sku) LIKE ?)';
                const val = '%' + search + '%';
                params.push(val, val);
            }
            if (brand) { query += ' AND LOWER(brand) = ?'; params.push(brand); }
            if (gender) { query += ' AND LOWER(gender) = ?'; params.push(gender); }
            if (side) { query += ' AND LOWER(side) = ?'; params.push(side); }
            if (store_filter) {
                const parts = store_filter.split('|||');
                query += ' AND store_name = ? AND store_number = ?';
                params.push(parts[0], parts[1]);
            }

            query += ' ORDER BY brand, model, size';

            db.all(query, params, (err, shoes) => {
                if (err) {
                    console.error(err.message);
                    return res.send('Error loading single shoes');
                }

                let storeOptions = '<option value="">All Stores</option>';
                stores.forEach(function(s) {
                    const value = s.store_name + '|||' + s.store_number;
                    const selected = store_filter === value ? 'selected' : '';
                    storeOptions += '<option value="' + escapeHtml(value) + '" ' + selected + '>' + escapeHtml(formatText(s.store_name)) + ' - ' + escapeHtml(s.store_number) + '</option>';
                });

                const shoesHtml = shoes.length === 0
                    ? '<div class="info-box">No single shoes found.</div>'
                    : shoes.map(function(shoe) {
                        const canDelete = shoe.store_name === currentStoreName && shoe.store_number === currentStoreNumber;
                        return '<div class="match-card">' +
                            renderShoeCard(shoe, { altText: 'Single shoe' }) +
                            (canDelete ? '<form method="POST" action="/delete-shoe/' + shoe.id + '" class="delete-form" onsubmit="event.preventDefault(); confirmDelete(this);">' +
                                '<button type="submit">Delete</button></form>' : '') +
                            '</div>';
                    }).join('');

                const brandOptions = ['nike', 'adidas', 'jordan', 'new balance', 'puma', 'under armour', 'reebok', 'asics', 'converse', 'vans', 'skechers'];
                const brandSelect = '<select name="brand"><option value="">All Brands</option>' +
                    brandOptions.map(function(b) { return '<option value="' + b + '" ' + (brand === b ? 'selected' : '') + '>' + formatText(b) + '</option>'; }).join('') + '</select>';

                res.send(renderPage('View Singles',
                    renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/add', label: 'Add Single Shoe' }]) +
                    '<div class="hero"><h1>Single Shoes</h1><p>All unmatched shoes in the network.</p><p><strong>' + shoes.length + ' total</strong></p></div>' +
                    '<form method="GET" action="/unmatched" class="filter-form" autocomplete="off">' +
                    '<input type="text" name="search" placeholder="Search by model or SKU..." value="' + escapeHtml(search) + '">' +
                    brandSelect +
                    '<select name="gender"><option value="">All Genders</option><option value="men" ' + (gender === 'men' ? 'selected' : '') + '>Men</option><option value="women" ' + (gender === 'women' ? 'selected' : '') + '>Women</option><option value="kids" ' + (gender === 'kids' ? 'selected' : '') + '>Kids</option></select>' +
                    '<select name="side"><option value="">All Sides</option><option value="left" ' + (side === 'left' ? 'selected' : '') + '>Left</option><option value="right" ' + (side === 'right' ? 'selected' : '') + '>Right</option></select>' +
                    '<select name="store_filter">' + storeOptions + '</select>' +
                    '<button type="submit">Apply Filters</button>' +
                    '</form>' +
                    '<div class="unmatched-grid">' + shoesHtml + '</div>'
                ));
            });
        });
});

//////////////////// POTENTIAL MATCHES ////////////////////

app.get('/potential-matches', requireNetwork, (req, res) => {
    let { search, brand, gender } = req.query;
    const networkId = req.session.network_id;
    const storeName = req.session.store_name;
    const storeNumber = req.session.store_number;

    search = search ? search.toLowerCase().trim() : '';
    brand = brand ? brand.toLowerCase().trim() : '';
    gender = gender ? gender.toLowerCase().trim() : '';

    let pairQuery =
        'SELECT s1.id AS shoe1_id, s2.id AS shoe2_id, ' + pendingRequestSelectFields('s1', 's2') +
        ' FROM shoes s1' +
        ' JOIN shoes s2 ON s1.network_id = s2.network_id AND s1.brand = s2.brand AND s1.model = s2.model AND s1.gender = s2.gender AND s1.color = s2.color AND s1.size = s2.size AND s1.side != s2.side AND s1.id < s2.id' +
        ' WHERE s1.network_id = ? AND s1.matched = 0 AND s2.matched = 0' +
        ' AND ((s1.store_name = ? AND s1.store_number = ?) OR (s2.store_name = ? AND s2.store_number = ?))' +
        ' AND NOT EXISTS (SELECT 1 FROM pending_match_requests pmr WHERE pmr.network_id = s1.network_id AND pmr.shoe1_id = s1.id AND pmr.shoe2_id = s2.id AND pmr.status = \'pending\')';

    const params = [networkId, storeName, storeNumber, storeName, storeNumber];

    if (search) {
        pairQuery += ' AND (LOWER(s1.model) LIKE ? OR LOWER(s1.sku) LIKE ?)';
        const sv = '%' + search + '%';
        params.push(sv, sv);
    }
    if (brand) { pairQuery += ' AND LOWER(s1.brand) = ?'; params.push(brand); }
    if (gender) { pairQuery += ' AND LOWER(s1.gender) = ?'; params.push(gender); }

    pairQuery += ' ORDER BY s1.brand, s1.model, s1.size';

    db.all(pairQuery, params, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send('Error loading potential matches');
        }

        if (rows.length === 0) {
            return res.send(renderPage('Potential Matches',
                renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/add', label: 'Add Single Shoe' }]) +
                '<div class="hero"><h1>Potential Matches</h1><p>You currently have no potential matches for your store\'s shoes.</p></div>'
            ));
        }

        const brandOptions = ['nike', 'adidas', 'jordan', 'new balance', 'puma', 'under armour', 'reebok', 'asics', 'converse', 'vans', 'skechers'];
        const brandSelect = '<select name="brand"><option value="">All Brands</option>' +
            brandOptions.map(function(b) { return '<option value="' + b + '" ' + (brand === b ? 'selected' : '') + '>' + formatText(b) + '</option>'; }).join('') + '</select>';

        const pairsHtml = rows.map(function(row) {
            const shoe1 = buildShoeFromPrefix(row, 'shoe1');
            const shoe2 = buildShoeFromPrefix(row, 'shoe2');
            return '<div class="match-card">' +
                '<h2 class="section-title">Potential Pair</h2>' +
                renderShoeCard(shoe1, { title: 'Shoe 1', altText: 'Potential shoe 1' }) +
                renderShoeCard(shoe2, { title: 'Shoe 2', altText: 'Potential shoe 2' }) +
                '<form method="POST" action="/send-match-request" autocomplete="off">' +
                '<input type="hidden" name="shoe1_id" value="' + row.shoe1_id + '">' +
                '<input type="hidden" name="shoe2_id" value="' + row.shoe2_id + '">' +
                '<label>Requested By</label><input type="text" name="requested_by" required>' +
                '<label>Request Note (optional)</label><input type="text" name="request_note">' +
                '<div style="margin-top:20px;"><button type="submit">Send Confirmation Request</button></div>' +
                '</form></div>';
        }).join('');

        res.send(renderPage('Potential Matches',
            renderTopLinks([{ href: '/network', label: 'Home' }, { href: '/unmatched', label: 'Single Shoes' }, { href: '/awaiting-confirmation', label: 'Awaiting Confirmation' }]) +
            '<div class="hero"><h1>Potential Matches</h1><p>Possible matches involving your store\'s shoes.</p><p><strong>' + rows.length + ' potential pair' + (rows.length === 1 ? '' : 's') + '</strong></p></div>' +
            '<form method="GET" action="/potential-matches" class="filter-form" autocomplete="off">' +
            '<input type="text" name="search" placeholder="Search by model or SKU..." value="' + escapeHtml(search) + '">' +
            brandSelect +
            '<select name="gender"><option value="">All Genders</option><option value="men" ' + (gender === 'men' ? 'selected' : '') + '>Men</option><option value="women" ' + (gender === 'women' ? 'selected' : '') + '>Women</option><option value="kids" ' + (gender === 'kids' ? 'selected' : '') + '>Kids</option></select>' +
            '<button type="submit">Apply Filters</button>' +
            '</form>' +
            '<div class="unmatched-grid">' + pairsHtml + '</div>'
        ));
    });
});

//////////////////// ERROR HANDLER ////////////////////

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).send('Something went wrong.');
});

//////////////////// START ////////////////////

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on http://localhost:' + PORT);
});
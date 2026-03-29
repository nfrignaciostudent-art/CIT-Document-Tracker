/* ══════════════════════════════════════════════════════════════════════
   CIT DOCUMENT TRACKER — TRACKING FIX  (FedEx Static QR Model)
   Group 6 · Vanilla JS · LocalStorage · qrcode.min.js

   WHAT THIS FILE FIXES / ADDS:
   ─────────────────────────────────────────────────────────────────────
   RULE 1 → buildQR()           — QR encodes ONLY ?track=DOC-XXXXX
   RULE 1 → showRegisterReceipt() — receipt QR also uses static ID URL
   RULE 2 → initTrackingPage()  — reads live data from LocalStorage
   RULE 3 → (inside initTrackingPage) conditional file release
   RULE 4 → searchByTrackingId() + public ?search=1 landing form

   HOW TO APPLY:
   1. In index__6_.html, FIND each function by name and REPLACE it
      entirely with the corrected version below.
   2. ADD the HTML snippets from tracking-additions.html into the page.
   3. Remove encodeSnapshot / decodeSnapshot calls from QR generation
      (they are still kept for ?apply= admin update links — do NOT
      delete those two helper functions, only stop using them in QR).
══════════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────────────
   RULE 1 — STATIC QR BUILDER
   REPLACES: the existing buildQR() function (search for "function buildQR")
   KEY CHANGE: URL is now always  baseUrl + "?track=" + d.id
               Nothing else is encoded. The QR NEVER changes.
───────────────────────────────────────────────────────────────────── */
function buildQR(id, baseUrl) {
  const d = docs.find(function(d){ return d.id === id; });
  if (!d) return;

  const wrap        = document.getElementById('qr-wrap');
  const urlPreviewEl= document.getElementById('qr-url-preview');
  const urlTextEl   = document.getElementById('qr-url-text');
  const hintEl      = document.getElementById('qr-enc-hint');

  /* ── RULE 1: Only the Document ID goes into the QR. ──
     The URL is permanent and never changes, even after status updates. */
  const cleanBase = (baseUrl || window.location.origin + window.location.pathname)
                      .replace(/\/+$/, '').split('?')[0];
  const trackUrl  = cleanBase + '?track=' + d.id;

  if (urlTextEl)    urlTextEl.textContent  = trackUrl;
  if (urlPreviewEl) urlPreviewEl.style.display = 'block';
  if (hintEl)       hintEl.textContent = '🔒 Permanent URL · ID: ' + d.id + ' · Never changes';

  wrap.innerHTML = '';
  const target = document.createElement('div');
  wrap.appendChild(target);
  new QRCode(target, {
    text: trackUrl,
    width: 200,
    height: 200,
    correctLevel: QRCode.CorrectLevel.M
  });
}


/* ─────────────────────────────────────────────────────────────────────
   RULE 1 — RECEIPT QR (shown after document registration)
   REPLACES: the QR-generation block inside showRegisterReceipt()
   Find the comment "QR payload" inside showRegisterReceipt and replace
   everything from that comment down to the new QRCode() call.
   
   Paste the block below INSIDE showRegisterReceipt(), replacing:
       const snap = { … }
       const encoded = encodeSnapshot(snap);
       const baseUrl = …
       const trackUrl = baseUrl + '?track=' + encoded;
       …new QRCode(…)
   with this:
───────────────────────────────────────────────────────────────────── */
function _receiptQRBlock(doc) {
  /* RULE 1 — Static, permanent tracking URL (ID only, no snapshot) */
  const baseUrl  = (getSavedBaseUrl() || window.location.origin + window.location.pathname)
                     .replace(/\/+$/, '').split('?')[0];
  const trackUrl = baseUrl + '?track=' + doc.id;

  document.getElementById('receipt-qr-url').textContent = trackUrl;

  const wrap   = document.getElementById('receipt-qr-wrap');
  wrap.innerHTML = '';
  const target = document.createElement('div');
  wrap.appendChild(target);
  new QRCode(target, {
    text: trackUrl,
    width: 200,
    height: 200,
    correctLevel: QRCode.CorrectLevel.M
  });
}
/*
   ↑ IMPORTANT: Do not call _receiptQRBlock as a separate function.
     Copy the body of _receiptQRBlock and paste it directly inside
     showRegisterReceipt(), replacing the old snapshot block.
     Or rename and call it from there — either is fine.
*/


/* ─────────────────────────────────────────────────────────────────────
   RULES 2, 3, 4 — PUBLIC TRACKING PAGE
   REPLACES: the entire existing initTrackingPage() function
   (search for "function initTrackingPage")
───────────────────────────────────────────────────────────────────── */
function initTrackingPage() {
  const params     = new URLSearchParams(window.location.search);
  const trackParam = params.get('track');   // e.g. "DOC-1A2B3"  ← plain ID only
  const applyParam = params.get('apply');   // admin update link (keep as-is)
  const searchMode = params.has('search');  // ?search  → show public search form

  /* ── Keep the admin ?apply= link working (untouched logic) ── */
  if (applyParam) {
    load();
    try {
      const update = decodeSnapshot(applyParam);
      const idx    = docs.findIndex(function(d){ return d.id === update.docId; });
      if (idx === -1) {
        confirm('⚠️ Document not found in this browser.\nAre you the admin? Make sure you are on the correct device.');
        return false;
      }
      const doc = docs[idx];
      if (!doc.history) doc.history = [];
      doc.history.push({
        status:   update.status,
        date:     update.date,
        by:       update.handler,
        location: update.location,
        handler:  update.handler,
        note:     update.note
      });
      doc.status = update.status;
      save();
      typeof renderAll === 'function' && renderAll();
      window.history.replaceState({}, '', window.location.pathname);
      alert('✅ Update applied!\n\nDocument: ' + doc.name +
            '\nNew status: ' + update.status +
            '\nLocation: '  + (update.location || '—') +
            '\nHandler: '   + (update.handler  || '—'));
    } catch (e) { alert('Could not apply update. Invalid link.'); }
    return false;
  }

  /* ── Public Search Mode: ?search → show "Track by ID" landing form ── */
  if (searchMode && !trackParam) {
    _showTrackScreen();
    _renderPublicSearchForm();
    return true;
  }

  /* ── No track param → this is the admin login page, do nothing ── */
  if (!trackParam) return false;

  /* ── RULE 2: Load LocalStorage, find document by plain ID ── */
  load();  // pulls docs array fresh from localStorage

  _showTrackScreen();

  /* Validate format — if it's an old base64 snapshot, reject it */
  if (!trackParam.startsWith('DOC-')) {
    _renderTrackHero({
      badge: '⚠️',
      badgeStyle: 'background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3)',
      title: 'Outdated QR Code',
      meta: 'This QR was generated with an old version of the system.'
    });
    document.getElementById('track-content-body').innerHTML = `
      <div class="track-not-found">
        <h2>Old QR Format Detected</h2>
        <p>Your QR code encodes a snapshot instead of a static ID.<br>
           Please ask your administrator to open the document in the admin panel,
           click <strong>QR</strong>, and generate a new permanent QR code to reprint.</p>
        <br>
        <p style="font-size:12px;color:rgba(255,255,255,.3)">
          If you know your Tracking ID, you can also use the
          <a href="?search" style="color:#4ade80">Track by ID</a> form.
        </p>
      </div>`;
    return true;
  }

  const d = docs.find(function(x){ return x.id === trackParam; });

  if (!d) {
    _renderTrackHero({
      badge: '🔍',
      badgeStyle: 'background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3)',
      title: 'Document Not Found',
      meta: trackParam + ' — not found in this device\'s LocalStorage'
    });
    document.getElementById('track-content-body').innerHTML = `
      <div class="track-not-found">
        <h2>Document Not Found</h2>
        <p>This tracking ID (<code style="color:#4ade80">${trackParam}</code>) was not found.<br><br>
           <strong>Remember:</strong> Because this system uses LocalStorage (no backend),
           the tracking page only works on the <em>same device and browser</em>
           where the document was originally registered.<br><br>
           If you are the administrator, make sure you are using the correct browser on the correct computer.
        </p>
      </div>`;
    return true;
  }

  /* ── Render full tracking view ── */
  _renderFullTrackingView(d);
  return true;
}


/* ─────────────────────────────────────────────────────────────────────
   RULE 4 — STUDENT "TRACK BY ID" SEARCH (logged-in app page)
   This function is called by the "Track Document" nav page inside the app.
   It searches LocalStorage directly — no login to the tracking URL needed.
───────────────────────────────────────────────────────────────────── */
function searchByTrackingId() {
  const raw   = (document.getElementById('track-id-input').value || '').trim().toUpperCase();
  const docId = raw.startsWith('DOC-') ? raw : 'DOC-' + raw;
  const result= document.getElementById('track-search-result');
  const qrDiv = document.getElementById('track-search-qr');

  if (!raw) { toast('Please enter a Tracking ID.'); return; }

  const d = docs.find(function(x){ return x.id === docId; });

  if (!d) {
    result.style.display = 'block';
    result.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:32px">
          <div style="font-size:36px;margin-bottom:12px">🔍</div>
          <p style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">
            Document Not Found
          </p>
          <p style="font-size:13px;color:var(--muted)">
            No document with ID <code>${docId}</code> exists in this device.
          </p>
        </div>
      </div>`;
    return;
  }

  /* ── Build the timeline HTML ── */
  const statusColors = {
    Released:'#22c55e', Rejected:'#ef4444', Approved:'#16a34a',
    Signed:'#16a34a', Processing:'#f59e0b', Pending:'#f59e0b',
    'For Approval':'#3b82f6', Received:'#64748b'
  };
  const sc       = statusColors[d.status] || '#64748b';
  const workflow = ['Received','Processing','For Approval','Approved','Released'];
  const curIdx   = workflow.indexOf(d.status);
  const isRejected= d.status === 'Rejected';

  const wfDots = isRejected
    ? `<div style="text-align:center;width:100%;padding:8px 0">
         <span style="font-size:13px;color:#ef4444;font-weight:600">⛔ Document was Rejected</span>
       </div>`
    : workflow.map(function(step, i){
        const done = curIdx > i, curr = curIdx === i;
        const dotCls = done ? 'done' : curr ? 'current' : '';
        return (i > 0 ? '<div class="twf-arrow">›</div>' : '') +
          `<div class="twf-step">
             <div class="twf-dot ${dotCls}">${done ? '✓' : i + 1}</div>
             <div class="twf-label ${dotCls}">${step}</div>
           </div>`;
      }).join('');

  const hist    = d.history || [];
  const histHtml= hist.length === 0
    ? '<p style="font-size:13px;color:var(--muted)">No history recorded.</p>'
    : [...hist].reverse().map(function(h){
        const dotCls = (h.status || '').toLowerCase().replace(/\s+/g,'');
        return `<div class="ttl-item">
          <div class="ttl-dot ${dotCls}"></div>
          <div class="ttl-status-label">${h.status}</div>
          <div class="ttl-meta">Updated by ${h.by || '—'} &nbsp;·&nbsp; ${h.date}</div>
          ${(h.location || h.handler)
            ? `<div class="ttl-loc">
                 ${h.location ? '📍 ' + h.location : ''}
                 ${h.location && h.handler ? ' &nbsp;·&nbsp; ' : ''}
                 ${h.handler ? '👤 ' + h.handler : ''}
               </div>`
            : ''}
          ${h.note ? `<div class="ttl-note">"${h.note}"</div>` : ''}
        </div>`;
      }).join('');

  /* ── RULE 3: Conditional file section ── */
  const lockedStatuses = ['Pending','Received','Processing'];
  const isReleased     = d.status === 'Released';
  const isLocked       = lockedStatuses.includes(d.status) ||
                         (!isReleased && d.status !== 'Released');

  let fileSection = '';
  if (d.fileData) {
    if (isReleased) {
      const ext = (d.fileExt || '').toLowerCase();
      const preview = ext === '.pdf'
        ? `<iframe src="${d.fileData}" style="width:100%;height:320px;border:1px solid var(--border);border-radius:8px;margin-bottom:14px" title="Document Preview"></iframe>`
        : ['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)
          ? `<img src="${d.fileData}" alt="Document" style="max-width:100%;max-height:320px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px">`
          : `<p style="font-size:13px;color:var(--muted);margin-bottom:14px">Preview not available for this file type.</p>`;
      fileSection = `
        <div class="card" style="margin-top:14px">
          <div class="card-head"><h3>📎 Attached File — Released</h3></div>
          <div class="card-body" style="text-align:center">
            <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
              background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;
              font-size:11px;font-weight:700;color:#16a34a;margin-bottom:14px">
              ✅ Available for Download
            </div>
            ${preview}
            <a href="${d.fileData}"
               download="${d.name.replace(/[^a-z0-9_\-]/gi,'_')}${d.fileExt || ''}"
               class="btn btn-primary"
               style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
              ⬇ Download File
            </a>
          </div>
        </div>`;
    } else {
      fileSection = `
        <div class="card" style="margin-top:14px">
          <div class="card-head"><h3>📎 Attached File</h3></div>
          <div class="card-body" style="text-align:center;padding:28px">
            <div style="font-size:36px;margin-bottom:10px">🔒</div>
            <p style="font-size:14px;font-weight:600;margin-bottom:6px">File is Secured</p>
            <p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.6">
              The attached file will be downloadable once the status reaches
              <strong>Released</strong>.<br>Current status:
              <strong style="color:${sc}">${d.status}</strong>
            </p>
          </div>
        </div>`;
    }
  }

  /* ── Regenerate the permanent QR code ── */
  const baseUrl  = (getSavedBaseUrl() || window.location.origin + window.location.pathname)
                     .replace(/\/+$/, '').split('?')[0];
  const trackUrl = baseUrl + '?track=' + d.id;

  result.style.display = 'block';
  result.innerHTML = `
    <div class="card">
      <div class="card-head" style="background:#f8fafc">
        <div>
          <h3>${d.name}</h3>
          <p style="font-size:12px;color:var(--muted);font-family:'DM Mono',monospace">${d.id} · ${d.type}</p>
        </div>
        <span class="badge badge-${(d.status||'').toLowerCase().replace(/\s+/g,'')}">${d.status}</span>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;flex-wrap:wrap">

          <!-- Left: QR re-generation -->
          <div style="text-align:center">
            <p style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
              📱 Your Permanent QR Code
            </p>
            <div id="track-search-qr"
                 style="display:inline-block;padding:12px;background:#fff;border:2px solid var(--border);border-radius:12px;margin-bottom:8px">
            </div>
            <p style="font-size:10px;color:var(--muted);margin-bottom:4px">Scan to track · Always shows live status</p>
            <p style="font-size:9px;color:#94a3b8;font-family:'DM Mono',monospace;word-break:break-all;max-width:200px;margin:0 auto;line-height:1.5">
              ${trackUrl}
            </p>
          </div>

          <!-- Right: Timeline -->
          <div>
            <p style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">
              Document Progress
            </p>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:18px" class="track-workflow">
              ${wfDots}
            </div>
            <p style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">
              Status Timeline
            </p>
            <div class="track-timeline" style="background:rgba(0,0,0,.02);border-radius:8px;padding:14px 14px 14px 32px">
              ${histHtml}
            </div>
          </div>

        </div>
      </div>
    </div>
    ${fileSection}`;

  /* Generate QR into the div we just created */
  const qrTarget = document.getElementById('track-search-qr');
  if (qrTarget) {
    new QRCode(qrTarget, {
      text: trackUrl,
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  toast('✅ Document found! QR code regenerated.');
}


/* ══════════════════════════════════════════════════════════════════════
   INTERNAL HELPERS — used by initTrackingPage above.
   Add these anywhere in your script block (they are new functions).
══════════════════════════════════════════════════════════════════════ */

/* Show the full-screen dark tracking overlay and hide auth */
function _showTrackScreen() {
  document.getElementById('auth-screen').classList.remove('auth-show');
  document.getElementById('track-screen').classList.add('show');
}

/* Render just the hero section of the tracking page */
function _renderTrackHero(opts) {
  document.getElementById('track-content-hero').innerHTML = `
    <div class="track-doc-badge" style="${opts.badgeStyle || ''}">${opts.badge || '📄'}</div>
    <div class="track-doc-name">${opts.title || ''}</div>
    <div class="track-doc-meta">${opts.meta || ''}</div>`;
}

/* Render the public "Track by ID" search form (for ?search landing) */
function _renderPublicSearchForm() {
  document.getElementById('track-content-hero').innerHTML = `
    <div class="track-doc-badge" style="background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.3);font-size:22px">🔍</div>
    <div class="track-doc-name">Track Your Document</div>
    <div class="track-doc-meta">Enter your Tracking ID to see live status</div>`;

  document.getElementById('track-content-body').innerHTML = `
    <div class="track-card">
      <div class="track-card-head"><h3>Find Your Document</h3></div>
      <div class="track-card-body">
        <p style="font-size:13px;color:rgba(255,255,255,.45);margin-bottom:16px;line-height:1.6">
          Type your Tracking ID below (e.g. <code style="color:#4ade80;background:rgba(74,222,128,.08);
          padding:2px 7px;border-radius:4px">DOC-12345</code>).
          This shows the live status and regenerates your QR code if you lost it.
        </p>
        <div style="display:flex;gap:10px;max-width:440px">
          <input id="pub-track-input" type="text" placeholder="DOC-12345"
            style="flex:1;padding:11px 14px;border:1px solid rgba(255,255,255,.15);border-radius:8px;
                   font-family:'DM Mono',monospace;font-size:14px;color:#e6edf3;
                   background:rgba(255,255,255,.06);outline:none;text-transform:uppercase;"
            oninput="this.value=this.value.toUpperCase()"
            onkeydown="if(event.key==='Enter') publicTrackSearch()">
          <button onclick="publicTrackSearch()"
            style="padding:11px 20px;background:#4ade80;color:#0d1117;border:none;border-radius:8px;
                   font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;
                   white-space:nowrap;transition:background .15s"
            onmouseover="this.style.background='#22c55e'"
            onmouseout="this.style.background='#4ade80'">
            Search →
          </button>
        </div>
        <div id="pub-track-result" style="margin-top:22px"></div>
      </div>
    </div>`;
}

/* Called from the public ?search landing form */
function publicTrackSearch() {
  const raw   = (document.getElementById('pub-track-input').value || '').trim().toUpperCase();
  const docId = raw.startsWith('DOC-') ? raw : (raw ? 'DOC-' + raw : '');
  const out   = document.getElementById('pub-track-result');

  if (!docId) {
    out.innerHTML = `<p style="font-size:13px;color:#f87171">Please enter a Tracking ID.</p>`;
    return;
  }

  load(); // fresh pull from LocalStorage
  const d = docs.find(function(x){ return x.id === docId; });

  if (!d) {
    out.innerHTML = `
      <div style="text-align:center;padding:28px 0">
        <div style="font-size:36px;margin-bottom:10px">🔍</div>
        <p style="font-size:14px;color:rgba(255,255,255,.6);font-weight:600;margin-bottom:6px">
          Document Not Found
        </p>
        <p style="font-size:12px;color:rgba(255,255,255,.3);line-height:1.6">
          <code style="color:#4ade80">${docId}</code> was not found.<br>
          Remember: tracking only works on the device where the document was registered.
        </p>
      </div>`;
    return;
  }

  /* Found — render the full tracking view and scroll down */
  _renderFullTrackingView(d);
  document.getElementById('track-content-body').scrollIntoView({ behavior: 'smooth' });
}

/* ─────────────────────────────────────────────────────────────────────
   RULE 2 + 3: Core renderer — builds the full dark tracking page view.
   Used by both initTrackingPage() and publicTrackSearch().
───────────────────────────────────────────────────────────────────── */
function _renderFullTrackingView(d) {
  const statusColors = {
    Released:'#22c55e', Rejected:'#ef4444', Approved:'#16a34a',
    Signed:'#16a34a', Processing:'#f59e0b', Pending:'#f59e0b',
    'For Approval':'#3b82f6', Received:'#64748b'
  };
  const sc         = statusColors[d.status] || '#64748b';
  const workflow   = ['Received','Processing','For Approval','Approved','Released'];
  const curIdx     = workflow.indexOf(d.status);
  const isRejected = d.status === 'Rejected';
  const isReleased = d.status === 'Released';
  const lastLoc    = typeof getLatestLocation === 'function'
                       ? getLatestLocation(d)
                       : { location: '', handler: '' };
  const office     = typeof docOffice === 'function' ? docOffice(d.type) : d.type;

  /* ── Hero ── */
  document.getElementById('track-content-hero').innerHTML = `
    <div class="track-doc-badge" style="background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.25)">🔐</div>
    <div class="track-doc-name">${d.name}</div>
    <div class="track-doc-meta">${d.id} &nbsp;·&nbsp; ${d.type}</div>
    <div class="track-status-pill"
         style="background:${sc}22;border:1px solid ${sc}55;color:${sc}">
      <span style="width:8px;height:8px;border-radius:50%;background:${sc};display:inline-block${
        d.status !== 'Rejected' && d.status !== 'Released' ? ';animation:pulse 1.5s infinite' : ''
      }"></span>
      ${d.status}
    </div>`;

  /* ── Workflow dots ── */
  const wfHtml = isRejected
    ? `<div style="text-align:center;width:100%;padding:8px 0">
         <span style="font-size:13px;color:#f87171;font-weight:600">⛔ Document was Rejected</span>
         <p style="font-size:12px;color:rgba(255,255,255,.3);margin-top:4px">Check the history below for details.</p>
       </div>`
    : workflow.map(function(step, i){
        const done = curIdx > i, curr = curIdx === i;
        const cls  = done ? 'done' : curr ? 'current' : '';
        return (i > 0 ? '<div class="twf-arrow">›</div>' : '') +
          `<div class="twf-step">
             <div class="twf-dot ${cls}">${done ? '✓' : i + 1}</div>
             <div class="twf-label ${cls}">${step}</div>
           </div>`;
      }).join('');

  /* ── History timeline ── */
  const hist    = d.history || [];
  const histHtml= hist.length === 0
    ? '<p style="font-size:13px;color:rgba(255,255,255,.3)">No history recorded.</p>'
    : [...hist].reverse().map(function(h){
        const dotCls = (h.status || '').toLowerCase().replace(/\s+/g,'');
        return `<div class="ttl-item">
          <div class="ttl-dot ${dotCls}"></div>
          <div class="ttl-status-label">${h.status}</div>
          <div class="ttl-meta">Updated by ${h.by || '—'} &nbsp;·&nbsp; ${h.date}</div>
          ${(h.location || h.handler)
            ? `<div class="ttl-loc">
                 ${h.location ? '📍 ' + h.location : ''}
                 ${h.location && h.handler ? ' &nbsp;·&nbsp; ' : ''}
                 ${h.handler ? '👤 ' + h.handler : ''}
               </div>`
            : ''}
          ${h.note ? `<div class="ttl-note">"${h.note}"</div>` : ''}
        </div>`;
      }).join('');

  const relEntry    = [...hist].reverse().find(function(h){ return h.status === 'Released'; });
  const releaseDate = relEntry ? relEntry.date : '—';

  /* ── RULE 3: Conditional file section ─────────────────────────────
     - "Pending" / "Received" / "Processing" (and any non-Released status)
       → show lock box, NO file access.
     - "Released" → show preview + download button.
  ─────────────────────────────────────────────────────────────────── */
  let fileSection = '';
  if (d.fileData) {
    if (isReleased) {
      /* File is accessible */
      const ext = (d.fileExt || '').toLowerCase();
      const preview = ext === '.pdf'
        ? `<iframe src="${d.fileData}" style="width:100%;height:400px;border:1px solid rgba(255,255,255,.1);border-radius:8px;margin-bottom:14px" title="Document Preview"></iframe>`
        : ['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)
          ? `<img src="${d.fileData}" alt="Document preview" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid rgba(255,255,255,.1);margin-bottom:14px">`
          : `<p style="font-size:13px;color:rgba(255,255,255,.4);padding:20px 0">Preview not available for this file type.</p>`;
      fileSection = `
        <div class="track-card">
          <div class="track-card-head"><h3>📎 &nbsp;Attached File</h3></div>
          <div class="track-card-body" style="text-align:center">
            <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
              background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:20px;
              font-size:11px;font-weight:700;color:#22c55e;margin-bottom:16px">
              ✅ Released — File Available for Download
            </div>
            ${preview}
            <a href="${d.fileData}"
               download="${d.name.replace(/[^a-z0-9_\-]/gi,'_')}${d.fileExt || ''}"
               style="display:inline-flex;align-items:center;gap:8px;padding:11px 24px;
                      background:#22c55e;color:#0d1117;border-radius:8px;
                      font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;text-decoration:none;">
              ⬇ Download File
            </a>
          </div>
        </div>`;
    } else {
      /* File exists but status is NOT Released — hide it completely */
      fileSection = `
        <div class="track-card">
          <div class="track-card-head"><h3>📎 &nbsp;Attached File</h3></div>
          <div class="track-card-body" style="text-align:center;padding:32px">
            <div style="font-size:40px;margin-bottom:12px">🔒</div>
            <p style="font-size:14px;color:rgba(255,255,255,.7);font-weight:600;margin-bottom:8px">File is Secured</p>
            <p style="font-size:12px;color:rgba(255,255,255,.35);line-height:1.7;margin-bottom:16px">
              A file is attached to this document.<br>
              It will be available to download once the status reaches
              <strong style="color:rgba(74,222,128,.8)">Released</strong>.
            </p>
            <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;
              background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
              border-radius:20px;font-size:12px;color:rgba(255,255,255,.45)">
              Current status: <strong style="color:${sc};margin-left:4px">${d.status}</strong>
            </div>
          </div>
        </div>`;
    }
  } else {
    /* No file attached at all */
    fileSection = `
      <div class="track-card">
        <div class="track-card-head"><h3>📎 &nbsp;Attached File</h3></div>
        <div class="track-card-body" style="text-align:center;padding:28px">
          <p style="font-size:13px;color:rgba(255,255,255,.3)">No digital file attached to this document.</p>
        </div>
      </div>`;
  }

  /* ── RULE 3: Assemble body ── */
  document.getElementById('track-content-body').innerHTML = `

    <!-- Workflow progress bar -->
    <div class="track-card">
      <div class="track-card-head"><h3>Document Progress</h3></div>
      <div class="track-workflow">${wfHtml}</div>
    </div>

    <!-- Current location banner -->
    ${(lastLoc.location || lastLoc.handler)
      ? `<div class="track-card">
           <div class="track-card-body" style="display:flex;gap:20px;flex-wrap:wrap;padding:14px 20px">
             ${lastLoc.location
               ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px">
                    <span style="color:rgba(74,222,128,.5)">📍 Location</span>
                    <strong style="color:rgba(255,255,255,.85)">${lastLoc.location}</strong>
                  </div>` : ''}
             ${lastLoc.handler
               ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px">
                    <span style="color:rgba(74,222,128,.5)">👤 Handled By</span>
                    <strong style="color:rgba(255,255,255,.85)">${lastLoc.handler}</strong>
                  </div>` : ''}
           </div>
         </div>`
      : ''}

    <!-- Document details -->
    <div class="track-card">
      <div class="track-card-head"><h3>Document Details</h3></div>
      <div class="track-card-body">
        ${[
          ['Submitted By',  d.by],
          ['Purpose',       d.purpose],
          ['Assigned Office',office],
          ['Priority',      d.priority || 'Normal'],
          ['Date Filed',    d.date],
          ['Release Date',  relEntry
            ? `<span style="color:#4ade80">${releaseDate}</span>`
            : `<span style="color:rgba(255,255,255,.25)">Pending</span>`]
        ].map(function(row){
          return `<div class="track-field">
            <div class="track-field-label">${row[0]}</div>
            <div class="track-field-value">${row[1]}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Status timeline -->
    <div class="track-card">
      <div class="track-card-head"><h3>Status Timeline</h3></div>
      <div class="track-card-body">
        <div class="track-timeline">${histHtml}</div>
      </div>
    </div>

    <!-- RULE 3: File section — content depends on status -->
    ${fileSection}

    <!-- IDEA encryption proof -->
    <div class="track-card">
      <div class="track-card-head"><h3>🔐 IDEA Encryption Proof</h3></div>
      <div class="track-card-body">
        <div class="track-enc-box">
          ${[
            ['Key',       'Group6CITKey2024'],
            ['Algorithm', 'IDEA · 128-bit · 8 Rounds'],
            ['Encrypted', d.enc.slice(0,28) + '…'],
            ['Decrypted', typeof IDEA !== 'undefined' ? IDEA.decrypt(d.enc, KEY) : d.name]
          ].map(function(row){
            return `<div class="track-enc-row">
              <div class="track-enc-label">${row[0]}</div>
              <div class="track-enc-val">${row[1]}</div>
            </div>`;
          }).join('')}
        </div>
        <p style="font-size:10px;color:rgba(255,255,255,.2);text-align:center;margin-top:16px">
          CIT Document Tracker · IDEA Encryption · Group 6
        </p>
      </div>
    </div>`;
}
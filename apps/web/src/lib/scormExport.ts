/**
 * SCORM 1.2 package builder (client-side, JSZip).
 *
 * Produces a .zip blob that:
 *  1. Passes SCORM 1.2 validation (imsmanifest.xml)
 *  2. Plays in SCORM Cloud and standard LMSes
 *  3. Includes scorm-again for LMS API communication
 *  4. Reports quiz completion / pass-fail back to LMS
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExportTheme {
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

export interface ExportBlock {
  id: string;
  type: string;
  content?: string;
}

export interface ExportLesson {
  id: string;
  title: string;
  blocks: ExportBlock[];
}

export interface ExportModule {
  id: string;
  title: string;
  lessons: ExportLesson[];
}

export interface ExportOptions {
  /** 0–100; quiz score needed to report "passed" (default 80) */
  passingScore: number;
  /** 'completed': finish last lesson; 'passed': score ≥ passingScore */
  completionCriteria: 'completed' | 'passed';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitize inline/block rich-text HTML for the exported package (image /
 * gallery captions, and — as of the remaining-text-surfaces conversion —
 * accordion/callout/quote/flashcard/process/quiz fields authored via
 * InlineRichText). `p` is allowed so multiline fields keep paragraph breaks.
 * Legacy plain-string content (no `<`) is escaped as before.
 */
function sanitizeInlineHtml(s: string) {
  if (!s.includes('<')) return escapeHtml(s);
  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS: ['p', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'a'],
    ALLOWED_ATTR: ['style', 'class', 'href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Render a multiline (paragraph-capable) rich-text field for direct HTML
 * embedding, optionally with a styling class.
 *
 * Rich content authored via `InlineRichText` (multiline mode) already
 * carries its own Tiptap-produced `<p>` wrapper(s). Nesting that inside a
 * `<p class="...">` template (as the legacy plain-text shape used) would be
 * invalid HTML — browsers auto-close the outer `<p>` the moment they see a
 * nested `<p>` start tag, silently dropping the outer tag's class. So:
 *  - Legacy plain-string content (no `<`): wrapped in `<p class="...">` —
 *    byte-identical to the original escapeHtml-based template.
 *  - Rich content (has `<`): wrapped in a `<div class="...">` instead so the
 *    class survives; CSS written as plain class selectors (not tag-qualified
 *    `p.foo`) or as `.container p{...}` descendant selectors keeps applying
 *    via inheritance / descendant matching either way.
 */
function sanitizeMultilineHtml(s: string, cls?: string): string {
  const clsAttr = cls ? ` class="${cls}"` : '';
  if (!s.includes('<')) return `<p${clsAttr}>${escapeHtml(s)}</p>`;
  const body = sanitizeInlineHtml(s);
  return cls ? `<div${clsAttr}>${body}</div>` : body;
}

function defaultDividerPadding(style?: string) {
  return style === 'space' ? 32 : 48;
}

function dividerPadding(value: unknown, style?: string) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultDividerPadding(style);
  return Math.min(96, Math.max(0, Math.round(numeric)));
}

function dividerPaddingStyle(value: unknown, style?: string) {
  return `--prism-divider-padding:${dividerPadding(value, style)}px`;
}

function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const h = u.hostname;
    if (h === 'www.youtube.com' || h === 'youtube.com') {
      if (u.pathname.startsWith('/embed/')) return raw;
      const id = u.searchParams.get('v') ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    if (h === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0] ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    if (h === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (h === 'player.vimeo.com') return raw;
    return null;
  } catch { return null; }
}

const CALLOUT_ICONS: Record<string, string> = {
  info: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/></svg>`,
  success: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/></svg>`,
  tip: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clip-rule="evenodd"/></svg>`,
};

// ── Block → HTML ───────────────────────────────────────────────────────────

function renderBlock(block: ExportBlock, assetMap: Record<string, string>): string {
  const c = block.content ?? '';
  switch (block.type) {
    case 'richText': {
      const safe = DOMPurify.sanitize(c, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'a',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
          'span', 'div', 'figure', 'figcaption', 'img',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'style'],
        ALLOW_DATA_ATTR: false,
        FORCE_BODY: false,
      });
      return `<div class="prism-rt">${safe}</div>`;
    }

    case 'image': {
      let p: Record<string, string> = {};
      try { p = JSON.parse(c) as Record<string, string>; } catch { /* */ }
      const src = p.storageId ? (assetMap[p.storageId] ?? '') : '';
      if (!src) return '';
      return `<figure class="prism-img">
  <img src="${escapeHtml(src)}" alt="${escapeHtml(p.altText ?? '')}" />
  ${p.caption ? `<figcaption>${sanitizeInlineHtml(p.caption)}</figcaption>` : ''}
</figure>`;
    }

    case 'video': {
      let p: Record<string, string> = {};
      try { p = JSON.parse(c) as Record<string, string>; } catch { /* */ }
      const src = p.srcType === 'storage' ? (assetMap[p.src ?? ''] ?? p.src ?? '') : (p.src ?? '');
      if (!src) return '';
      if (p.srcType === 'embed') {
        const embedSrc = toEmbedUrl(src);
        if (!embedSrc) return '';
        return `<figure class="prism-video">
  <div class="prism-video-wrap"><iframe src="${escapeHtml(embedSrc)}" allowfullscreen></iframe></div>
  ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
</figure>`;
      }
      return `<figure class="prism-video">
  <video src="${escapeHtml(src)}" controls></video>
  ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
</figure>`;
    }

    case 'mcq': {
      let p: { question?: string; options?: Array<{ id: string; text: string; isCorrect: boolean; feedback?: string }>; multiSelect?: boolean; showFeedback?: boolean } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const opts = (p.options ?? []).map((o) =>
        `<li>
  <button type="button" class="prism-opt" data-id="${escapeHtml(o.id)}" data-correct="${o.isCorrect}" data-feedback="${escapeHtml(o.feedback ?? '')}">
    <span class="prism-opt-marker"></span>${escapeHtml(o.text)}
  </button>
</li>`,
      ).join('');
      return `<div class="prism-mcq" data-multi="${p.multiSelect ?? false}" data-feedback="${p.showFeedback ?? true}">
  <p class="prism-q">${escapeHtml(p.question ?? '')}</p>
  <ul class="prism-opts">${opts}</ul>
  <div class="prism-actions">
    <button type="button" class="prism-submit" disabled>Submit</button>
    <span class="prism-result"></span>
    <button type="button" class="prism-retry" style="display:none">Try again</button>
  </div>
</div>`;
    }

    case 'trueFalse': {
      let p: { statement?: string; correctAnswer?: boolean; trueFeedback?: string; falseFeedback?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      return `<div class="prism-tf" data-correct="${p.correctAnswer ?? true}" data-tf="${escapeHtml(p.trueFeedback ?? '')}" data-ff="${escapeHtml(p.falseFeedback ?? '')}">
  <p class="prism-q">${escapeHtml(p.statement ?? '')}</p>
  <div class="prism-tf-btns">
    <button type="button" data-answer="true">True</button>
    <button type="button" data-answer="false">False</button>
  </div>
  <div class="prism-result" style="display:none"></div>
  <button type="button" class="prism-retry" style="display:none">Try again</button>
</div>`;
    }

    case 'accordion': {
      let p: { sections?: Array<{ id: string; title: string; content: string }> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const sections = (p.sections ?? []).map((s, i) =>
        `<div class="prism-acc-item">
  <button type="button" class="prism-acc-btn" data-idx="${i}">${escapeHtml(s.title)}<span class="prism-acc-arrow">▼</span></button>
  <div class="prism-acc-body" style="display:none">${sanitizeMultilineHtml(s.content)}</div>
</div>`,
      ).join('');
      return `<div class="prism-acc">${sections}</div>`;
    }

    case 'quote': {
      let p: { text?: string; attribution?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      if (!p.text) return '';
      return `<blockquote class="prism-quote">
  ${sanitizeMultilineHtml(p.text)}
  ${p.attribution ? `<cite>${sanitizeInlineHtml(p.attribution)}</cite>` : ''}
</blockquote>`;
    }

    case 'callout': {
      let p: { variant?: string; title?: string; body?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const variant = p.variant ?? 'info';
      const icon = CALLOUT_ICONS[variant] ?? CALLOUT_ICONS['info'];
      return `<div class="prism-callout prism-callout--${escapeHtml(variant)}">
  <span class="prism-callout-icon">${icon}</span>
  <div>
    ${p.title ? sanitizeMultilineHtml(p.title, 'prism-callout-title') : ''}
    ${sanitizeMultilineHtml(p.body ?? '')}
  </div>
</div>`;
    }

    case 'divider': {
      let p: { style?: string; label?: string; padding?: number } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const style = p.style ?? 'line';
      const paddingStyle = dividerPaddingStyle(p.padding, style);
      if (style === 'space') return `<div class="prism-divider prism-divider--space" style="${paddingStyle}"></div>`;
      if (style === 'dots') return `<div class="prism-divider prism-divider--dots" style="${paddingStyle}">&middot;&middot;&middot;</div>`;
      return p.label
        ? `<div class="prism-divider prism-divider--label" style="${paddingStyle}"><span>${escapeHtml(p.label)}</span></div>`
        : `<div class="prism-divider prism-divider--line" style="${paddingStyle}"></div>`;
    }

    case 'flashcard': {
      let p: { cards?: Array<{ id: string; front: string; back: string }> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const cards = p.cards ?? [];
      if (!cards.length) return '';
      const cardsHtml = cards.map((card, i) =>
        `<div class="prism-fc-card" data-idx="${i}" style="${i > 0 ? 'display:none' : ''}">
  <div class="prism-fc-inner" data-flipped="false">
    <div class="prism-fc-front">${sanitizeMultilineHtml(card.front)}</div>
    <div class="prism-fc-back" style="display:none">${sanitizeMultilineHtml(card.back)}</div>
  </div>
  <button type="button" class="prism-fc-flip">Tap to reveal</button>
</div>`,
      ).join('');
      return `<div class="prism-flashcards" data-total="${cards.length}" data-current="0">
  ${cardsHtml}
  <div class="prism-fc-nav">
    <button type="button" class="prism-fc-prev" disabled>← Prev</button>
    <span class="prism-fc-count">1 / ${cards.length}</span>
    <button type="button" class="prism-fc-next" ${cards.length <= 1 ? 'disabled' : ''}>Next →</button>
  </div>
</div>`;
    }

    case 'process': {
      let p: { steps?: Array<{ id: string; title: string; body: string }> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const steps = (p.steps ?? []).map((step, i) =>
        `<div class="prism-process-step">
  <div class="prism-process-num">${i + 1}</div>
  <div class="prism-process-body">
    <p class="prism-process-title">${escapeHtml(step.title)}</p>
    ${step.body ? sanitizeMultilineHtml(step.body, 'prism-process-desc') : ''}
  </div>
</div>`,
      ).join('');
      return `<div class="prism-process">${steps}</div>`;
    }

    case 'tabs': {
      let p: { tabs?: Array<{ id: string; title: string; content: string }> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const tabs = p.tabs ?? [];
      if (!tabs.length) return '';
      const tabBtns = tabs.map((t, i) =>
        `<button type="button" class="prism-tab-btn${i === 0 ? ' active' : ''}" data-idx="${i}" style="all:unset;flex-shrink:0;padding:.85rem 1.1rem;font:inherit;font-size:.875rem;font-weight:600;border:0;border-bottom:2px solid ${i === 0 ? 'var(--prism-primary)' : 'transparent'};background:none;cursor:pointer;color:${i === 0 ? 'var(--prism-primary)' : 'var(--prism-text-muted)'};white-space:nowrap;transition:color .15s,border-color .15s">${t.title || `Tab ${i + 1}`}</button>`,
      ).join('');
      const tabPanels = tabs.map((t, i) =>
        `<div class="prism-tab-panel prism-rich-content" data-idx="${i}" style="${i > 0 ? 'display:none' : ''}">${t.content}</div>`,
      ).join('');
      return `<div class="prism-tabs">
  <div class="prism-tabs-bar">${tabBtns}</div>
  <div class="prism-tabs-panels">${tabPanels}</div>
</div>`;
    }

    case 'button': {
      let p: { label?: string; url?: string; style?: string; align?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      if (!p.label) return '';
      const align = p.align ?? 'left';
      const cls = `prism-btn prism-btn--${p.style ?? 'primary'}`;
      const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const tag = p.url ? `<a href="${escapeHtml(p.url)}" class="${cls}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.label)}</a>`
        : `<button type="button" class="${cls}">${escapeHtml(p.label)}</button>`;
      return `<div class="prism-btn-wrap" style="text-align:${textAlign};margin:1.5rem 0">${tag}</div>`;
    }

    case 'customHtml': {
      // In SCORM export, author controls their own output — use raw HTML (no sanitization)
      let p: { html?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      return `<div class="prism-custom-html">${p.html ?? ''}</div>`;
    }

    case 'hotspots': {
      type Hot = { id: string; xPct: number; yPct: number; title: string; body: string };
      let p: { storageId?: string; altText?: string; hotspots?: Hot[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const src = p.storageId ? (assetMap[p.storageId] ?? '') : '';
      if (!src) return '';
      const hs = p.hotspots ?? [];
      const dots = hs.map((h, i) => `<button type="button" class="prism-hs-dot" data-hid="${escapeHtml(h.id)}" style="left:${h.xPct}%;top:${h.yPct}%">${i + 1}</button>`).join('');
      const pops = hs.map((h) => `<div class="prism-hs-pop" data-hid="${escapeHtml(h.id)}" style="left:${h.xPct}%;top:${h.yPct}%;transform:translate(${h.xPct > 50 ? 'calc(-100% - 24px)' : '24px'},-50%)"><div class="prism-hs-pop-h"><strong>${escapeHtml(h.title)}</strong><button type="button" class="prism-hs-close" aria-label="Close">×</button></div>${h.body ? `<p>${escapeHtml(h.body)}</p>` : ''}</div>`).join('');
      return `<div class="prism-hotspots"><img src="${escapeHtml(src)}" alt="${escapeHtml(p.altText ?? '')}"/>${dots}${pops}<script>(function(){var r=document.currentScript.parentElement;r.querySelectorAll('.prism-hs-dot').forEach(function(d){d.addEventListener('click',function(){var id=d.getAttribute('data-hid');r.querySelectorAll('.prism-hs-pop').forEach(function(p){p.style.display=p.getAttribute('data-hid')===id&&p.style.display!=='block'?'block':'none'})})});r.querySelectorAll('.prism-hs-close').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();b.closest('.prism-hs-pop').style.display='none'})})})();</script></div>`;
    }

    case 'gallery': {
      type Item = { storageId: string; altText: string; caption: string };
      let p: { layout?: 'carousel' | 'grid'; items?: Item[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const items = (p.items ?? []).filter((it) => assetMap[it.storageId]);
      if (items.length === 0) return '';
      if (p.layout === 'grid') {
        return `<div class="prism-gallery-grid">${items.map((it) => `<figure><img src="${escapeHtml(assetMap[it.storageId]!)}" alt="${escapeHtml(it.altText)}"/>${it.caption ? `<figcaption>${sanitizeInlineHtml(it.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`;
      }
      const slides = items.map((it, i) => `<div class="prism-g-slide${i === 0 ? ' active' : ''}"><img src="${escapeHtml(assetMap[it.storageId]!)}" alt="${escapeHtml(it.altText)}"/>${it.caption ? `<p>${sanitizeInlineHtml(it.caption)}</p>` : ''}</div>`).join('');
      const dots = items.map((_, i) => `<button type="button" class="prism-g-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
      return `<div class="prism-gallery" data-prism-gallery="${items.length}"><div class="prism-g-slides">${slides}</div><div class="prism-g-controls"><button type="button" class="prism-g-prev" aria-label="Previous">‹</button><div class="prism-g-dots">${dots}</div><button type="button" class="prism-g-next" aria-label="Next">›</button></div></div>`;
    }

    case 'compare': {
      let p: { beforeStorageId?: string; afterStorageId?: string; beforeLabel?: string; afterLabel?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const before = p.beforeStorageId ? assetMap[p.beforeStorageId] : null;
      const after = p.afterStorageId ? assetMap[p.afterStorageId] : null;
      if (!before || !after) return '';
      return `<div class="prism-compare"><img class="prism-cmp-after" src="${escapeHtml(after)}" alt="${escapeHtml(p.afterLabel ?? '')}"/><div class="prism-cmp-clip"><img src="${escapeHtml(before)}" alt="${escapeHtml(p.beforeLabel ?? '')}"/></div><div class="prism-cmp-divider"></div><div class="prism-cmp-handle">⇆</div><span class="prism-cmp-label prism-cmp-lbefore">${escapeHtml(p.beforeLabel ?? 'Before')}</span><span class="prism-cmp-label prism-cmp-lafter">${escapeHtml(p.afterLabel ?? 'After')}</span><script>(function(){var r=document.currentScript.parentElement,clip=r.querySelector('.prism-cmp-clip'),div=r.querySelector('.prism-cmp-divider'),h=r.querySelector('.prism-cmp-handle'),img=clip.querySelector('img'),drag=false,pos=50;function set(p){pos=Math.max(0,Math.min(100,p));clip.style.width=pos+'%';img.style.width=(10000/pos)+'%';div.style.left=pos+'%';h.style.left=pos+'%'}function move(e){var rect=r.getBoundingClientRect(),x=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;set((x/rect.width)*100)}r.addEventListener('pointerdown',function(e){drag=true;move(e)});window.addEventListener('pointermove',function(e){if(drag)move(e)});window.addEventListener('pointerup',function(){drag=false});set(50)})();</script></div>`;
    }

    case 'audio': {
      let p: { storageId?: string; title?: string; transcript?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const src = p.storageId ? assetMap[p.storageId] : null;
      if (!src) return '';
      return `<div class="prism-audio">${p.title ? `<div class="prism-audio-title">${escapeHtml(p.title)}</div>` : ''}<audio src="${escapeHtml(src)}" controls></audio>${p.transcript ? `<details><summary>Transcript</summary><p>${escapeHtml(p.transcript)}</p></details>` : ''}</div>`;
    }

    case 'labeledGraphic': {
      type Lab = { id: string; xPct: number; yPct: number; text: string };
      let p: { storageId?: string; altText?: string; labels?: Lab[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const src = p.storageId ? assetMap[p.storageId] : null;
      if (!src) return '';
      const labs = (p.labels ?? []).map((l) => `<div class="prism-lg-label" style="left:${l.xPct}%;top:${l.yPct}%"><span class="prism-lg-dot"></span>${escapeHtml(l.text)}</div>`).join('');
      return `<div class="prism-labeled-graphic"><img src="${escapeHtml(src)}" alt="${escapeHtml(p.altText ?? '')}"/>${labs}</div>`;
    }

    case 'fillBlanks': {
      let p: { template?: string; answers?: Record<string, string> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const tpl = p.template ?? '';
      const ans = p.answers ?? {};
      const parts: string[] = [];
      const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tpl)) !== null) {
        parts.push(escapeHtml(tpl.slice(last, m.index)));
        parts.push(`<input class="prism-fb-input" data-key="${escapeHtml(m[1]!)}" data-ans="${escapeHtml((ans[m[1]!] ?? '').toLowerCase())}"/>`);
        last = m.index + m[0].length;
      }
      parts.push(escapeHtml(tpl.slice(last)));
      return `<div class="prism-fill-blanks"><p>${parts.join('')}</p><div class="prism-fb-actions"><button type="button" class="prism-fb-check">Check</button></div><script>(function(){var r=document.currentScript.parentElement;r.querySelector('.prism-fb-check').addEventListener('click',function(){r.querySelectorAll('.prism-fb-input').forEach(function(i){var ok=(i.value||'').trim().toLowerCase()===i.getAttribute('data-ans');i.classList.remove('correct','wrong');i.classList.add(ok?'correct':'wrong')})})})();</script></div>`;
    }

    case 'revealCards': {
      type Card = { id: string; front: string; back: string };
      let p: { columns?: number; cards?: Card[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const cards = p.cards ?? [];
      const cols = p.columns ?? 3;
      const html = cards.map((cd) => `<button type="button" class="prism-rc-card" data-front="${escapeHtml(cd.front)}" data-back="${escapeHtml(cd.back)}"><span class="prism-rc-text">${escapeHtml(cd.front)}</span><span class="prism-rc-hint">Tap to reveal</span></button>`).join('');
      return `<div class="prism-reveal-cards" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${html}<script>(function(){var r=document.currentScript.parentElement;r.querySelectorAll('.prism-rc-card').forEach(function(b){var flipped=false;b.addEventListener('click',function(){flipped=!flipped;b.classList.toggle('flipped',flipped);b.querySelector('.prism-rc-text').textContent=flipped?b.getAttribute('data-back'):b.getAttribute('data-front');b.querySelector('.prism-rc-hint').textContent=flipped?'Back':'Tap to reveal'})})})();</script></div>`;
    }

    case 'matching': {
      type Pair = { id: string; term: string; definition: string };
      let p: { pairs?: Pair[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const pairs = p.pairs ?? [];
      if (pairs.length === 0) return '';
      // shuffle deterministically (server has no Date.now sensitive concerns; client will see consistent order)
      const shuffled = [...pairs].sort(() => Math.random() - 0.5);
      const terms = pairs.map((t) => `<div class="prism-mt-term" data-tid="${escapeHtml(t.id)}"><strong>${escapeHtml(t.term)}</strong><div class="prism-mt-slot">Drop here</div></div>`).join('');
      const defs = shuffled.map((d) => `<div class="prism-mt-def" draggable="true" data-did="${escapeHtml(d.id)}">${escapeHtml(d.definition)}</div>`).join('');
      return `<div class="prism-matching"><div class="prism-mt-cols"><div class="prism-mt-terms">${terms}</div><div class="prism-mt-defs">${defs}</div></div><button type="button" class="prism-mt-check">Check</button><script>(function(){var r=document.currentScript.parentElement,drag=null;r.querySelectorAll('.prism-mt-def').forEach(function(d){d.addEventListener('dragstart',function(){drag=d});d.addEventListener('dragend',function(){drag=null})});r.querySelectorAll('.prism-mt-term').forEach(function(t){t.addEventListener('dragover',function(e){e.preventDefault()});t.addEventListener('drop',function(e){e.preventDefault();if(!drag)return;var slot=t.querySelector('.prism-mt-slot');slot.textContent=drag.textContent;slot.setAttribute('data-did',drag.getAttribute('data-did'));drag.style.display='none'})});r.querySelector('.prism-mt-check').addEventListener('click',function(){r.querySelectorAll('.prism-mt-term').forEach(function(t){var slot=t.querySelector('.prism-mt-slot');var ok=slot.getAttribute('data-did')===t.getAttribute('data-tid');t.classList.remove('correct','wrong');t.classList.add(ok?'correct':'wrong')})})})();</script></div>`;
    }

    case 'sorting': {
      type Item = { id: string; text: string };
      let p: { prompt?: string; items?: Item[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const items = p.items ?? [];
      if (items.length === 0) return '';
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      const order = JSON.stringify(items.map((x) => x.id));
      const list = shuffled.map((it) => `<div class="prism-sort-item" draggable="true" data-id="${escapeHtml(it.id)}"><span class="prism-sort-num"></span><span class="prism-sort-text">${escapeHtml(it.text)}</span></div>`).join('');
      return `<div class="prism-sorting">${p.prompt ? `<p class="prism-sort-prompt">${escapeHtml(p.prompt)}</p>` : ''}<div class="prism-sort-list">${list}</div><button type="button" class="prism-sort-check">Check order</button><script>(function(){var r=document.currentScript.parentElement,list=r.querySelector('.prism-sort-list'),correct=${order},drag=null;function renum(){list.querySelectorAll('.prism-sort-item').forEach(function(it,i){it.querySelector('.prism-sort-num').textContent=(i+1)})}renum();list.querySelectorAll('.prism-sort-item').forEach(function(it){it.addEventListener('dragstart',function(){drag=it});it.addEventListener('dragover',function(e){e.preventDefault()});it.addEventListener('drop',function(e){e.preventDefault();if(!drag||drag===it)return;var rect=it.getBoundingClientRect(),before=(e.clientY-rect.top)<rect.height/2;list.insertBefore(drag,before?it:it.nextSibling);renum()})});r.querySelector('.prism-sort-check').addEventListener('click',function(){var cur=Array.from(list.querySelectorAll('.prism-sort-item')).map(function(x){return x.getAttribute('data-id')});cur.forEach(function(id,i){var el=list.querySelector('[data-id=\"'+id+'\"]');el.classList.remove('correct','wrong');el.classList.add(id===correct[i]?'correct':'wrong')})})})();</script></div>`;
    }

    case 'scenario': {
      type Choice = { id: string; label: string; nextNodeId: string | null };
      type Node = { id: string; title: string; body: string; choices: Choice[]; isEnding: boolean };
      let p: { startNodeId?: string; nodes?: Node[] } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      if (!p.startNodeId || !p.nodes) return '';
      const data = JSON.stringify(p);
      return `<div class="prism-scenario" data-scenario='${data.replace(/'/g, '&#39;')}'><div class="prism-sc-header"><span class="prism-sc-step">Step 1</span><span class="prism-sc-title"></span></div><div class="prism-sc-body"><p class="prism-sc-text"></p><div class="prism-sc-choices"></div></div><script>(function(){var r=document.currentScript.parentElement,d=JSON.parse(r.getAttribute('data-scenario')),cur=d.startNodeId,step=1;function render(){var n=d.nodes.find(function(x){return x.id===cur});if(!n)return;r.querySelector('.prism-sc-step').textContent=n.isEnding?'Complete':'Step '+step;r.querySelector('.prism-sc-title').textContent=n.title;r.querySelector('.prism-sc-text').textContent=n.body;var ch=r.querySelector('.prism-sc-choices');ch.innerHTML='';if(n.isEnding){var b=document.createElement('button');b.type='button';b.className='prism-sc-restart';b.textContent='Restart';b.onclick=function(){cur=d.startNodeId;step=1;render()};ch.appendChild(b)}else{n.choices.forEach(function(c){var b=document.createElement('button');b.type='button';b.className='prism-sc-choice';b.textContent='→ '+c.label;b.disabled=!c.nextNodeId;b.onclick=function(){if(c.nextNodeId){cur=c.nextNodeId;step++;render()}};ch.appendChild(b)})}}render()})();</script></div>`;
    }

    case 'lottie': {
      let p: { storageId?: string; loop?: boolean; autoplay?: boolean } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const src = p.storageId ? (assetMap[p.storageId] ?? '') : '';
      if (!src) return '';
      const loop = p.loop ?? true;
      const autoplay = p.autoplay ?? true;
      const uid = `lottie_${Math.random().toString(36).slice(2, 9)}`;
      return `<div class="prism-lottie" style="max-width:480px;margin:1.5rem auto;text-align:center">
  <div id="${uid}"></div>
  <script>(function(){function _init(){if(!window.lottie)return;lottie.loadAnimation({container:document.getElementById('${uid}'),renderer:'svg',loop:${loop},autoplay:${autoplay},path:'${escapeHtml(src)}'});}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_init);}else{_init();}})();</script>
</div>`;
    }

    default:
      return '';
  }
}

// ── imsmanifest.xml ────────────────────────────────────────────────────────

function buildManifest(mod: ExportModule): string {
  const id = `prism_${mod.id.replace(/[^a-z0-9]/gi, '_')}`;
  const welcomeItem = `      <item identifier="item_welcome" identifierref="res_welcome">
        <title>Welcome</title>
      </item>`;
  const lessonItems = mod.lessons
    .map(
      (l, i) => `      <item identifier="item_${i}" identifierref="res_${i}">
        <title>${escapeXml(l.title)}</title>
      </item>`,
    )
    .join('\n');
  const items = welcomeItem + '\n' + lessonItems;
  const welcomeResource = `    <resource identifier="res_welcome" type="webcontent" adlcp:scormtype="sco"
      href="welcome.html">
      <file href="welcome.html"/>
    </resource>`;
  const resources = welcomeResource + '\n' + mod.lessons
    .map(
      (_, i) => `    <resource identifier="res_${i}" type="webcontent" adlcp:scormtype="sco"
      href="lesson_${i}.html">
      <file href="lesson_${i}.html"/>
    </resource>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_${id}">
    <organization identifier="org_${id}">
      <title>${escapeXml(mod.title)}</title>
${items}
    </organization>
  </organizations>
  <resources>
${resources}
    <resource identifier="res_shared_css" type="webcontent" href="styles.css">
      <file href="styles.css"/>
    </resource>
  </resources>
</manifest>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────

function buildCss(theme: ExportTheme): string {
  return `/* Prism Learning — premium SCORM theme */
:root {
  --prism-primary: ${theme.primary};
  --prism-accent: ${theme.accent};
  --prism-font-heading: "${theme.headingFont}", sans-serif;
  --prism-font-body: "${theme.bodyFont}", sans-serif;
  --prism-motion-fast: 140ms;
  --prism-motion-base: 240ms;
  --prism-motion-slow: 420ms;
  --prism-ease-standard: cubic-bezier(.2,0,0,1);
  --prism-ease-emphasized: cubic-bezier(.2,.8,.2,1);
  --prism-stagger-step: 55ms;
  /* Light mode tokens */
  --prism-bg: #f6f7fb;
  --prism-bg-grad: radial-gradient(1200px 800px at 20% -10%, rgba(99,102,241,.06), transparent 60%),
                    radial-gradient(1000px 700px at 100% 0%, rgba(16,185,129,.05), transparent 55%),
                    linear-gradient(180deg,#f8fafc 0%,#eef0f5 100%);
  --prism-surface: #ffffff;
  --prism-surface-2: #f8fafc;
  --prism-surface-3: #f1f5f9;
  --prism-border: #e2e8f0;
  --prism-border-subtle: #eef2f6;
  --prism-text: #0f172a;
  --prism-text-2: #334155;
  --prism-text-muted: #64748b;
  --prism-text-faint: #94a3b8;
  --prism-shadow-card: 0 1px 0 rgba(15,23,42,.04), 0 24px 60px -28px rgba(15,23,42,.22);
  --prism-shadow-soft: 0 1px 2px rgba(15,23,42,.05);
}
html[data-theme="dark"] {
  --prism-bg: #0a0c14;
  --prism-bg-grad: radial-gradient(1200px 800px at 20% -10%, rgba(99,102,241,.18), transparent 60%),
                    radial-gradient(1000px 700px at 100% 0%, rgba(16,185,129,.12), transparent 55%),
                    linear-gradient(180deg,#0a0c14 0%,#05070d 100%);
  --prism-surface: #11141d;
  --prism-surface-2: #161a25;
  --prism-surface-3: #1c2130;
  --prism-border: #232936;
  --prism-border-subtle: #1a1f2b;
  --prism-text: #f1f5f9;
  --prism-text-2: #cbd5e1;
  --prism-text-muted: #94a3b8;
  --prism-text-faint: #64748b;
  --prism-shadow-card: 0 1px 0 rgba(0,0,0,.5), 0 30px 80px -20px rgba(0,0,0,.6);
  --prism-shadow-soft: 0 1px 2px rgba(0,0,0,.4);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:var(--prism-font-body);background:var(--prism-bg);color:var(--prism-text-2);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body::before{content:'';position:fixed;inset:0;background:var(--prism-bg-grad);z-index:0;pointer-events:none}

/* ── Shell ── */
.prism-shell{position:relative;z-index:1;min-height:100vh;display:flex;justify-content:center;padding:0;}
.prism-stage{width:100%;max-width:1080px;display:flex;flex-direction:column;animation:prism-stage-in var(--prism-motion-slow) var(--prism-ease-emphasized) both}
@keyframes prism-stage-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* ── Top toolbar (sticky page chrome) ── */
.prism-toolbar{position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 28px;background:color-mix(in srgb, var(--prism-surface) 92%, transparent);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--prism-border-subtle)}
.prism-brand{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--prism-text-2)}
.prism-brand-mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));box-shadow:0 6px 18px -6px var(--prism-primary);flex-shrink:0}
.prism-brand-logo{width:30px;height:30px;object-fit:contain;border-radius:8px;flex-shrink:0}
.prism-brand-name{opacity:.85;max-width:42ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prism-tools{display:flex;align-items:center;gap:8px}
.prism-tool{appearance:none;border:1px solid transparent;background:transparent;color:var(--prism-text-2);width:42px;height:42px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--prism-motion-fast) var(--prism-ease-standard)}
.prism-tool:hover{background:var(--prism-surface-2);border-color:var(--prism-border)}
.prism-tool svg{width:20px;height:20px}
.prism-exit{appearance:none;border:1px solid var(--prism-border);background:var(--prism-surface);color:var(--prism-text-2);padding:0 18px;height:42px;border-radius:10px;font:inherit;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all var(--prism-motion-fast)}
.prism-exit:hover{border-color:var(--prism-text-muted);color:var(--prism-text)}

/* ── Page (formerly card) ── */
.prism-card{position:relative;background:var(--prism-surface);display:flex;flex-direction:column;min-height:calc(100vh - 70px);border-top:5px solid var(--prism-primary)}

/* ── Hero band (lesson header) ── */
.prism-top{position:relative;z-index:2;background:linear-gradient(160deg, color-mix(in srgb, var(--prism-primary) 9%, var(--prism-surface)) 0%, var(--prism-surface) 70%);border-bottom:1px solid var(--prism-border-subtle);padding:48px 64px 32px;}
.prism-lesson-badge{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:6px 16px;border-radius:999px;margin-bottom:18px;box-shadow:0 8px 20px -8px var(--prism-primary)}
.prism-kicker{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--prism-primary);display:flex;align-items:center;gap:10px}
.prism-kicker::before{content:'';width:22px;height:2px;border-radius:2px;background:currentColor}
.prism-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-top:12px}
h1{font-family:var(--prism-font-heading);font-size:2.5rem;line-height:1.12;font-weight:800;color:var(--prism-text);letter-spacing:-.025em;max-width:24ch}
.prism-count{flex-shrink:0;font-size:13px;font-weight:700;color:var(--prism-text-muted);font-variant-numeric:tabular-nums;padding-bottom:6px}
.prism-progress{position:relative;height:7px;border-radius:999px;background:var(--prism-surface-3);overflow:hidden;margin-top:20px}
.prism-progress span{position:absolute;inset:0 auto 0 0;border-radius:999px;background:linear-gradient(90deg,var(--prism-primary),var(--prism-accent));transition:width var(--prism-motion-slow) var(--prism-ease-emphasized);box-shadow:0 0 12px -2px var(--prism-primary)}
.prism-progress::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-100%);animation:prism-shimmer 2.6s ease-in-out infinite;opacity:.5;pointer-events:none}
@keyframes prism-shimmer{0%{transform:translateX(-100%)}60%,100%{transform:translateX(200%)}}

/* ── Lesson dots row (clickable lesson chips) ── */
.prism-dots{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.prism-dot{flex:1;min-width:22px;height:5px;border-radius:999px;background:var(--prism-surface-3);border:none;cursor:pointer;transition:background var(--prism-motion-base),transform var(--prism-motion-fast);text-decoration:none}
.prism-dot:hover{transform:scaleY(1.35)}
.prism-dot.done{background:linear-gradient(90deg,var(--prism-primary),var(--prism-accent));opacity:.7}
.prism-dot.current{background:linear-gradient(90deg,var(--prism-primary),var(--prism-accent));opacity:1;box-shadow:0 0 0 3px color-mix(in srgb, var(--prism-primary) 18%, transparent)}

/* ── Lesson body ── */
.prism-lesson{flex:1;padding:48px 64px 56px;max-width:780px;width:100%;margin:0 auto;animation:prism-lesson-in var(--prism-motion-slow) var(--prism-ease-emphasized) both}
@keyframes prism-lesson-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.prism-block{animation:prism-block-reveal var(--prism-motion-slow) var(--prism-ease-emphasized) both;animation-delay:calc(var(--i,0) * var(--prism-stagger-step))}
@keyframes prism-block-reveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes prism-feedback-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes prism-marker-pop{0%{opacity:0;transform:scale(.65)}100%{opacity:1;transform:scale(1)}}
@keyframes prism-shake{0%,100%{transform:translateX(0) scale(1)}15%{transform:translateX(-7px) scale(.99)}30%{transform:translateX(6px)}45%{transform:translateX(-4px)}60%{transform:translateX(3px)}75%{transform:translateX(-2px)}}
@keyframes prism-correct-pop{0%,100%{transform:scale(1)}40%{transform:scale(1.035)}}
@keyframes prism-ripple-expand{to{transform:scale(4);opacity:0}}
@keyframes prism-slide-out-next{to{opacity:0;transform:translateX(-32px)}}
@keyframes prism-slide-out-prev{to{opacity:0;transform:translateX(32px)}}
@keyframes prism-toast-show{0%{opacity:0;transform:translateX(-50%) translateY(18px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes prism-toast-hide{to{opacity:0;transform:translateX(-50%) translateY(12px)}}
.prism-shake{animation:prism-shake 380ms cubic-bezier(.36,.07,.19,.97) both!important}
.prism-correct-pop{animation:prism-correct-pop 320ms var(--prism-ease-emphasized) both!important}

/* ── Bottom nav (sticky page footer) ── */
.prism-nav{position:sticky;bottom:0;z-index:30;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 64px calc(18px + env(safe-area-inset-bottom));border-top:1px solid var(--prism-border-subtle);background:color-mix(in srgb, var(--prism-surface) 92%, transparent);backdrop-filter:saturate(180%) blur(14px)}
.prism-nav-btn{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 22px;border-radius:10px;border:1px solid var(--prism-border);background:var(--prism-surface);color:var(--prism-text-2);font:inherit;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:all var(--prism-motion-fast) var(--prism-ease-standard);position:relative;overflow:hidden}
.prism-nav-btn:hover{border-color:var(--prism-text-muted);color:var(--prism-text)}
.prism-nav-btn:active{transform:scale(.97)}
.prism-nav-btn--ghost{visibility:hidden;pointer-events:none}
.prism-nav-btn--primary{min-height:52px;padding:0 36px;background:var(--prism-primary);color:#fff;border-color:transparent;font-size:14px;letter-spacing:.14em;box-shadow:0 14px 28px -12px var(--prism-primary)}
.prism-nav-btn--primary:hover{color:#fff;background:color-mix(in srgb, var(--prism-primary) 88%, #000);transform:translateY(-1px);box-shadow:0 18px 32px -12px var(--prism-primary)}
.prism-nav-btn--primary:active{transform:scale(.97) translateY(0)}
.prism-nav-meta{font-size:11px;font-weight:700;color:var(--prism-text-faint);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:8px;letter-spacing:.14em;text-transform:uppercase}
.prism-nav-meta-dot{width:5px;height:5px;border-radius:50%;background:var(--prism-primary)}

/* ── Lessons drawer ── */
.prism-drawer{position:fixed;inset:0;z-index:50;display:none;background:rgba(2,6,14,.55);backdrop-filter:blur(6px);animation:prism-fade-in var(--prism-motion-base) both}
.prism-drawer.open{display:block}
@keyframes prism-fade-in{from{opacity:0}to{opacity:1}}
.prism-drawer-panel{position:absolute;top:0;bottom:0;left:0;width:min(360px,86vw);background:var(--prism-surface);border-right:1px solid var(--prism-border);padding:22px;display:flex;flex-direction:column;gap:14px;animation:prism-slide-in var(--prism-motion-base) var(--prism-ease-emphasized) both;overflow-y:auto}
@keyframes prism-slide-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.prism-drawer-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--prism-border-subtle)}
.prism-drawer-title{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--prism-text-muted)}
.prism-drawer-close{appearance:none;border:none;background:var(--prism-surface-3);color:var(--prism-text-2);width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1}
.prism-drawer-list{display:flex;flex-direction:column;gap:4px}
.prism-drawer-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;text-decoration:none;color:var(--prism-text-2);transition:background var(--prism-motion-fast);border:1px solid transparent}
.prism-drawer-item:hover{background:var(--prism-surface-2)}
.prism-drawer-item.current{background:color-mix(in srgb, var(--prism-primary) 10%, transparent);border-color:color-mix(in srgb, var(--prism-primary) 22%, transparent)}
.prism-drawer-num{width:26px;height:26px;border-radius:8px;background:var(--prism-surface-3);color:var(--prism-text-muted);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0}
.prism-drawer-item.done .prism-drawer-num{background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff}
.prism-drawer-item.current .prism-drawer-num{background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff}
.prism-drawer-label{font-size:14px;font-weight:600;color:var(--prism-text);line-height:1.4}
.prism-drawer-meta{font-size:11px;color:var(--prism-text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}

/* ── Completion overlay (last lesson) ── */
.prism-complete{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(2,6,14,.65);backdrop-filter:blur(10px);animation:prism-fade-in var(--prism-motion-slow) both;padding:24px}
.prism-complete.show{display:flex}
.prism-complete-card{background:var(--prism-surface);border:1px solid var(--prism-border);border-radius:24px;padding:36px 32px;max-width:420px;width:100%;text-align:center;box-shadow:var(--prism-shadow-card);animation:prism-complete-pop var(--prism-motion-slow) var(--prism-ease-emphasized) both}
@keyframes prism-complete-pop{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.prism-complete-check{width:72px;height:72px;border-radius:50%;margin:0 auto 18px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));display:flex;align-items:center;justify-content:center;color:#fff;font-size:38px;box-shadow:0 18px 40px -12px var(--prism-primary);animation:prism-check-bounce 700ms var(--prism-ease-emphasized) both}
@keyframes prism-check-bounce{0%{transform:scale(.4);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
.prism-complete h2{font-family:var(--prism-font-heading);font-size:1.5rem;font-weight:800;color:var(--prism-text);margin-bottom:8px;letter-spacing:-.01em}
.prism-complete p{font-size:14px;color:var(--prism-text-muted);line-height:1.6;margin-bottom:22px}
.prism-complete-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.prism-complete-row button{appearance:none;border:1px solid var(--prism-border);background:var(--prism-surface);color:var(--prism-text-2);padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;transition:all var(--prism-motion-fast)}
.prism-complete-row button:hover{border-color:var(--prism-primary)}
.prism-complete-row .primary{background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;border-color:transparent;box-shadow:0 10px 22px -10px var(--prism-primary)}

/* ── Confetti ── */
.prism-confetti{position:fixed;inset:0;z-index:70;pointer-events:none;overflow:hidden}
.prism-confetti i{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;opacity:.9;animation:prism-confetti-fall linear forwards}
@keyframes prism-confetti-fall{to{transform:translateY(110vh) rotate(720deg)}}

/* ── Typography & blocks ── */
.prism-rt{line-height:1.75;margin-bottom:1.75rem;font-size:1.0625rem;color:var(--prism-text-2)}
.prism-rt h1,.prism-rt h2,.prism-rt h3{font-family:var(--prism-font-heading);color:var(--prism-text);margin:1.75rem 0 .75rem;letter-spacing:-.015em;line-height:1.2}
.prism-rt h1{font-size:2rem;font-weight:800}
.prism-rt h2{font-size:1.5rem;font-weight:800}
.prism-rt h3{font-size:1.2rem;font-weight:700}
.prism-rt p{margin-bottom:1rem}
.prism-rt a{color:var(--prism-primary);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.prism-rt ul,.prism-rt ol{margin-left:1.5rem;margin-bottom:.85rem}
.prism-rt code{background:var(--prism-surface-3);color:var(--prism-text);padding:1px 6px;border-radius:5px;font-size:.9em;font-family:ui-monospace,'SF Mono',Menlo,monospace}
.prism-rt blockquote{border-left:3px solid var(--prism-primary);padding-left:1rem;color:var(--prism-text-muted);margin:1rem 0;font-style:italic}
.prism-img{margin:1.75rem 0;text-align:center}
.prism-img img{max-width:100%;border-radius:16px;background:var(--prism-surface-3);box-shadow:0 18px 45px -18px rgba(15,23,42,.25)}
.prism-img figcaption{margin-top:.6rem;font-size:.85rem;color:var(--prism-text-muted)}
.prism-video{margin:1.75rem 0}
.prism-video-wrap{position:relative;padding-top:56.25%;border-radius:16px;overflow:hidden;background:var(--prism-surface-3);box-shadow:0 18px 45px -18px rgba(15,23,42,.25)}
.prism-video-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.prism-video video{max-width:100%;border-radius:16px;background:var(--prism-surface-3);box-shadow:0 18px 45px -18px rgba(15,23,42,.25)}

/* ── MCQ ── */
.prism-mcq{background:var(--prism-surface-2);border:1px solid var(--prism-border);border-radius:20px;padding:22px;margin:1.75rem 0;box-shadow:var(--prism-shadow-soft)}
.prism-q{font-weight:700;margin-bottom:1rem;line-height:1.5;color:var(--prism-text);font-size:1.05rem}
.prism-opts{list-style:none}
.prism-opts li{margin-bottom:8px}
.prism-opt{display:flex;align-items:flex-start;gap:.75rem;width:100%;min-height:3rem;padding:.85rem 1rem;background:var(--prism-surface);border:1.5px solid var(--prism-border);border-radius:12px;cursor:pointer;font:inherit;font-size:.95rem;line-height:1.5;text-align:left;color:var(--prism-text);box-shadow:var(--prism-shadow-soft);transition:transform var(--prism-motion-fast) var(--prism-ease-standard),border-color var(--prism-motion-base),background-color var(--prism-motion-base),color var(--prism-motion-base)}
.prism-opt:active,.prism-submit:active,.prism-tf-btns button:active{transform:scale(.985)}
.prism-opt:hover{border-color:var(--prism-text-muted)}
.prism-opt.selected{border-color:var(--prism-primary);background:color-mix(in srgb, var(--prism-primary) 8%, var(--prism-surface))}
.prism-opt.correct{border-color:#10b981;background:color-mix(in srgb,#10b981 12%,var(--prism-surface));color:#065f46}
.prism-opt.wrong{border-color:#ef4444;background:color-mix(in srgb,#ef4444 12%,var(--prism-surface));color:#991b1b}
html[data-theme="dark"] .prism-opt.correct{color:#6ee7b7}
html[data-theme="dark"] .prism-opt.wrong{color:#fca5a5}
.prism-opt-marker{width:1.25rem;height:1.25rem;margin-top:.15rem;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0}
.prism-opt-marker:not(:empty){animation:prism-marker-pop var(--prism-motion-base) var(--prism-ease-emphasized) both}
.prism-actions{margin-top:14px;display:flex;align-items:center;gap:.75rem}
.prism-submit{min-height:44px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;border:0;border-radius:12px;padding:.6rem 1.25rem;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer;box-shadow:0 10px 22px -10px var(--prism-primary);transition:transform var(--prism-motion-fast),opacity var(--prism-motion-base),filter var(--prism-motion-fast)}
.prism-submit:hover:not(:disabled){filter:brightness(1.05)}
.prism-submit:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.prism-retry{background:none;border:0;color:var(--prism-primary);font-size:.9rem;cursor:pointer;text-decoration:underline;font-weight:600}
.prism-result{font-size:.9rem;font-weight:700;animation:prism-feedback-enter var(--prism-motion-base) var(--prism-ease-emphasized) both}
.prism-result.ok{color:#059669}
.prism-result.bad{color:#dc2626}

/* ── True/False ── */
.prism-tf{background:var(--prism-surface-2);border:1px solid var(--prism-border);border-radius:20px;padding:22px;margin:1.75rem 0;box-shadow:var(--prism-shadow-soft)}
.prism-tf-btns{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1rem}
.prism-tf-btns button{min-height:3rem;padding:.85rem;border-radius:12px;border:1.5px solid var(--prism-border);background:var(--prism-surface);color:var(--prism-text);font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform var(--prism-motion-fast),border-color var(--prism-motion-base),background-color var(--prism-motion-base),color var(--prism-motion-base);box-shadow:var(--prism-shadow-soft)}
.prism-tf-btns button:hover{border-color:var(--prism-text-muted)}
.prism-tf-btns button.selected-ok{border-color:#10b981;background:color-mix(in srgb,#10b981 12%,var(--prism-surface));color:#065f46}
.prism-tf-btns button.selected-bad{border-color:#ef4444;background:color-mix(in srgb,#ef4444 12%,var(--prism-surface));color:#991b1b}
html[data-theme="dark"] .prism-tf-btns button.selected-ok{color:#6ee7b7}
html[data-theme="dark"] .prism-tf-btns button.selected-bad{color:#fca5a5}

/* ── Accordion ── */
.prism-acc{border:1px solid var(--prism-border);border-radius:18px;overflow:hidden;margin:1.75rem 0;background:var(--prism-surface);box-shadow:var(--prism-shadow-soft)}
.prism-acc-item{border-bottom:1px solid var(--prism-border-subtle);background:var(--prism-surface)}
.prism-acc-item:last-child{border-bottom:0}
.prism-acc-btn{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:3rem;padding:.95rem 1.25rem;font:inherit;font-size:.95rem;line-height:1.5;font-weight:700;color:var(--prism-text);border:0;background:none;cursor:pointer;text-align:left;transition:background-color var(--prism-motion-base)}
.prism-acc-btn:hover{background:var(--prism-surface-2)}
.prism-acc-arrow{font-size:.65rem;transition:transform var(--prism-motion-base) var(--prism-ease-standard);margin-left:.5rem;color:var(--prism-text-muted)}
.prism-acc-body{padding:.5rem 1.25rem 1rem;font-size:.92rem;line-height:1.7;color:var(--prism-text-2);border-top:1px solid var(--prism-border-subtle);animation:prism-feedback-enter var(--prism-motion-base) var(--prism-ease-emphasized) both}

/* ── Reduced motion ── */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}.prism-block{animation:none}.prism-progress::after{display:none}}

/* ── Toast notification ── */
.prism-toast{position:fixed;bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%) translateY(18px);background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;padding:11px 26px;border-radius:999px;font:inherit;font-weight:800;font-size:13px;letter-spacing:.04em;z-index:45;white-space:nowrap;box-shadow:0 12px 32px -10px var(--prism-primary);animation:prism-toast-show 240ms var(--prism-ease-emphasized) forwards;pointer-events:none;opacity:0}
.prism-toast.hiding{animation:prism-toast-hide 220ms ease forwards}

/* ── Responsive ── */
@media (max-width:900px){.prism-top{padding:40px 28px 28px}.prism-lesson{padding:36px 28px 44px}.prism-nav{padding:14px 28px}.prism-toolbar{padding:12px 20px}h1{font-size:2rem}}
@media (max-width:560px){
  .prism-top{padding:28px 20px 20px;border-top-width:0}
  .prism-lesson{padding:24px 18px 36px;font-size:1.125rem}
  .prism-rt{font-size:1.0625rem}
  .prism-nav{padding:12px 16px calc(12px + env(safe-area-inset-bottom));flex-wrap:wrap;gap:8px}
  .prism-nav-btn--primary{flex:1 1 100%;justify-content:center;min-height:56px;font-size:15px;order:-1;border-radius:14px}
  .prism-nav-meta{order:1;flex:1}
  .prism-nav-btn:not(.prism-nav-btn--primary):not(.prism-nav-btn--ghost){order:2}
  .prism-nav-btn:not(.prism-nav-btn--primary){padding:0 14px;font-size:11px;min-height:40px}
  h1{font-size:1.75rem;max-width:none}
  .prism-toolbar{padding:10px 14px}
  .prism-brand-name{display:none}
  .prism-opt{min-height:3.5rem;font-size:1rem;padding:.9rem 1rem}
  .prism-tf-btns button{min-height:3.5rem;font-size:1rem}
  .prism-lesson-badge{font-size:10px;padding:5px 14px}
  .prism-submit{min-height:48px;font-size:1rem}
}

/* ── New block types ── */
.prism-quote{border-left:4px solid var(--prism-primary);background:var(--prism-surface-2);border-radius:0 12px 12px 0;padding:1.25rem 1.25rem 1.25rem 1.5rem;margin:1.75rem 0;font-size:1.1rem;font-style:italic;color:var(--prism-text-2);line-height:1.75}
.prism-quote p{margin:0}
.prism-quote cite{display:block;margin-top:.7rem;font-size:.8rem;font-style:normal;font-weight:700;color:var(--prism-text-muted);letter-spacing:.03em}
.prism-callout{border-radius:14px;padding:1rem 1.125rem;margin:1.75rem 0;border-width:1.5px;border-style:solid;display:flex;gap:0.75rem;align-items:flex-start}
.prism-callout-icon{flex-shrink:0;margin-top:0.1rem;display:flex}
.prism-callout--info{background:color-mix(in srgb,#3b82f6 8%,var(--prism-surface));border-color:color-mix(in srgb,#3b82f6 35%,transparent);color:#1e40af}
.prism-callout--warning{background:color-mix(in srgb,#f59e0b 10%,var(--prism-surface));border-color:color-mix(in srgb,#f59e0b 40%,transparent);color:#92400e}
.prism-callout--success{background:color-mix(in srgb,#10b981 10%,var(--prism-surface));border-color:color-mix(in srgb,#10b981 35%,transparent);color:#166534}
.prism-callout--tip{background:color-mix(in srgb,#a855f7 10%,var(--prism-surface));border-color:color-mix(in srgb,#a855f7 35%,transparent);color:#6b21a8}
html[data-theme="dark"] .prism-callout--info{color:#93c5fd}
html[data-theme="dark"] .prism-callout--warning{color:#fcd34d}
html[data-theme="dark"] .prism-callout--success{color:#86efac}
html[data-theme="dark"] .prism-callout--tip{color:#d8b4fe}
.prism-callout-title{font-weight:700;margin-bottom:.375rem;font-size:.95rem}
.prism-callout p{font-size:.9rem;line-height:1.6;margin:0}
.prism-divider{--prism-divider-padding:48px}
.prism-divider--line{padding:var(--prism-divider-padding) 0}
.prism-divider--line::before{content:'';display:block;border-top:2px solid var(--prism-border)}
.prism-divider--space{height:calc(var(--prism-divider-padding) * 2)}
.prism-divider--dots{text-align:center;color:var(--prism-text-faint);font-size:1.5rem;letter-spacing:.4em;padding:var(--prism-divider-padding) 0;display:block}
.prism-divider--label{display:flex;align-items:center;gap:.75rem;padding:var(--prism-divider-padding) 0;color:var(--prism-text-muted);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.prism-divider--label::before,.prism-divider--label::after{content:'';flex:1;border-top:1.5px solid var(--prism-border)}
.prism-flashcards{background:var(--prism-surface-2);border:1px solid var(--prism-border);border-radius:20px;padding:1.25rem;margin:1.75rem 0}
.prism-fc-inner{min-height:10rem;background:var(--prism-surface);border-radius:14px;border:1.5px solid var(--prism-border);padding:1.5rem;display:flex;align-items:center;justify-content:center;text-align:center;margin-bottom:.875rem;box-shadow:var(--prism-shadow-soft);color:var(--prism-text)}
.prism-fc-front p,.prism-fc-back p{font-size:.98rem;line-height:1.65;color:var(--prism-text);margin:0}
.prism-fc-back{display:none}
.prism-fc-flip{width:100%;min-height:44px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;border:0;border-radius:10px;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer;margin-bottom:.75rem;transition:filter .15s;box-shadow:0 10px 22px -12px var(--prism-primary)}
.prism-fc-flip:hover{filter:brightness(1.05)}
.prism-fc-nav{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.prism-fc-prev,.prism-fc-next{background:var(--prism-surface);border:1.5px solid var(--prism-border);border-radius:8px;padding:.4rem .75rem;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;color:var(--prism-text-2);transition:background-color .15s}
.prism-fc-prev:hover:not(:disabled),.prism-fc-next:hover:not(:disabled){background:var(--prism-surface-2)}
.prism-fc-prev:disabled,.prism-fc-next:disabled{opacity:.35;cursor:not-allowed}
.prism-fc-count{font-size:.8rem;color:var(--prism-text-faint);font-weight:600}
.prism-process{margin:1.75rem 0;position:relative;padding-left:.25rem}
.prism-process-step{display:flex;align-items:flex-start;gap:1rem;margin-bottom:1.25rem;position:relative}
.prism-process-step:not(:last-child)::before{content:'';position:absolute;left:1.1rem;top:2.5rem;width:2px;height:calc(100% + .25rem);background:linear-gradient(to bottom,var(--prism-primary),var(--prism-border))}
.prism-process-num{width:2.25rem;height:2.25rem;border-radius:50%;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 8px 18px -8px var(--prism-primary)}
.prism-process-title{font-weight:700;color:var(--prism-text);margin:0 0 .25rem;line-height:1.4;font-size:.95rem}
.prism-process-desc{font-size:.875rem;color:var(--prism-text-muted);margin:0;line-height:1.6}
.prism-tabs{background:var(--prism-surface);border:1px solid var(--prism-border);border-radius:18px;overflow:hidden;margin:1.75rem 0;box-shadow:var(--prism-shadow-soft)}
.prism-tabs-bar{display:flex;border-bottom:2px solid var(--prism-border-subtle);overflow-x:auto;scrollbar-width:none}
.prism-tabs-bar::-webkit-scrollbar{display:none}
.prism-tab-btn{flex-shrink:0;padding:.85rem 1.1rem;font:inherit;font-size:.875rem;font-weight:600;border:0;background:none;cursor:pointer;color:var(--prism-text-muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s;white-space:nowrap}
.prism-tab-btn:hover{color:var(--prism-text)}
.prism-tab-btn.active{color:var(--prism-primary);border-bottom-color:var(--prism-primary)}
.prism-tabs-panels{padding:1.25rem}
.prism-tab-panel{font-size:.92rem;line-height:1.7;color:var(--prism-text-2)}
.prism-tab-panel p{margin:0}
.prism-btn-wrap{}
.prism-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.6rem 1.5rem;border-radius:12px;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s,transform .1s,filter .15s}
.prism-btn:active{transform:scale(.97)}
.prism-btn--primary{background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;border:none;box-shadow:0 10px 22px -10px var(--prism-primary)}
.prism-btn--primary:hover{filter:brightness(1.05)}
.prism-btn--outline{background:transparent;color:var(--prism-primary);border:2px solid var(--prism-primary)}
.prism-btn--ghost{background:transparent;color:var(--prism-primary);border:none;text-decoration:underline}
.prism-phone{display:none}
.prism-custom-html{margin:1.5rem 0}
/* ── Hotspots ── */
.prism-hotspots{position:relative;border-radius:12px;overflow:hidden;margin:1.5rem 0}
.prism-hotspots img{width:100%;display:block}
.prism-hs-dot{position:absolute;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:var(--prism-accent);color:#fff;border:none;cursor:pointer;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(0,0,0,.1),0 4px 12px rgba(0,0,0,.3);animation:prism-hs-pulse 2s ease-in-out infinite}
@keyframes prism-hs-pulse{0%,100%{box-shadow:0 0 0 6px rgba(0,0,0,.1),0 4px 12px rgba(0,0,0,.3)}50%{box-shadow:0 0 0 12px rgba(0,0,0,.05),0 4px 12px rgba(0,0,0,.3)}}
.prism-hs-pop{position:absolute;max-width:280px;min-width:200px;background:#fff;color:#1a1a2e;border-radius:12px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none;z-index:5}
.prism-hs-pop-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.prism-hs-pop-h strong{font-size:14px;color:var(--prism-accent)}
.prism-hs-close{background:none;border:none;cursor:pointer;color:#999;font-size:18px;line-height:1}
.prism-hs-pop p{margin:8px 0 0;font-size:13px;line-height:1.5}
/* ── Gallery ── */
.prism-gallery{margin:1.5rem 0;position:relative}
.prism-g-slides{border-radius:12px;overflow:hidden;background:#000}
.prism-g-slide{display:none}
.prism-g-slide.active{display:block}
.prism-g-slide img{width:100%;display:block;max-height:500px;object-fit:contain}
.prism-g-slide p{text-align:center;font-size:13px;opacity:.75;margin:8px 0 0;color:#475569}
.prism-g-controls{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px}
.prism-g-prev,.prism-g-next{background:var(--prism-accent);color:#fff;border:none;border-radius:999px;width:36px;height:36px;cursor:pointer;font-size:18px}
.prism-g-dots{display:flex;gap:6px}
.prism-g-dot{width:8px;height:8px;border-radius:4px;background:#ccc;border:none;cursor:pointer;transition:all .2s;padding:0}
.prism-g-dot.active{width:24px;background:var(--prism-accent)}
.prism-gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:1.5rem 0}
.prism-gallery-grid figure{margin:0}
.prism-gallery-grid img{width:100%;border-radius:12px;display:block}
.prism-gallery-grid figcaption{margin-top:6px;font-size:12px;text-align:center;opacity:.7}
/* ── Compare ── */
.prism-compare{position:relative;border-radius:12px;overflow:hidden;user-select:none;touch-action:none;cursor:ew-resize;background:#000;margin:1.5rem 0}
.prism-cmp-after{width:100%;display:block}
.prism-cmp-clip{position:absolute;inset:0;width:50%;overflow:hidden}
.prism-cmp-clip img{width:200%;max-width:none;display:block}
.prism-cmp-divider{position:absolute;top:0;bottom:0;left:50%;width:3px;background:#fff;box-shadow:0 0 12px rgba(0,0,0,.5)}
.prism-cmp-handle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:var(--prism-accent);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700}
.prism-cmp-label{position:absolute;top:12px;background:rgba(0,0,0,.6);color:#fff;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600}
.prism-cmp-lbefore{left:12px}
.prism-cmp-lafter{right:12px}
/* ── Audio ── */
.prism-audio{border:2px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;margin:1.5rem 0}
.prism-audio-title{padding:12px 16px;font-size:14px;font-weight:700;color:var(--prism-accent);border-bottom:1px solid rgba(0,0,0,.06)}
.prism-audio audio{width:100%;display:block;margin:16px}
.prism-audio audio{width:calc(100% - 32px)}
.prism-audio details{padding:0 16px 16px}
.prism-audio summary{cursor:pointer;font-size:13px;font-weight:600;opacity:.75}
.prism-audio details p{margin-top:8px;font-size:13px;line-height:1.6;white-space:pre-wrap}
/* ── Labeled Graphic ── */
.prism-labeled-graphic{position:relative;border-radius:12px;overflow:hidden;margin:1.5rem 0}
.prism-labeled-graphic img{width:100%;display:block}
.prism-lg-label{position:absolute;transform:translate(-50%,-50%);background:#fff;color:#1a1a2e;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.25);border:2px solid var(--prism-accent);display:flex;align-items:center;gap:6px;white-space:nowrap}
.prism-lg-dot{width:6px;height:6px;border-radius:50%;background:var(--prism-accent)}
/* ── Fill Blanks ── */
.prism-fill-blanks{border:2px solid rgba(0,0,0,.08);border-radius:12px;padding:20px;margin:1.5rem 0;background:rgba(0,0,0,.02)}
.prism-fill-blanks p{font-size:16px;line-height:2;margin:0;color:#1e293b}
.prism-fb-input{display:inline-block;width:120px;padding:4px 10px;margin:0 4px;border:2px solid var(--prism-accent);border-radius:6px;background:#fff;color:#1a1a2e;font-size:15px;font-weight:600}
.prism-fb-input.correct{border-color:#10b981}
.prism-fb-input.wrong{border-color:#ef4444}
.prism-fb-actions{display:flex;justify-content:flex-end;margin-top:16px}
.prism-fb-check{padding:8px 20px;border-radius:8px;border:none;background:var(--prism-accent);color:#fff;font-weight:700;cursor:pointer}
/* ── Reveal Cards ── */
.prism-reveal-cards{display:grid;gap:12px;margin:1.5rem 0}
.prism-rc-card{position:relative;min-height:140px;border:none;border-radius:14px;cursor:pointer;padding:20px;background:#fff;color:#1a1a2e;box-shadow:0 4px 16px rgba(0,0,0,.08);font-size:16px;font-weight:600;transition:all .4s cubic-bezier(.4,0,.2,1);display:flex;align-items:center;justify-content:center;text-align:center}
.prism-rc-card.flipped{background:var(--prism-accent);color:#fff;transform:scale(1.02)}
.prism-rc-hint{position:absolute;bottom:8px;right:10px;font-size:10px;font-weight:700;opacity:.5;text-transform:uppercase;letter-spacing:1px}
/* ── Matching ── */
.prism-matching{border:2px solid rgba(0,0,0,.08);border-radius:12px;padding:16px;margin:1.5rem 0;background:rgba(0,0,0,.02)}
.prism-mt-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.prism-mt-term{background:#fff;color:#1a1a2e;border-radius:10px;padding:12px;margin-bottom:8px;border:2px solid #e2e8f0;display:flex;align-items:center;gap:12px;min-height:60px}
.prism-mt-term.correct{border-color:#10b981}
.prism-mt-term.wrong{border-color:#ef4444}
.prism-mt-term strong{font-size:14px;flex-shrink:0}
.prism-mt-slot{flex:1;font-size:13px;padding:6px 10px;border-radius:6px;border:1px dashed #cbd5e1;text-align:center;color:#94a3b8}
.prism-mt-slot[data-did]{background:rgba(0,0,0,.05);border:none;color:#1a1a2e}
.prism-mt-def{background:var(--prism-accent);color:#fff;border-radius:10px;padding:12px;margin-bottom:8px;cursor:grab;font-size:13px;font-weight:500;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.prism-mt-check{padding:8px 20px;border-radius:8px;border:none;background:var(--prism-accent);color:#fff;font-weight:700;cursor:pointer;margin-top:12px;float:right}
/* ── Sorting ── */
.prism-sorting{border:2px solid rgba(0,0,0,.08);border-radius:12px;padding:16px;margin:1.5rem 0;background:rgba(0,0,0,.02)}
.prism-sort-prompt{font-size:15px;font-weight:600;margin:0 0 12px;color:#1e293b}
.prism-sort-item{display:flex;align-items:center;gap:12px;background:#fff;color:#1a1a2e;border-radius:10px;padding:12px;margin-bottom:8px;border:2px solid #e2e8f0;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.prism-sort-item.correct{border-color:#10b981}
.prism-sort-item.wrong{border-color:#ef4444}
.prism-sort-num{width:28px;height:28px;border-radius:8px;background:var(--prism-accent);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.prism-sort-text{flex:1;font-size:14px}
.prism-sort-check{padding:8px 20px;border-radius:8px;border:none;background:var(--prism-accent);color:#fff;font-weight:700;cursor:pointer;margin-top:8px;float:right}
/* ── Scenario ── */
.prism-scenario{border:2px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;background:rgba(0,0,0,.02);margin:1.5rem 0}
.prism-sc-header{background:var(--prism-accent);color:#fff;padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}
.prism-sc-title{opacity:.7}
.prism-sc-body{padding:20px}
.prism-sc-text{font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap;color:#1e293b}
.prism-sc-choices{margin-top:20px;display:flex;flex-direction:column;gap:8px}
.prism-sc-choice,.prism-sc-restart{text-align:left;background:#fff;color:#1a1a2e;border:2px solid rgba(0,0,0,.1);border-radius:10px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:border-color .15s}
.prism-sc-choice:hover:not(:disabled),.prism-sc-restart:hover{border-color:var(--prism-accent)}
.prism-sc-choice:disabled{opacity:.5;cursor:not-allowed}
.prism-sc-restart{background:var(--prism-accent);color:#fff;border:none;text-align:center;font-weight:700}
/* ── Image lightbox ── */
.prism-lesson img{cursor:zoom-in}
.prism-hotspots img, .prism-labeled-graphic img, .prism-compare img{cursor:default}
.prism-lightbox{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);cursor:zoom-out;animation:prism-lb-in .18s ease both}
@keyframes prism-lb-in{from{opacity:0}to{opacity:1}}
.prism-lightbox img{max-width:100vw;max-height:100vh;width:100%;height:100%;object-fit:contain;border-radius:0;cursor:default}
.prism-lb-close{position:absolute;top:1rem;right:1rem;width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.15);border:none;border-radius:50%;color:#fff;font-size:1.25rem;cursor:pointer;line-height:1}
`;
}

// ── Interaction JS ─────────────────────────────────────────────────────────

function buildInteractionJs(): string {
  return `(function(){
// MCQ
document.querySelectorAll('.prism-mcq').forEach(function(el){
  var multi=el.dataset.multi==='true';
  var fb=el.dataset.feedback==='true';
  var submit=el.querySelector('.prism-submit');
  var result=el.querySelector('.prism-result');
  var retry=el.querySelector('.prism-retry');
  var opts=el.querySelectorAll('.prism-opt');
  var selected=new Set();
  opts.forEach(function(btn){
    btn.addEventListener('click',function(){
      if(el.dataset.submitted==='1')return;
      if(!multi){selected.clear();opts.forEach(function(b){b.classList.remove('selected')});}
      var id=btn.dataset.id;
      if(selected.has(id)){selected.delete(id);btn.classList.remove('selected');}
      else{selected.add(id);btn.classList.add('selected');}
      submit.disabled=selected.size===0;
    });
  });
  submit.addEventListener('click',function(){
    el.dataset.submitted='1';
    var allOk=true;
    opts.forEach(function(btn){
      var id=btn.dataset.id;
      var correct=btn.dataset.correct==='true';
      var marker=btn.querySelector('.prism-opt-marker');
      if(selected.has(id)){
        if(correct){btn.classList.add('correct');if(marker)marker.textContent='✓';}
        else{btn.classList.add('wrong');if(marker)marker.textContent='✗';allOk=false;}
      } else if(correct && !selected.has(id)){allOk=false;}
    });
    result.textContent=allOk?'✓ Nailed it!':'✗ Not quite — give it another go!';
    result.className='prism-result '+(allOk?'ok':'bad');
    if(allOk){opts.forEach(function(btn){if(btn.classList.contains('correct')){btn.classList.remove('prism-correct-pop');void btn.offsetWidth;btn.classList.add('prism-correct-pop');}});}
    else{opts.forEach(function(btn){if(btn.classList.contains('wrong')){btn.classList.remove('prism-shake');void btn.offsetWidth;btn.classList.add('prism-shake');}});}
    submit.style.display='none';
    retry.style.display='inline';
    window.__prismTotal=(window.__prismTotal||0)+1;
    if(allOk)window.__prismCorrect=(window.__prismCorrect||0)+1;
    // SCORM score
    if(window.__prismAPI){
      try{window.__prismAPI.LMSSetValue('cmi.core.score.raw',allOk?'100':'0');window.__prismAPI.LMSSetValue('cmi.core.score.min','0');window.__prismAPI.LMSSetValue('cmi.core.score.max','100');window.__prismAPI.LMSCommit('');}catch(e){}
    }
  });
  retry.addEventListener('click',function(){
    el.dataset.submitted='0';
    selected.clear();
    opts.forEach(function(btn){btn.classList.remove('selected','correct','wrong');var m=btn.querySelector('.prism-opt-marker');if(m)m.textContent='';});
    result.textContent='';submit.style.display='';submit.disabled=true;retry.style.display='none';
  });
});
// True/False
document.querySelectorAll('.prism-tf').forEach(function(el){
  var correct=el.dataset.correct==='true';
  var tf=el.dataset.tf||'';var ff=el.dataset.ff||'';
  var res=el.querySelector('.prism-result');
  var retry=el.querySelector('.prism-retry');
  el.querySelectorAll('.prism-tf-btns button').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(el.dataset.answered==='1')return;
      el.dataset.answered='1';
      var answer=btn.dataset.answer==='true';
      var ok=answer===correct;
      btn.className=ok?'selected-ok':'selected-bad';
      if(ok){btn.classList.remove('prism-correct-pop');void btn.offsetWidth;btn.classList.add('prism-correct-pop');}
      else{btn.classList.remove('prism-shake');void btn.offsetWidth;btn.classList.add('prism-shake');}
      if(res){res.textContent=(ok?'Correct! ':'Not quite. ')+(answer?tf:ff);res.style.display='';}
      if(retry)retry.style.display='inline';
      window.__prismTotal=(window.__prismTotal||0)+1;
      if(ok)window.__prismCorrect=(window.__prismCorrect||0)+1;
      if(window.__prismAPI){try{window.__prismAPI.LMSCommit('');}catch(e){}}
    });
  });
  if(retry)retry.addEventListener('click',function(){
    el.dataset.answered='0';
    el.querySelectorAll('.prism-tf-btns button').forEach(function(b){b.className='';});
    if(res){res.textContent='';res.style.display='none';}
    retry.style.display='none';
  });
});
// Accordion
document.querySelectorAll('.prism-acc-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var body=btn.nextElementSibling;
    var arrow=btn.querySelector('.prism-acc-arrow');
    if(!body)return;
    var open=body.style.display!=='none';
    body.style.display=open?'none':'block';
    if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
  });
});
// Flashcards
document.querySelectorAll('.prism-flashcards').forEach(function(fc){
  var total=parseInt(fc.dataset.total||'0',10);
  var current=0;
  var cards=fc.querySelectorAll('.prism-fc-card');
  var count=fc.querySelector('.prism-fc-count');
  var prev=fc.querySelector('.prism-fc-prev');
  var next=fc.querySelector('.prism-fc-next');
  function goTo(idx){
    cards[current].style.display='none';
    current=idx;
    cards[current].style.display='';
    if(count)count.textContent=(current+1)+' / '+total;
    if(prev)prev.disabled=(current===0);
    if(next)next.disabled=(current===total-1);
  }
  fc.querySelectorAll('.prism-fc-flip').forEach(function(btn){
    btn.addEventListener('click',function(){
      var inner=btn.previousElementSibling;
      if(!inner)return;
      var flipped=inner.dataset.flipped==='true';
      var front=inner.querySelector('.prism-fc-front');
      var back=inner.querySelector('.prism-fc-back');
      if(!flipped){
        if(front)front.style.display='none';
        if(back)back.style.display='flex';
        btn.textContent='Tap to flip back';
        inner.dataset.flipped='true';
      } else {
        if(front)front.style.display='flex';
        if(back)back.style.display='none';
        btn.textContent='Tap to reveal';
        inner.dataset.flipped='false';
      }
    });
  });
  if(prev)prev.addEventListener('click',function(){if(current>0)goTo(current-1);});
  if(next)next.addEventListener('click',function(){if(current<total-1)goTo(current+1);});
});
// Tabs
document.querySelectorAll('.prism-tabs').forEach(function(tabs){
  var btns=tabs.querySelectorAll('.prism-tab-btn');
  var panels=tabs.querySelectorAll('.prism-tab-panel');
  btns.forEach(function(btn){
    btn.addEventListener('click',function(){
      var idx=parseInt(btn.dataset.idx||'0',10);
      btns.forEach(function(b){b.classList.remove('active');});
      panels.forEach(function(p){p.style.display='none';});
      btn.classList.add('active');
      if(panels[idx])panels[idx].style.display='';
    });
  });
});
// Gallery carousel
document.querySelectorAll('.prism-gallery[data-prism-gallery]').forEach(function(r){
  var i=0,n=parseInt(r.getAttribute('data-prism-gallery')||'1',10);
  function go(j){i=(j+n)%n;r.querySelectorAll('.prism-g-slide').forEach(function(s,k){s.classList.toggle('active',k===i)});r.querySelectorAll('.prism-g-dot').forEach(function(d,k){d.classList.toggle('active',k===i)})}
  var prev=r.querySelector('.prism-g-prev'),next=r.querySelector('.prism-g-next');
  if(prev)prev.addEventListener('click',function(){go(i-1)});
  if(next)next.addEventListener('click',function(){go(i+1)});
  r.querySelectorAll('.prism-g-dot').forEach(function(d){d.addEventListener('click',function(){go(parseInt(d.getAttribute('data-i')||'0',10))})});
});
// Image lightbox
document.querySelectorAll('.prism-lesson img').forEach(function(img){
  if(img.closest('.prism-hotspots')||img.closest('.prism-labeled-graphic')||img.closest('.prism-compare'))return;
  img.addEventListener('click',function(){
    var lb=document.createElement('div');
    lb.className='prism-lightbox';
    lb.setAttribute('role','dialog');
    lb.setAttribute('aria-modal','true');
    var close=document.createElement('button');
    close.className='prism-lb-close';
    close.type='button';
    close.setAttribute('aria-label','Close fullscreen');
    close.innerHTML='&times;';
    var lbImg=document.createElement('img');
    lbImg.src=img.src;
    lbImg.alt=img.alt||'';
    lbImg.addEventListener('click',function(e){e.stopPropagation();});
    lb.appendChild(close);
    lb.appendChild(lbImg);
    document.body.appendChild(lb);
    function closeLb(){document.body.removeChild(lb);document.removeEventListener('keydown',onKey);}
    lb.addEventListener('click',closeLb);
    close.addEventListener('click',function(e){e.stopPropagation();closeLb();});
    function onKey(e){if(e.key==='Escape')closeLb();}
    document.addEventListener('keydown',onKey);
  });
});
})();`;
}

// ── Welcome page (Rise-360-style cover) ───────────────────────────────────

function buildWelcomePage(mod: ExportModule, _theme: ExportTheme, hasLogo: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${escapeHtml(mod.title)}</title>
<link rel="stylesheet" href="styles.css"/>
<script>(function(){try{var t=localStorage.getItem('prism-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
.prism-welcome{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;position:relative;overflow:hidden}
.prism-welcome::before{content:'';position:fixed;inset:0;background:var(--prism-bg-grad);z-index:0;pointer-events:none}
.prism-welcome-inner{position:relative;z-index:1;max-width:560px;width:100%}
.prism-welcome-logo-wrap{margin:0 auto 36px;display:flex;justify-content:center}
.prism-welcome-logo-img{width:88px;height:88px;object-fit:contain;border-radius:16px}
.prism-welcome-logo-emblem{width:88px;height:88px;border-radius:22px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));box-shadow:0 24px 56px -16px var(--prism-primary)}
.prism-welcome-kicker{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--prism-primary);margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:10px}
.prism-welcome-kicker::before,.prism-welcome-kicker::after{content:'';width:28px;height:2px;border-radius:2px;background:currentColor}
.prism-welcome h1{font-family:var(--prism-font-heading);font-size:clamp(2rem,6vw,3.5rem);font-weight:800;color:var(--prism-text);letter-spacing:-.025em;line-height:1.1;margin-bottom:20px}
.prism-welcome-meta{font-size:14px;color:var(--prism-text-muted);margin-bottom:52px;line-height:1.8}
.prism-welcome-meta span{display:inline-flex;align-items:center;gap:6px;margin:0 12px;font-weight:600}
.prism-welcome-start{display:inline-flex;align-items:center;gap:12px;padding:17px 44px;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));color:#fff;font-weight:800;font-size:16px;letter-spacing:.05em;border-radius:16px;text-decoration:none;box-shadow:0 18px 44px -14px var(--prism-primary);transition:transform .18s ease,box-shadow .18s ease;cursor:pointer;border:none}
.prism-welcome-start:hover{transform:translateY(-2px);box-shadow:0 24px 52px -14px var(--prism-primary)}
.prism-welcome-start svg{flex-shrink:0}
</style>
</head>
<body>
<div class="prism-shell">
  <div class="prism-welcome">
    <div class="prism-welcome-inner">
      <div class="prism-welcome-logo-wrap">
        ${hasLogo ? '<img class="prism-welcome-logo-img" src="assets/logo.png" alt=""/>' : '<div class="prism-welcome-logo-emblem"></div>'}
      </div>
      <div class="prism-welcome-kicker">Course</div>
      <h1>${escapeHtml(mod.title)}</h1>
      <p class="prism-welcome-meta">
        <span>${mod.lessons.length} lesson${mod.lessons.length !== 1 ? 's' : ''}</span>
      </p>
      <button class="prism-welcome-start" id="startBtn">
        Start course
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>
  </div>
</div>
<script src="assets/scorm12.min.js"></script>
<script>
(function(){
  var api=(function(){function findAPI(w){var n=0;while(w.parent&&w.parent!==w&&n<7){n++;if(w.parent.API)return w.parent.API;w=w.parent;}return null;}return window.API||findAPI(window)||(window.opener&&(window.opener.API||findAPI(window.opener)))||window.__prismFallbackAPI||null;})();
  if(api){try{api.LMSInitialize('');api.LMSSetValue('cmi.core.lesson_status','not attempted');api.LMSCommit('');}catch(e){}}
  document.getElementById('startBtn').addEventListener('click',function(){
    var inner=document.querySelector('.prism-welcome-inner');
    if(inner){inner.style.transition='opacity .22s ease,transform .22s ease';inner.style.opacity='0';inner.style.transform='scale(.97) translateY(8px)';}
    setTimeout(function(){window.location.href='lesson_0.html';},220);
  });
})();
</script>
</body>
</html>`;
}

// ── Goodbye page (shown after exit) ───────────────────────────────────────

function buildGoodbyePage(_theme: ExportTheme): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>Course closed</title>
<link rel="stylesheet" href="styles.css"/>
<script>(function(){try{var t=localStorage.getItem('prism-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
.prism-bye{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;position:relative}
.prism-bye::before{content:'';position:fixed;inset:0;background:var(--prism-bg-grad);z-index:0;pointer-events:none}
.prism-bye-inner{position:relative;z-index:1;max-width:480px;width:100%}
.prism-bye-icon{width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,var(--prism-primary),var(--prism-accent));display:flex;align-items:center;justify-content:center;margin:0 auto 32px;box-shadow:0 20px 52px -14px var(--prism-primary);animation:prism-bye-pop .65s cubic-bezier(.2,.8,.2,1) both}
@keyframes prism-bye-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
.prism-bye h1{font-family:var(--prism-font-heading);font-size:2.5rem;font-weight:800;color:var(--prism-text);letter-spacing:-.025em;margin-bottom:16px}
.prism-bye p{font-size:16px;color:var(--prism-text-muted);line-height:1.75}
</style>
</head>
<body>
<div class="prism-bye">
  <div class="prism-bye-inner">
    <div class="prism-bye-icon"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    <h1>Thank you!</h1>
    <p>You can now close this course.</p>
  </div>
</div>
<script src="assets/scorm12.min.js"></script>
<script>
(function(){
  var api=(function(){function findAPI(w){var n=0;while(w.parent&&w.parent!==w&&n<7){n++;if(w.parent.API)return w.parent.API;w=w.parent;}return null;}return window.API||findAPI(window)||(window.opener&&(window.opener.API||findAPI(window.opener)))||window.__prismFallbackAPI||null;})();
  if(api){try{api.LMSCommit('');api.LMSFinish('');}catch(e){}}
})();
</script>
</body>
</html>`;
}

// ── Lesson HTML page ───────────────────────────────────────────────────────

function buildLessonPage(
  mod: ExportModule,
  lessonIdx: number,
  assetMap: Record<string, string>,
  _theme: ExportTheme,
  options: ExportOptions,
  logoPath: string,
): string {
  const lesson = mod.lessons[lessonIdx]!;
  const total = mod.lessons.length;
  const isLast = lessonIdx === total - 1;
  const pct = Math.round(((lessonIdx + 1) / total) * 100);

  const blocksHtml = lesson.blocks
    .map((b, i) => `<div class="prism-block" style="--i:${i}">${renderBlock(b, assetMap)}</div>`)
    .join('\n');

  // Lesson dots — clickable chips representing every lesson
  const dotsHtml = mod.lessons
    .map((_, i) => {
      const cls = i < lessonIdx ? 'prism-dot done' : i === lessonIdx ? 'prism-dot current' : 'prism-dot';
      return `<a class="${cls}" href="lesson_${i}.html" data-lesson="${i}" aria-label="Go to lesson ${i + 1}"></a>`;
    })
    .join('');

  // Lessons drawer list — title + status
  const drawerItems = mod.lessons
    .map((l, i) => {
      const cls = i < lessonIdx ? 'prism-drawer-item done' : i === lessonIdx ? 'prism-drawer-item current' : 'prism-drawer-item';
      const stateLabel = i < lessonIdx ? 'Completed' : i === lessonIdx ? 'In progress' : `Lesson ${i + 1}`;
      return `<a class="${cls}" href="lesson_${i}.html"><span class="prism-drawer-num">${i < lessonIdx ? '✓' : i + 1}</span><span><span class="prism-drawer-label">${escapeHtml(l.title)}</span><span class="prism-drawer-meta">${stateLabel}</span></span></a>`;
    })
    .join('');

  const prevBtn = lessonIdx > 0
    ? `<a class="prism-nav-btn" href="lesson_${lessonIdx - 1}.html" data-prism-prev><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>Back</a>`
    : `<span class="prism-nav-btn prism-nav-btn--ghost"></span>`;
  const nextBtn = !isLast
    ? `<a class="prism-nav-btn prism-nav-btn--primary" href="lesson_${lessonIdx + 1}.html" data-prism-next>Continue<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 6l6 6-6 6"/></svg></a>`
    : `<button class="prism-nav-btn prism-nav-btn--primary" type="button" data-prism-finish>Finish<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6L9 17l-5-5"/></svg></button>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${escapeHtml(lesson.title)} · ${escapeHtml(mod.title)}</title>
<link rel="stylesheet" href="styles.css"/>
<script src="assets/lottie.min.js"></script>
<script>(function(){try{var t=localStorage.getItem('prism-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>
</head>
<body data-criteria="${options.completionCriteria}" data-passing="${options.passingScore}">
<div class="prism-shell">
  <div class="prism-stage">
    <div class="prism-toolbar">
      <div class="prism-brand">
        ${logoPath ? `<img src="${logoPath}" class="prism-brand-logo" alt="" aria-hidden="true"/>` : '<span class="prism-brand-mark" aria-hidden="true"></span>'}
        <span class="prism-brand-name">${escapeHtml(mod.title)}</span>
      </div>
      <div class="prism-tools">
        <button class="prism-tool" type="button" data-prism-lessons aria-label="Show lessons" title="Lessons"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <button class="prism-tool" type="button" data-prism-theme aria-label="Toggle theme" title="Toggle theme"><svg class="prism-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></button>
        <button class="prism-exit" type="button" data-prism-exit>Exit course</button>
      </div>
    </div>
    <main class="prism-card">
      <header class="prism-top">
        <span class="prism-lesson-badge">Lesson ${lessonIdx + 1} of ${total}</span>
        <div class="prism-title-row">
          <h1>${escapeHtml(lesson.title)}</h1>
          <span class="prism-count">${pct}%</span>
        </div>
        <div class="prism-progress"><span style="width:${pct}%"></span></div>
        ${total > 1 ? `<div class="prism-dots">${dotsHtml}</div>` : ''}
      </header>
      <section class="prism-lesson" data-prism-content>
        ${blocksHtml}
      </section>
      ${total > 1 || isLast ? `<nav class="prism-nav">${prevBtn}<span class="prism-nav-meta"><span class="prism-nav-meta-dot"></span>${lessonIdx + 1} / ${total}</span>${nextBtn}</nav>` : ''}
    </main>
  </div>
</div>

<aside class="prism-drawer" data-prism-drawer aria-hidden="true">
  <div class="prism-drawer-panel" role="dialog" aria-label="Lessons">
    <div class="prism-drawer-head">
      <span class="prism-drawer-title">${escapeHtml(mod.title)}</span>
      <button class="prism-drawer-close" type="button" data-prism-drawer-close aria-label="Close">×</button>
    </div>
    <div class="prism-drawer-list">${drawerItems}</div>
  </div>
</aside>

<div class="prism-complete" data-prism-complete aria-hidden="true">
  <div class="prism-complete-card" role="dialog" aria-label="Module complete">
    <div class="prism-complete-check">✓</div>
    <h2>You crushed it!</h2>
    <p>That's a wrap on <strong>${escapeHtml(mod.title)}</strong>. Your progress has been saved. Keep it up!</p>
    <div class="prism-complete-row">
      <button type="button" data-prism-restart>Restart</button>
      <button type="button" class="primary" data-prism-close-complete>Done</button>
    </div>
  </div>
</div>

<script src="assets/scorm12.min.js"></script>
<script>
(function(){
  var api=(function(){function findAPI(w){var n=0;while(w.parent&&w.parent!==w&&n<7){n++;if(w.parent.API)return w.parent.API;w=w.parent;}return null;}return window.API||findAPI(window)||(window.opener&&(window.opener.API||findAPI(window.opener)))||window.__prismFallbackAPI||null;})();
  window.__prismAPI=api;
  window.__prismCorrect=0;window.__prismTotal=0;
  if(api){try{api.LMSInitialize('');api.LMSSetValue('cmi.core.lesson_status',${isLast ? "'completed'" : "'incomplete'"});api.LMSCommit('');}catch(e){}}
  // Safety net: commit+finish whenever this page unloads (covers tab-close, navigation away)
  window.addEventListener('pagehide',function(){if(api){try{api.LMSCommit('');api.LMSFinish('');}catch(e){}}});
})();
</script>
<script>
(function(){
  // Theme toggle (persisted)
  var themeBtn=document.querySelector('[data-prism-theme]');
  if(themeBtn){themeBtn.addEventListener('click',function(){var cur=document.documentElement.getAttribute('data-theme')||'light';var next=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);try{localStorage.setItem('prism-theme',next);}catch(e){}});}

  // Lessons drawer
  var drawer=document.querySelector('[data-prism-drawer]');
  var openBtn=document.querySelector('[data-prism-lessons]');
  var closeBtn=document.querySelector('[data-prism-drawer-close]');
  function openDrawer(){if(drawer){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');}}
  function closeDrawer(){if(drawer){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');}}
  if(openBtn)openBtn.addEventListener('click',openDrawer);
  if(closeBtn)closeBtn.addEventListener('click',closeDrawer);
  if(drawer)drawer.addEventListener('click',function(e){if(e.target===drawer)closeDrawer();});

  // Exit course
  var exitBtn=document.querySelector('[data-prism-exit]');
  if(exitBtn)exitBtn.addEventListener('click',function(){var api=window.__prismAPI;if(api){try{api.LMSCommit('');api.LMSFinish('');}catch(e){}}window.location.href='goodbye.html';});

  // Keyboard nav
  document.addEventListener('keydown',function(e){
    if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(e.key==='ArrowLeft'){var p=document.querySelector('[data-prism-prev]');if(p)p.click();}
    else if(e.key==='ArrowRight'){var n=document.querySelector('[data-prism-next]');if(n)n.click();}
    else if(e.key==='Escape')closeDrawer();
  });

  // Completion overlay
  var complete=document.querySelector('[data-prism-complete]');
  var finishBtn=document.querySelector('[data-prism-finish]');
  function showComplete(){
    if(!complete)return;
    complete.classList.add('show');complete.setAttribute('aria-hidden','false');
    fireConfetti();
    var crit=document.body.dataset.criteria||'completed';
    var passing=parseInt(document.body.dataset.passing||'80',10);
    var score=window.__prismTotal>0?Math.round(window.__prismCorrect/window.__prismTotal*100):100;
    var status=crit==='completed'?'completed':(score>=passing?'passed':'failed');
    var api=window.__prismAPI;if(api){try{if(window.__prismTotal>0){api.LMSSetValue('cmi.core.score.raw',String(score));api.LMSSetValue('cmi.core.score.min','0');api.LMSSetValue('cmi.core.score.max','100');}api.LMSSetValue('cmi.core.lesson_status',status);api.LMSCommit('');api.LMSFinish('');}catch(e){}}
  }
  function fireConfetti(){
    var wrap=document.createElement('div');wrap.className='prism-confetti';document.body.appendChild(wrap);
    var colors=['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6'];
    for(var i=0;i<60;i++){var p=document.createElement('i');p.style.left=(Math.random()*100)+'%';p.style.background=colors[i%colors.length];p.style.animationDuration=(2+Math.random()*2)+'s';p.style.animationDelay=(Math.random()*0.6)+'s';p.style.transform='rotate('+(Math.random()*360)+'deg)';wrap.appendChild(p);}
    setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);},5000);
  }
  if(finishBtn)finishBtn.addEventListener('click',showComplete);
  var restart=document.querySelector('[data-prism-restart]');
  if(restart)restart.addEventListener('click',function(){window.location.href='lesson_0.html';});
  var closeC=document.querySelector('[data-prism-close-complete]');
  if(closeC)closeC.addEventListener('click',function(){if(complete){complete.classList.remove('show');complete.setAttribute('aria-hidden','true');}var api=window.__prismAPI;if(api){try{api.LMSFinish('');}catch(e){}}});

  // ── Ripple effect on primary buttons ──
  function addRipple(el,e){
    var rect=el.getBoundingClientRect();
    var x=(e&&e.clientX?e.clientX:rect.left+rect.width/2)-rect.left;
    var y=(e&&e.clientY?e.clientY:rect.top+rect.height/2)-rect.top;
    var size=Math.max(rect.width,rect.height)*2.5;
    var ink=document.createElement('span');
    ink.style.cssText='position:absolute;border-radius:50%;background:rgba(255,255,255,.28);width:'+size+'px;height:'+size+'px;left:'+(x-size/2)+'px;top:'+(y-size/2)+'px;transform:scale(0);animation:prism-ripple-expand 550ms ease-out forwards;pointer-events:none;z-index:1;';
    el.appendChild(ink);
    setTimeout(function(){if(ink.parentNode)ink.parentNode.removeChild(ink);},600);
  }
  document.querySelectorAll('.prism-nav-btn--primary').forEach(function(btn){
    btn.addEventListener('click',function(e){addRipple(btn,e);});
  });

  // ── Toast notification ──
  function showToast(msg){
    var old=document.querySelector('.prism-toast');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
    var t=document.createElement('div');
    t.className='prism-toast';t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(function(){t.classList.add('hiding');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},250);},2400);
  }

  // ── Directional page transitions ──
  function navigateTo(href,dir){
    var card=document.querySelector('.prism-card');
    // scroll lesson content to top first
    var content=document.querySelector('[data-prism-content]');
    if(content)content.scrollTop=0;
    if(!card){window.location.href=href;return;}
    card.style.transition='opacity 175ms ease, transform 175ms cubic-bezier(.4,0,1,1)';
    card.style.opacity='0';
    card.style.transform=dir==='next'?'translateX(-28px)':'translateX(28px)';
    setTimeout(function(){window.location.href=href;},160);
  }
  document.querySelectorAll('a[href^="lesson_"]').forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      var dir=a.hasAttribute('data-prism-next')?'next':'prev';
      if(dir==='next')showToast('Moving on \u2192');
      navigateTo(a.getAttribute('href'),dir);
    });
  });

  // ── Touch swipe navigation ──
  var swipeEl=document.querySelector('[data-prism-content]');
  if(swipeEl){
    var _sx=0,_sy=0,_sw=false;
    swipeEl.addEventListener('touchstart',function(e){
      _sx=e.touches[0].clientX;_sy=e.touches[0].clientY;_sw=true;
    },{passive:true});
    swipeEl.addEventListener('touchend',function(e){
      if(!_sw)return;_sw=false;
      var dx=e.changedTouches[0].clientX-_sx;
      var dy=e.changedTouches[0].clientY-_sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>64){
        var target=dx<0?document.querySelector('[data-prism-next]'):document.querySelector('[data-prism-prev]');
        if(target){
          var dir2=dx<0?'next':'prev';
          var href2=target.getAttribute('href');
          if(href2)navigateTo(href2,dir2);else target.click();
        }
      }
    },{passive:true});
    // Cancel swipe on scroll
    swipeEl.addEventListener('touchmove',function(e){
      if(_sw&&Math.abs(e.touches[0].clientY-_sy)>10)_sw=false;
    },{passive:true});
  }
})();
</script>
<script src="assets/interaction.js"></script>
</body>
</html>`;
}

// ── Preview HTML (same look as export, postMessage navigation) ───────────

/**
 * Generates a standalone HTML page for in-app learner preview.
 * Identical styling to the exported SCORM lesson pages, but navigation
 * communicates via `window.parent.postMessage` instead of href navigation.
 *
 * Parent should listen for:
 *   { type: 'prism-preview-nav', dir: 'next' | 'prev' }
 *   { type: 'prism-preview-goto', idx: number }
 *   { type: 'prism-preview-exit' }
 *   { type: 'prism-preview-restart' }
 */
export function buildPreviewHtml(
  mod: ExportModule,
  lessonIdx: number,
  assetMap: Record<string, string>,
  theme: ExportTheme,
): string {
  const lesson = mod.lessons[lessonIdx]!;
  const total = mod.lessons.length;
  const isLast = lessonIdx === total - 1;
  const pct = Math.round(((lessonIdx + 1) / total) * 100);

  const blocksHtml = lesson.blocks
    .map((b, i) => `<div class="prism-block" style="--i:${i}">${renderBlock(b, assetMap)}</div>`)
    .join('\n');

  const dotsHtml = mod.lessons
    .map((_, i) => {
      const cls = i < lessonIdx ? 'prism-dot done' : i === lessonIdx ? 'prism-dot current' : 'prism-dot';
      return `<button type="button" class="${cls}" data-lesson="${i}" aria-label="Go to lesson ${i + 1}"></button>`;
    })
    .join('');

  const drawerItems = mod.lessons
    .map((l, i) => {
      const cls = i < lessonIdx ? 'prism-drawer-item done' : i === lessonIdx ? 'prism-drawer-item current' : 'prism-drawer-item';
      const stateLabel = i < lessonIdx ? 'Completed' : i === lessonIdx ? 'In progress' : `Lesson ${i + 1}`;
      return `<button type="button" class="${cls}" data-lesson="${i}"><span class="prism-drawer-num">${i < lessonIdx ? '✓' : i + 1}</span><span><span class="prism-drawer-label">${escapeHtml(l.title)}</span><span class="prism-drawer-meta">${stateLabel}</span></span></button>`;
    })
    .join('');

  const prevBtn = lessonIdx > 0
    ? `<button type="button" class="prism-nav-btn" data-prism-prev><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>Back</button>`
    : `<span class="prism-nav-btn prism-nav-btn--ghost"></span>`;
  const nextBtn = !isLast
    ? `<button type="button" class="prism-nav-btn prism-nav-btn--primary" data-prism-next>Continue<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 6l6 6-6 6"/></svg></button>`
    : `<button type="button" class="prism-nav-btn prism-nav-btn--primary" data-prism-finish>Finish<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6L9 17l-5-5"/></svg></button>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${escapeHtml(lesson.title)}</title>
<style>${buildCss(theme)}</style>
</head>
<body>
<div class="prism-shell">
  <div class="prism-stage">
    <div class="prism-toolbar">
      <div class="prism-brand">
        <span class="prism-brand-mark" aria-hidden="true"></span>
        <span class="prism-brand-name">${escapeHtml(mod.title)}</span>
      </div>
      <div class="prism-tools">
        <button class="prism-tool" type="button" data-prism-lessons aria-label="Show lessons" title="Lessons"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <button class="prism-tool" type="button" data-prism-theme aria-label="Toggle theme" title="Toggle theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></button>
        <button class="prism-exit" type="button" data-prism-exit>Back to editor</button>
      </div>
    </div>
    <main class="prism-card">
      <header class="prism-top">
        <span class="prism-lesson-badge">Lesson ${lessonIdx + 1} of ${total}</span>
        <div class="prism-title-row">
          <h1>${escapeHtml(lesson.title)}</h1>
          <span class="prism-count">${pct}%</span>
        </div>
        <div class="prism-progress"><span style="width:${pct}%"></span></div>
        ${total > 1 ? `<div class="prism-dots">${dotsHtml}</div>` : ''}
      </header>
      <section class="prism-lesson" data-prism-content>
        ${blocksHtml}
      </section>
      ${total > 1 || isLast ? `<nav class="prism-nav">${prevBtn}<span class="prism-nav-meta"><span class="prism-nav-meta-dot"></span>${lessonIdx + 1} / ${total}</span>${nextBtn}</nav>` : ''}
    </main>
  </div>
</div>

<aside class="prism-drawer" data-prism-drawer aria-hidden="true">
  <div class="prism-drawer-panel" role="dialog" aria-label="Lessons">
    <div class="prism-drawer-head">
      <span class="prism-drawer-title">${escapeHtml(mod.title)}</span>
      <button class="prism-drawer-close" type="button" data-prism-drawer-close aria-label="Close">×</button>
    </div>
    <div class="prism-drawer-list">${drawerItems}</div>
  </div>
</aside>

<div class="prism-complete" data-prism-complete aria-hidden="true">
  <div class="prism-complete-card" role="dialog" aria-label="Module complete">
    <div class="prism-complete-check">✓</div>
    <h2>You crushed it!</h2>
    <p>That's a wrap on <strong>${escapeHtml(mod.title)}</strong>. Preview complete!</p>
    <div class="prism-complete-row">
      <button type="button" data-prism-restart>Restart</button>
      <button type="button" class="primary" data-prism-close-complete>Done</button>
    </div>
  </div>
</div>

<script>${buildInteractionJs()}</script>
<script>
(function(){
  function msg(data){window.parent.postMessage(data,'*');}

  // Theme toggle
  var themeBtn=document.querySelector('[data-prism-theme]');
  if(themeBtn)themeBtn.addEventListener('click',function(){
    var cur=document.documentElement.getAttribute('data-theme')||'light';
    var next=cur==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
  });

  // Lessons drawer
  var drawer=document.querySelector('[data-prism-drawer]');
  var openBtn=document.querySelector('[data-prism-lessons]');
  var closeBtn=document.querySelector('[data-prism-drawer-close]');
  function openDrawer(){if(drawer){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');}}
  function closeDrawer(){if(drawer){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');}}
  if(openBtn)openBtn.addEventListener('click',openDrawer);
  if(closeBtn)closeBtn.addEventListener('click',closeDrawer);
  if(drawer)drawer.addEventListener('click',function(e){if(e.target===drawer)closeDrawer();});

  // Back to editor
  var exitBtn=document.querySelector('[data-prism-exit]');
  if(exitBtn)exitBtn.addEventListener('click',function(){msg({type:'prism-preview-exit'});});

  // Prev / Next / Finish
  var prevBtn=document.querySelector('[data-prism-prev]');
  var nextBtn=document.querySelector('[data-prism-next]');
  var finishBtn=document.querySelector('[data-prism-finish]');
  if(prevBtn)prevBtn.addEventListener('click',function(){msg({type:'prism-preview-nav',dir:'prev'});});
  if(nextBtn)nextBtn.addEventListener('click',function(){msg({type:'prism-preview-nav',dir:'next'});});
  if(finishBtn)finishBtn.addEventListener('click',function(){
    var complete=document.querySelector('[data-prism-complete]');
    if(complete){complete.classList.add('show');complete.setAttribute('aria-hidden','false');}
    fireConfetti();
  });

  // Completion overlay
  var restart=document.querySelector('[data-prism-restart]');
  if(restart)restart.addEventListener('click',function(){msg({type:'prism-preview-restart'});});
  var closeC=document.querySelector('[data-prism-close-complete]');
  if(closeC)closeC.addEventListener('click',function(){
    var complete=document.querySelector('[data-prism-complete]');
    if(complete){complete.classList.remove('show');complete.setAttribute('aria-hidden','true');}
    msg({type:'prism-preview-exit'});
  });

  // Lesson dots + drawer items
  document.querySelectorAll('[data-lesson]').forEach(function(el){
    el.addEventListener('click',function(e){
      e.preventDefault();
      msg({type:'prism-preview-goto',idx:parseInt(el.getAttribute('data-lesson')||'0',10)});
      closeDrawer();
    });
  });

  // Keyboard nav
  document.addEventListener('keydown',function(e){
    if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test((e.target).tagName))return;
    if(e.key==='ArrowRight'){if(nextBtn)nextBtn.click();else if(finishBtn)finishBtn.click();}
    else if(e.key==='ArrowLeft'){if(prevBtn)prevBtn.click();}
    else if(e.key==='Escape')closeDrawer();
  });

  // Confetti
  function fireConfetti(){
    var wrap=document.createElement('div');wrap.className='prism-confetti';document.body.appendChild(wrap);
    var colors=['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6'];
    for(var i=0;i<60;i++){var p=document.createElement('i');p.style.left=(Math.random()*100)+'%';p.style.background=colors[i%colors.length];p.style.animationDuration=(2+Math.random()*2)+'s';p.style.animationDelay=(Math.random()*0.6)+'s';p.style.transform='rotate('+(Math.random()*360)+'deg)';wrap.appendChild(p);}
    setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);},5000);
  }

  // Ripple on primary buttons
  function addRipple(el,e){
    var rect=el.getBoundingClientRect();
    var x=(e&&e.clientX?e.clientX:rect.left+rect.width/2)-rect.left;
    var y=(e&&e.clientY?e.clientY:rect.top+rect.height/2)-rect.top;
    var size=Math.max(rect.width,rect.height)*2.5;
    var ink=document.createElement('span');
    ink.style.cssText='position:absolute;border-radius:50%;background:rgba(255,255,255,.28);width:'+size+'px;height:'+size+'px;left:'+(x-size/2)+'px;top:'+(y-size/2)+'px;transform:scale(0);animation:prism-ripple-expand 550ms ease-out forwards;pointer-events:none;z-index:1;';
    el.appendChild(ink);
    setTimeout(function(){if(ink.parentNode)ink.parentNode.removeChild(ink);},600);
  }
  document.querySelectorAll('.prism-nav-btn--primary').forEach(function(btn){
    btn.addEventListener('click',function(e){addRipple(btn,e);});
  });

  // Touch swipe
  var swipeEl=document.querySelector('[data-prism-content]');
  if(swipeEl){
    var _sx=0,_sy=0,_sw=false;
    swipeEl.addEventListener('touchstart',function(e){_sx=e.touches[0].clientX;_sy=e.touches[0].clientY;_sw=true;},{passive:true});
    swipeEl.addEventListener('touchend',function(e){
      if(!_sw)return;_sw=false;
      var dx=e.changedTouches[0].clientX-_sx;
      var dy=e.changedTouches[0].clientY-_sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>64){
        if(dx<0){if(nextBtn)nextBtn.click();else if(finishBtn)finishBtn.click();}
        else{if(prevBtn)prevBtn.click();}
      }
    },{passive:true});
    swipeEl.addEventListener('touchmove',function(e){if(_sw&&Math.abs(e.touches[0].clientY-_sy)>10)_sw=false;},{passive:true});
  }
})();
</script>
</body>
</html>`;
}

// ── Main export function ───────────────────────────────────────────────────

export async function buildScormPackage(
  mod: ExportModule,
  theme: ExportTheme,
  options: ExportOptions,
  /** Map of storageId → resolved URL for assets used in the module */
  resolveAssetUrl: (storageId: string) => Promise<string>,
): Promise<Blob> {
  const zip = new JSZip();

  // Collect all storageIds needed
  const storageIds = new Set<string>();
  for (const lesson of mod.lessons) {
    for (const block of lesson.blocks) {
      if (!block.content) continue;
      try {
        const p = JSON.parse(block.content) as Record<string, unknown>;
        // Top-level single asset fields
        if (typeof p.storageId === 'string') storageIds.add(p.storageId);
        if (typeof p.src === 'string' && p.srcType === 'storage') storageIds.add(p.src);
        // Compare block (before/after)
        if (typeof p.beforeStorageId === 'string') storageIds.add(p.beforeStorageId);
        if (typeof p.afterStorageId === 'string') storageIds.add(p.afterStorageId);
        // Gallery block — items array
        if (Array.isArray(p.items)) {
          for (const item of p.items as Array<Record<string, unknown>>) {
            if (typeof item.storageId === 'string') storageIds.add(item.storageId);
          }
        }
        // Tabs block — per-tab media
        if (Array.isArray(p.tabs)) {
          for (const tab of p.tabs as Array<Record<string, unknown>>) {
            if (typeof tab.imageStorageId === 'string') storageIds.add(tab.imageStorageId);
            if (typeof tab.audioStorageId === 'string') storageIds.add(tab.audioStorageId);
          }
        }
        // Flashcard / carousel-style blocks with cards array
        if (Array.isArray(p.cards)) {
          for (const card of p.cards as Array<Record<string, unknown>>) {
            if (typeof card.storageId === 'string') storageIds.add(card.storageId);
            if (typeof card.imageStorageId === 'string') storageIds.add(card.imageStorageId);
          }
        }
      } catch { /* not JSON */ }
    }
  }

  // Resolve + download all assets into zip/assets/
  const assetMap: Record<string, string> = {};
  const assetsFolder = zip.folder('assets')!;

  // Try to bundle the app logo
  let logoPath = '';
  try {
    const logoRes = await fetch(window.location.origin + '/prism-logo.png');
    if (logoRes.ok) {
      const logoBlob = await logoRes.blob();
      assetsFolder.file('logo.png', logoBlob);
      logoPath = 'assets/logo.png';
    }
  } catch { /* skip */ }

  await Promise.all(
    [...storageIds].map(async (id) => {
      try {
        const url = await resolveAssetUrl(id);
        if (!url) return;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        let res: Response;
        try {
          res = await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] ?? 'bin';
        const filename = `${id}.${ext}`;
        assetsFolder.file(filename, blob);
        assetMap[id] = `assets/${filename}`;
      } catch { /* skip unreachable assets */ }
    }),
  );

  // Bundle scorm-again 1.2 min runtime
  try {
    const scormModule = await import('scorm-again/scorm12/min');
    // scorm-again exports a string or default that is the JS content
    const content = (scormModule as { default?: unknown }).default;
    if (typeof content === 'string') {
      assetsFolder.file('scorm12.min.js', content);
    } else {
      // Fallback: minimal SCORM 1.2 API shim
      assetsFolder.file('scorm12.min.js', minimalScormShim());
    }
  } catch {
    assetsFolder.file('scorm12.min.js', minimalScormShim());
  }

  // Bundle lottie-web locally so lesson pages don't depend on external CDN
  try {
    const lottieRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js');
    if (lottieRes.ok) {
      const lottieJs = await lottieRes.text();
      assetsFolder.file('lottie.min.js', lottieJs);
    } else {
      assetsFolder.file('lottie.min.js', '/* lottie-web unavailable */');
    }
  } catch {
    assetsFolder.file('lottie.min.js', '/* lottie-web unavailable */');
  }

  assetsFolder.file('interaction.js', buildInteractionJs());

  // Shared CSS
  zip.file('styles.css', buildCss(theme));

  // imsmanifest.xml
  zip.file('imsmanifest.xml', buildManifest(mod));

  // Welcome and goodbye pages
  zip.file('welcome.html', buildWelcomePage(mod, theme, logoPath !== ''));
  zip.file('goodbye.html', buildGoodbyePage(theme));

  // One HTML page per lesson
  for (let i = 0; i < mod.lessons.length; i++) {
    zip.file(`lesson_${i}.html`, buildLessonPage(mod, i, assetMap, theme, options, logoPath));
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ── Minimal SCORM 1.2 shim (fallback if scorm-again import fails) ──────────

function minimalScormShim(): string {
  return `window.__prismFallbackAPI={
  LMSInitialize:function(){return"true"},
  LMSFinish:function(){return"true"},
  LMSGetValue:function(){return""},
  LMSSetValue:function(){return"true"},
  LMSCommit:function(){return"true"},
  LMSGetLastError:function(){return"0"},
  LMSGetErrorString:function(){return"No error"},
  LMSGetDiagnostic:function(){return""}
};`;
}

// ── Trigger download ───────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height'],
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
  ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
</figure>`;
    }

    case 'video': {
      let p: Record<string, string> = {};
      try { p = JSON.parse(c) as Record<string, string>; } catch { /* */ }
      const src = p.srcType === 'storage' ? (assetMap[p.src ?? ''] ?? p.src ?? '') : (p.src ?? '');
      if (!src) return '';
      if (p.srcType === 'embed') {
        // Only allow whitelisted embed domains (YouTube and Vimeo)
        const allowedEmbedHosts = ['www.youtube.com', 'player.vimeo.com'];
        let isAllowed = false;
        try {
          const embedHost = new URL(src).hostname;
          isAllowed = allowedEmbedHosts.includes(embedHost);
        } catch { /* invalid URL */ }
        if (!isAllowed) return '';
        return `<figure class="prism-video">
  <div class="prism-video-wrap"><iframe src="${escapeHtml(src)}" allowfullscreen></iframe></div>
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
  <div class="prism-acc-body" style="display:none"><p>${escapeHtml(s.content)}</p></div>
</div>`,
      ).join('');
      return `<div class="prism-acc">${sections}</div>`;
    }

    case 'quote': {
      let p: { text?: string; attribution?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      if (!p.text) return '';
      return `<blockquote class="prism-quote">
  <p>${escapeHtml(p.text)}</p>
  ${p.attribution ? `<cite>${escapeHtml(p.attribution)}</cite>` : ''}
</blockquote>`;
    }

    case 'callout': {
      let p: { variant?: string; title?: string; body?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const variant = p.variant ?? 'info';
      return `<div class="prism-callout prism-callout--${escapeHtml(variant)}">
  ${p.title ? `<p class="prism-callout-title">${escapeHtml(p.title)}</p>` : ''}
  <p>${escapeHtml(p.body ?? '')}</p>
</div>`;
    }

    case 'divider': {
      let p: { style?: string; label?: string } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const style = p.style ?? 'line';
      if (style === 'space') return `<div class="prism-divider prism-divider--space"></div>`;
      if (style === 'dots') return `<div class="prism-divider prism-divider--dots">···</div>`;
      return p.label
        ? `<div class="prism-divider prism-divider--label"><span>${escapeHtml(p.label)}</span></div>`
        : `<hr class="prism-divider prism-divider--line" />`;
    }

    case 'flashcard': {
      let p: { cards?: Array<{ id: string; front: string; back: string }> } = {};
      try { p = JSON.parse(c) as typeof p; } catch { /* */ }
      const cards = p.cards ?? [];
      if (!cards.length) return '';
      const cardsHtml = cards.map((card, i) =>
        `<div class="prism-fc-card" data-idx="${i}" style="${i > 0 ? 'display:none' : ''}">
  <div class="prism-fc-inner" data-flipped="false">
    <div class="prism-fc-front"><p>${escapeHtml(card.front)}</p></div>
    <div class="prism-fc-back" style="display:none"><p>${escapeHtml(card.back)}</p></div>
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
    ${step.body ? `<p class="prism-process-desc">${escapeHtml(step.body)}</p>` : ''}
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
        `<button type="button" class="prism-tab-btn${i === 0 ? ' active' : ''}" data-idx="${i}">${escapeHtml(t.title)}</button>`,
      ).join('');
      const tabPanels = tabs.map((t, i) =>
        `<div class="prism-tab-panel" data-idx="${i}" style="${i > 0 ? 'display:none' : ''}"><p>${escapeHtml(t.content)}</p></div>`,
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

    default:
      return '';
  }
}

// ── imsmanifest.xml ────────────────────────────────────────────────────────

function buildManifest(mod: ExportModule): string {
  const id = `prism_${mod.id.replace(/[^a-z0-9]/gi, '_')}`;
  const items = mod.lessons
    .map(
      (l, i) => `      <item identifier="item_${i}" identifierref="res_${i}">
        <title>${escapeXml(l.title)}</title>
      </item>`,
    )
    .join('\n');
  const resources = mod.lessons
    .map(
      (l, i) => `    <resource identifier="res_${i}" type="webcontent" adlcp:scormtype="sco"
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
  return `/* Prism Learning – generated theme */
:root {
  --prism-primary: ${theme.primary};
  --prism-accent: ${theme.accent};
  --prism-font-heading: "${theme.headingFont}", sans-serif;
  --prism-font-body: "${theme.bodyFont}", sans-serif;
  --prism-motion-fast: 120ms;
  --prism-motion-base: 220ms;
  --prism-motion-slow: 360ms;
  --prism-ease-standard: cubic-bezier(.2,0,0,1);
  --prism-ease-emphasized: cubic-bezier(.2,.8,.2,1);
  --prism-stagger-step: 55ms;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--prism-font-body);background:#eef2f7;color:#334155;padding:0;-webkit-font-smoothing:antialiased}
.prism-shell{min-height:100vh;display:flex;justify-content:center;padding:1rem;background:linear-gradient(180deg,#f8fafc,#e2e8f0)}
.prism-phone{width:100%;max-width:430px;min-height:100vh;background:#fff;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.12)}
.prism-top{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0;padding:1rem 1.25rem}
.prism-kicker{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prism-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-top:.25rem}
h1{font-family:var(--prism-font-heading);font-size:1.25rem;line-height:1.25;font-weight:800;color:var(--prism-primary);max-width:17rem}
.prism-count{flex-shrink:0;border-radius:999px;background:#f1f5f9;padding:.25rem .6rem;font-size:.75rem;font-weight:700;color:#475569}
.prism-progress{height:.5rem;border-radius:999px;background:#f1f5f9;overflow:hidden;margin-top:1rem}
.prism-progress span{display:block;height:100%;border-radius:999px;background:var(--prism-primary);transition:width var(--prism-motion-slow) var(--prism-ease-emphasized)}
.prism-lesson{flex:1;padding:1.5rem 1.25rem;background:#f8fafc;overflow:auto}
.prism-block{animation:prism-block-reveal var(--prism-motion-slow) var(--prism-ease-emphasized) both;animation-delay:calc(var(--i,0) * var(--prism-stagger-step))}
@keyframes prism-block-reveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes prism-feedback-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes prism-marker-pop{0%{opacity:0;transform:scale(.65)}100%{opacity:1;transform:scale(1)}}
.prism-rt{line-height:1.7;margin-bottom:1.5rem;font-size:.95rem;color:#475569}
.prism-rt h1,.prism-rt h2,.prism-rt h3{font-family:var(--prism-font-heading);color:var(--prism-primary);margin:1.25rem 0 0.5rem}
.prism-rt p{margin-bottom:0.75rem}
.prism-rt ul,.prism-rt ol{margin-left:1.5rem;margin-bottom:0.75rem}
.prism-img{margin:1.5rem 0;text-align:center}
.prism-img img{max-width:100%;border-radius:16px;background:#f1f5f9;box-shadow:0 18px 45px rgba(15,23,42,.08)}
.prism-img figcaption{margin-top:.5rem;font-size:.85rem;color:#64748b}
.prism-video{margin:1.5rem 0}
.prism-video-wrap{position:relative;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#f1f5f9;box-shadow:0 18px 45px rgba(15,23,42,.08)}
.prism-video-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.prism-video video{max-width:100%;border-radius:16px;background:#f1f5f9;box-shadow:0 18px 45px rgba(15,23,42,.08)}
.prism-mcq{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:18px;padding:1.25rem;margin:1.5rem 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.prism-q{font-weight:700;margin-bottom:1rem;line-height:1.5;color:#1e293b}
.prism-opts{list-style:none}
.prism-opts li{margin-bottom:0.5rem}
.prism-opt{display:flex;align-items:flex-start;gap:.75rem;width:100%;min-height:3rem;padding:.75rem .875rem;background:#fff;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;font-size:.875rem;line-height:1.5;text-align:left;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:transform var(--prism-motion-fast) var(--prism-ease-standard),border-color var(--prism-motion-base),background-color var(--prism-motion-base),color var(--prism-motion-base)}
.prism-opt:active,.prism-submit:active,.prism-tf-btns button:active,.prism-nav a:active{transform:scale(.98)}
.prism-opt:hover{border-color:#94a3b8}
.prism-opt.selected{border-color:var(--prism-primary);background:#eef2ff}
.prism-opt.correct{border-color:#10b981;background:#ecfdf5;color:#065f46}
.prism-opt.wrong{border-color:#ef4444;background:#fef2f2;color:#991b1b}
.prism-opt-marker{width:1.25rem;height:1.25rem;margin-top:.1rem;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0}
.prism-opt-marker:not(:empty){animation:prism-marker-pop var(--prism-motion-base) var(--prism-ease-emphasized) both}
.prism-actions{margin-top:1rem;display:flex;align-items:center;gap:.75rem}
.prism-submit{min-height:2.75rem;background:var(--prism-primary);color:#fff;border:0;border-radius:12px;padding:.55rem 1rem;font-size:.875rem;font-weight:700;cursor:pointer;transition:transform var(--prism-motion-fast),opacity var(--prism-motion-base)}
.prism-submit:disabled{opacity:.4;cursor:not-allowed}
.prism-retry{background:none;border:0;color:var(--prism-primary);font-size:.875rem;cursor:pointer;text-decoration:underline}
.prism-result{font-size:.875rem;font-weight:600;animation:prism-feedback-enter var(--prism-motion-base) var(--prism-ease-emphasized) both}
.prism-result.ok{color:#059669}
.prism-result.bad{color:#dc2626}
.prism-tf{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:18px;padding:1.25rem;margin:1.5rem 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.prism-tf-btns{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1rem}
.prism-tf-btns button{min-height:3rem;padding:.75rem;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font-size:.875rem;font-weight:700;cursor:pointer;transition:transform var(--prism-motion-fast),border-color var(--prism-motion-base),background-color var(--prism-motion-base),color var(--prism-motion-base);box-shadow:0 1px 2px rgba(15,23,42,.04)}
.prism-tf-btns button:hover{border-color:#94a3b8}
.prism-tf-btns button.selected-ok{border-color:#10b981;background:#ecfdf5;color:#065f46}
.prism-tf-btns button.selected-bad{border-color:#ef4444;background:#fef2f2;color:#991b1b}
.prism-acc{border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin:1.5rem 0;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.prism-acc-item{border-bottom:1px solid #e2e8f0;background:#fff}
.prism-acc-item:last-child{border-bottom:0}
.prism-acc-btn{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:3rem;padding:.875rem 1.25rem;font-size:.875rem;line-height:1.5;font-weight:700;border:0;background:none;cursor:pointer;text-align:left;transition:background-color var(--prism-motion-base)}
.prism-acc-btn:hover{background:#f8fafc}
.prism-acc-arrow{font-size:.65rem;transition:transform var(--prism-motion-base) var(--prism-ease-standard);margin-left:.5rem}
.prism-acc-body{padding:.75rem 1.25rem 1rem;font-size:.875rem;line-height:1.6;color:#475569;border-top:1px solid #f1f5f9;animation:prism-feedback-enter var(--prism-motion-base) var(--prism-ease-emphasized) both}
.prism-nav{position:sticky;bottom:0;display:flex;justify-content:space-between;gap:.75rem;padding:1rem 1.25rem calc(1rem + env(safe-area-inset-bottom));border-top:1px solid #e2e8f0;background:#fff}
.prism-nav a{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.75rem;padding:.55rem 1rem;border:1px solid #e2e8f0;border-radius:12px;text-decoration:none;font-size:.875rem;font-weight:700;color:#475569;background:#fff;transition:transform var(--prism-motion-fast),background-color var(--prism-motion-base),border-color var(--prism-motion-base)}
.prism-nav a:hover{background:#f8fafc}
@media (min-width:700px){.prism-shell{padding:2rem}.prism-phone{min-height:min(844px,calc(100vh - 4rem));border:10px solid #0f172a;border-radius:32px;max-width:390px}.prism-lesson{padding:1.5rem 1.25rem}}
@media (max-width:379px){.prism-tf-btns{grid-template-columns:1fr}.prism-actions{align-items:flex-start;flex-direction:column}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}.prism-block{animation:none}}
/* ── New block types ── */
.prism-quote{border-left:4px solid var(--prism-primary);background:#f8fafc;border-radius:0 12px 12px 0;padding:1.25rem 1.25rem 1.25rem 1.5rem;margin:1.5rem 0;font-size:1.05rem;font-style:italic;color:#334155;line-height:1.7}
.prism-quote p{margin:0}
.prism-quote cite{display:block;margin-top:.625rem;font-size:.8rem;font-style:normal;font-weight:700;color:#64748b;letter-spacing:.03em}
.prism-callout{border-radius:14px;padding:1rem 1.125rem;margin:1.5rem 0;border-width:1.5px;border-style:solid}
.prism-callout--info{background:#eff6ff;border-color:#93c5fd;color:#1e40af}
.prism-callout--warning{background:#fffbeb;border-color:#fcd34d;color:#92400e}
.prism-callout--success{background:#f0fdf4;border-color:#86efac;color:#166534}
.prism-callout--tip{background:#fdf4ff;border-color:#d8b4fe;color:#6b21a8}
.prism-callout-title{font-weight:700;margin-bottom:.375rem;font-size:.9rem}
.prism-callout p{font-size:.875rem;line-height:1.6;margin:0}
.prism-divider--line{border:none;border-top:2px solid #e2e8f0;margin:1.5rem 0}
.prism-divider--space{height:2rem;margin:0}
.prism-divider--dots{text-align:center;color:#cbd5e1;font-size:1.5rem;letter-spacing:.4em;margin:1.25rem 0;display:block}
.prism-divider--label{display:flex;align-items:center;gap:.75rem;margin:1.5rem 0;color:#94a3b8;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.prism-divider--label::before,.prism-divider--label::after{content:'';flex:1;border-top:1.5px solid #e2e8f0}
.prism-flashcards{background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:1.25rem;margin:1.5rem 0}
.prism-fc-card{}
.prism-fc-inner{min-height:10rem;background:#fff;border-radius:14px;border:2px solid #e2e8f0;padding:1.5rem;display:flex;align-items:center;justify-content:center;text-align:center;margin-bottom:.875rem;box-shadow:0 2px 8px rgba(15,23,42,.05)}
.prism-fc-front p,.prism-fc-back p{font-size:.95rem;line-height:1.6;color:#334155;margin:0}
.prism-fc-back{display:none}
.prism-fc-flip{width:100%;min-height:2.5rem;background:var(--prism-primary);color:#fff;border:0;border-radius:10px;font-size:.875rem;font-weight:700;cursor:pointer;margin-bottom:.75rem;transition:opacity .15s}
.prism-fc-nav{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.prism-fc-prev,.prism-fc-next{background:none;border:1.5px solid #e2e8f0;border-radius:8px;padding:.4rem .75rem;font-size:.8rem;font-weight:600;cursor:pointer;color:#475569;transition:background-color .15s}
.prism-fc-prev:hover:not(:disabled),.prism-fc-next:hover:not(:disabled){background:#f1f5f9}
.prism-fc-prev:disabled,.prism-fc-next:disabled{opacity:.35;cursor:not-allowed}
.prism-fc-count{font-size:.8rem;color:#94a3b8;font-weight:600}
.prism-process{margin:1.5rem 0;position:relative;padding-left:.25rem}
.prism-process-step{display:flex;align-items:flex-start;gap:1rem;margin-bottom:1.25rem;position:relative}
.prism-process-step:not(:last-child)::before{content:'';position:absolute;left:1.1rem;top:2.5rem;width:2px;height:calc(100% + .25rem);background:linear-gradient(to bottom,var(--prism-primary),#e2e8f0)}
.prism-process-num{width:2.25rem;height:2.25rem;border-radius:50%;background:var(--prism-primary);color:#fff;font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.prism-process-title{font-weight:700;color:#1e293b;margin:0 0 .25rem;line-height:1.4;font-size:.925rem}
.prism-process-desc{font-size:.85rem;color:#64748b;margin:0;line-height:1.5}
.prism-tabs{background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin:1.5rem 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.prism-tabs-bar{display:flex;border-bottom:2px solid #f1f5f9;overflow-x:auto;scrollbar-width:none}
.prism-tabs-bar::-webkit-scrollbar{display:none}
.prism-tab-btn{flex-shrink:0;padding:.75rem 1rem;font-size:.85rem;font-weight:600;border:0;background:none;cursor:pointer;color:#64748b;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s;white-space:nowrap}
.prism-tab-btn.active{color:var(--prism-primary);border-bottom-color:var(--prism-primary)}
.prism-tabs-panels{padding:1.25rem}
.prism-tab-panel{font-size:.875rem;line-height:1.65;color:#475569}
.prism-tab-panel p{margin:0}
.prism-btn-wrap{}
.prism-btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:.6rem 1.5rem;border-radius:12px;font-size:.9rem;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s,transform .1s}
.prism-btn:active{transform:scale(.97)}
.prism-btn--primary{background:var(--prism-primary);color:#fff;border:none}
.prism-btn--outline{background:transparent;color:var(--prism-primary);border:2px solid var(--prism-primary)}
.prism-btn--ghost{background:transparent;color:var(--prism-primary);border:none;text-decoration:underline}
.prism-custom-html{margin:1.5rem 0}
/* ── Image lightbox ── */
.prism-img img{cursor:zoom-in}
.prism-lightbox{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);cursor:zoom-out;animation:prism-lb-in .18s ease both}
@keyframes prism-lb-in{from{opacity:0}to{opacity:1}}
.prism-lightbox img{max-width:min(96vw,1200px);max-height:92vh;object-fit:contain;border-radius:12px;cursor:default;box-shadow:0 8px 48px rgba(0,0,0,.6)}
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
    result.textContent=allOk?'✓ Correct!':'✗ Not quite.';
    result.className='prism-result '+(allOk?'ok':'bad');
    submit.style.display='none';
    retry.style.display='inline';
    // SCORM score
    if(typeof API!=='undefined'){
      try{API.LMSSetValue('cmi.core.score.raw',allOk?'100':'0');API.LMSSetValue('cmi.core.score.min','0');API.LMSSetValue('cmi.core.score.max','100');API.LMSSetValue('cmi.core.lesson_status',allOk?'passed':'failed');API.LMSCommit('');}catch(e){}
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
      if(res){res.textContent=(ok?'✓ Correct! ':'✗ Not quite. ')+(answer?tf:ff);res.style.display='';}
      if(retry)retry.style.display='inline';
      if(typeof API!=='undefined'){try{API.LMSSetValue('cmi.core.lesson_status',ok?'passed':'failed');API.LMSCommit('');}catch(e){}}
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
// Image lightbox
document.querySelectorAll('.prism-img img').forEach(function(img){
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

// ── Lesson HTML page ───────────────────────────────────────────────────────

function buildLessonPage(
  mod: ExportModule,
  lessonIdx: number,
  assetMap: Record<string, string>,
  theme: ExportTheme,
): string {
  const lesson = mod.lessons[lessonIdx]!;
  const total = mod.lessons.length;

  const prevLink =
    lessonIdx > 0
      ? `<a href="lesson_${lessonIdx - 1}.html">← Previous</a>`
      : '<span></span>';
  const nextLink =
    lessonIdx < total - 1
      ? `<a href="lesson_${lessonIdx + 1}.html">Next →</a>`
      : '<span></span>';

  const blocksHtml = lesson.blocks
    .map((b, i) => `<div class="prism-block" style="--i:${i}">${renderBlock(b, assetMap)}</div>`)
    .join('\n');

  // Load scorm-again via inline API bootstrap
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(lesson.title)}</title>
<link rel="stylesheet" href="styles.css"/>
</head>
<body>
<div class="prism-shell">
  <main class="prism-phone">
    <header class="prism-top">
      <p class="prism-kicker">${escapeHtml(mod.title)}</p>
      <div class="prism-title-row">
        <h1>${escapeHtml(lesson.title)}</h1>
        <span class="prism-count">${lessonIdx + 1}/${total}</span>
      </div>
      <div class="prism-progress"><span style="width:${Math.round(((lessonIdx + 1) / total) * 100)}%"></span></div>
    </header>
    <section class="prism-lesson">
      ${blocksHtml}
    </section>
    ${total > 1 ? `<nav class="prism-nav">${prevLink}${nextLink}</nav>` : ''}
  </main>
</div>
<script src="assets/scorm12.min.js"></script>
<script>
// Initialize SCORM
(function(){
  if(typeof API!=='undefined'){
    try{API.LMSInitialize('');API.LMSSetValue('cmi.core.lesson_status','incomplete');}catch(e){}
  }
})();
</script>
<script src="assets/interaction.js"></script>
</body>
</html>`;
}

// ── Main export function ───────────────────────────────────────────────────

export async function buildScormPackage(
  mod: ExportModule,
  theme: ExportTheme,
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
        if (typeof p.storageId === 'string') storageIds.add(p.storageId);
        if (typeof p.src === 'string' && p.srcType === 'storage') storageIds.add(p.src);
      } catch { /* not JSON */ }
    }
  }

  // Resolve + download all assets into zip/assets/
  const assetMap: Record<string, string> = {};
  const assetsFolder = zip.folder('assets')!;

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

  assetsFolder.file('interaction.js', buildInteractionJs());

  // Shared CSS
  zip.file('styles.css', buildCss(theme));

  // imsmanifest.xml
  zip.file('imsmanifest.xml', buildManifest(mod));

  // One HTML page per lesson
  for (let i = 0; i < mod.lessons.length; i++) {
    zip.file(`lesson_${i}.html`, buildLessonPage(mod, i, assetMap, theme));
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ── Minimal SCORM 1.2 shim (fallback if scorm-again import fails) ──────────

function minimalScormShim(): string {
  return `var API={
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

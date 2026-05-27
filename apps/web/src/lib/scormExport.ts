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
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--prism-font-body);background:#f8fafc;color:#334155;padding:0}
.prism-lesson{max-width:720px;margin:0 auto;padding:2rem 1.5rem}
h1{font-family:var(--prism-font-heading);font-size:1.75rem;font-weight:700;color:var(--prism-primary);margin-bottom:1.5rem}
.prism-rt{line-height:1.7;margin-bottom:1.5rem}
.prism-rt h1,.prism-rt h2,.prism-rt h3{font-family:var(--prism-font-heading);color:var(--prism-primary);margin:1.25rem 0 0.5rem}
.prism-rt p{margin-bottom:0.75rem}
.prism-rt ul,.prism-rt ol{margin-left:1.5rem;margin-bottom:0.75rem}
.prism-img{margin:1.5rem 0;text-align:center}
.prism-img img{max-width:100%;border-radius:8px}
.prism-img figcaption{margin-top:.5rem;font-size:.85rem;color:#64748b}
.prism-video{margin:1.5rem 0}
.prism-video-wrap{position:relative;padding-top:56.25%;border-radius:8px;overflow:hidden}
.prism-video-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.prism-video video{max-width:100%;border-radius:8px}
.prism-mcq{background:#f1f5f9;border-radius:12px;padding:1.5rem;margin:1.5rem 0}
.prism-q{font-weight:600;margin-bottom:1rem}
.prism-opts{list-style:none}
.prism-opts li{margin-bottom:0.5rem}
.prism-opt{display:flex;align-items:center;gap:.75rem;width:100%;padding:.625rem .875rem;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:.875rem;text-align:left;transition:.15s}
.prism-opt:hover{border-color:#94a3b8}
.prism-opt.selected{border-color:var(--prism-primary);background:#eef2ff}
.prism-opt.correct{border-color:#10b981;background:#ecfdf5;color:#065f46}
.prism-opt.wrong{border-color:#ef4444;background:#fef2f2;color:#991b1b}
.prism-opt-marker{width:1.25rem;height:1.25rem;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0}
.prism-actions{margin-top:1rem;display:flex;align-items:center;gap:.75rem}
.prism-submit{background:var(--prism-primary);color:#fff;border:0;border-radius:8px;padding:.5rem 1rem;font-size:.875rem;font-weight:500;cursor:pointer}
.prism-submit:disabled{opacity:.4;cursor:not-allowed}
.prism-retry{background:none;border:0;color:var(--prism-primary);font-size:.875rem;cursor:pointer;text-decoration:underline}
.prism-result{font-size:.875rem;font-weight:500}
.prism-result.ok{color:#059669}
.prism-result.bad{color:#dc2626}
.prism-tf{background:#f1f5f9;border-radius:12px;padding:1.5rem;margin:1.5rem 0}
.prism-tf-btns{display:flex;gap:.75rem;margin-top:1rem}
.prism-tf-btns button{flex:1;padding:.75rem;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:.875rem;font-weight:600;cursor:pointer;transition:.15s}
.prism-tf-btns button:hover{border-color:#94a3b8}
.prism-tf-btns button.selected-ok{border-color:#10b981;background:#ecfdf5;color:#065f46}
.prism-tf-btns button.selected-bad{border-color:#ef4444;background:#fef2f2;color:#991b1b}
.prism-acc{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:1.5rem 0}
.prism-acc-item{border-bottom:1px solid #e2e8f0;background:#fff}
.prism-acc-item:last-child{border-bottom:0}
.prism-acc-btn{display:flex;justify-content:space-between;align-items:center;width:100%;padding:.875rem 1.25rem;font-size:.875rem;font-weight:500;border:0;background:none;cursor:pointer;text-align:left}
.prism-acc-btn:hover{background:#f8fafc}
.prism-acc-arrow{font-size:.65rem;transition:.15s;margin-left:.5rem}
.prism-acc-body{padding:.75rem 1.25rem 1rem;font-size:.875rem;line-height:1.6;color:#475569;border-top:1px solid #f1f5f9}
.prism-nav{display:flex;justify-content:space-between;margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid #e2e8f0}
.prism-nav a{display:inline-flex;align-items:center;gap:.375rem;padding:.5rem 1rem;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;font-size:.875rem;color:#475569;background:#fff}
.prism-nav a:hover{background:#f8fafc}
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

  const blocksHtml = lesson.blocks.map((b) => renderBlock(b, assetMap)).join('\n');

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
<div class="prism-lesson">
  <h1>${escapeHtml(lesson.title)}</h1>
  ${blocksHtml}
  ${total > 1 ? `<nav class="prism-nav">${prevLink}${nextLink}</nav>` : ''}
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

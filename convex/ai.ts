import { v } from 'convex/values';
import { action, internalMutation, internalQuery } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal } from './_generated/api';
import JSZip from 'jszip';

type SourceFile = {
  storageId: string;
  name: string;
  type: string;
  size: number;
};

type SourceAsset = {
  storageId: string;
  type: 'image' | 'video';
  mimeType: string;
  name: string;
};

type ExtractedSource = {
  text: string;
  assets: SourceAsset[];
  note?: string;
};

type VisualBrief = {
  title?: string;
  altText?: string;
  caption?: string;
  description?: string;
};

// ── Internal helpers ───────────────────────────────────────────────────────

/** Verify workspace membership from within an action. */
export const checkMembership = internalQuery({
  args: { workspaceId: v.id('workspaces'), userId: v.id('users') },
  handler: async (ctx, { workspaceId, userId }) => {
    return await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
  },
});

/** Scaffold the full module structure from AI-generated data. */
export const createModuleFromAI = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    title: v.string(),
    lessons: v.array(
      v.object({
        title: v.string(),
        blocks: v.array(
          v.object({
            type: v.string(),
            content: v.string(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { workspaceId, userId, title, lessons }) => {
    const now = Date.now();

    const moduleId = await ctx.db.insert('modules', {
      workspaceId,
      title: title.trim() || 'AI-Generated Module',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastEditedBy: userId,
    });

    const validTypes = new Set([
      'richText', 'image', 'video', 'lottie', 'mcq', 'trueFalse', 'accordion',
    ] as const);
    type BlockType = 'richText' | 'image' | 'video' | 'lottie' | 'mcq' | 'trueFalse' | 'accordion';

    for (let li = 0; li < lessons.length; li++) {
      const lesson = lessons[li]!;
      const lessonId = await ctx.db.insert('lessons', {
        moduleId,
        title: lesson.title.trim() || `Lesson ${li + 1}`,
        order: (li + 1) * 1000,
        createdAt: now,
      });

      for (let bi = 0; bi < lesson.blocks.length; bi++) {
        const block = lesson.blocks[bi]!;
        if (!validTypes.has(block.type as BlockType)) continue;

        await ctx.db.insert('blocks', {
          lessonId,
          moduleId,
          type: block.type as BlockType,
          order: (bi + 1) * 1000,
          content: block.content,
          updatedAt: now,
          lastEditedBy: userId,
        });
      }
    }

    return moduleId;
  },
});

// ── Prompt builders ────────────────────────────────────────────────────────

function buildSystemPrompt(type: 'microLearning' | 'course'): string {
  const isMicro = type === 'microLearning';
  const lessonRange = isMicro ? '1 to 3' : '3 to 7';
  const blockRange = isMicro ? '5 to 8' : '6 to 10';

  return `You are an expert instructional designer. Generate a complete e-learning module as a single JSON object — no markdown, no prose, only valid JSON.

Output schema:
{
  "lessons": [
    {
      "title": "string",
      "visual": {
        "title": "short visual title",
        "altText": "specific accessible alt text",
        "caption": "short caption",
        "description": "specific image brief for a clean premium instructional illustration"
      },
      "blocks": [
        { "type": "richText",  "content": "HTML string" },
        { "type": "mcq",       "content": "JSON-encoded string" },
        { "type": "trueFalse", "content": "JSON-encoded string" },
        { "type": "accordion", "content": "JSON-encoded string" }
      ]
    }
  ]
}

Rules:
- Create ${lessonRange} lessons for a ${isMicro ? 'micro-learning (5–10 min)' : 'full course (20–40 min)'} module.
- Each lesson has ${blockRange} blocks.
- Each lesson MUST include a visual brief. The app will turn visual briefs into generated course images, so make each brief concrete, instructional, and tied to the lesson concept.
- Visual briefs should describe simple premium editorial illustrations, diagrams, step cards, or process visuals. Do not request photoreal people, logos, copyrighted characters, or dense text inside the image.
- Design for a premium mobile phone learning experience: short screens, tight pacing, clear progression, and no dense textbook sections.
- richText blocks must be phone-sized chunks: 1 to 3 short paragraphs, or a heading plus 3 to 5 concise bullets. Avoid long paragraphs.
- Each lesson should include a setup, one generated visual, one concrete example or scenario, one interaction, one reveal/accordion where helpful, and a short takeaway.
- Quiz questions should check the learning objective with realistic scenarios, not trivia.
- Use accordion blocks for misconceptions, optional details, or step-by-step reveals.
- richText content: well-formed HTML using only <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>. No <script>, no inline styles.
- mcq content: a JSON-encoded string: {"question":"...","options":[{"id":"1","text":"...","isCorrect":true,"feedback":"..."},{"id":"2","text":"...","isCorrect":false,"feedback":"..."},{"id":"3","text":"...","isCorrect":false,"feedback":"..."}],"multiSelect":false,"showFeedback":true}. Exactly one option must have isCorrect:true.
- trueFalse content: a JSON-encoded string: {"statement":"...","correctAnswer":true,"trueFeedback":"...","falseFeedback":"..."}.
- accordion content: a JSON-encoded string: {"sections":[{"title":"...","content":"..."},{"title":"...","content":"..."}]} with 2 to 4 sections.
- Each lesson must start with a richText block, then include at least one interactive block (mcq or trueFalse).
- Block content strings must be properly escaped so the outer object is valid JSON (double-encode inner JSON strings).
- Keep all content educational, accurate, and engaging.`;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 18000);
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function wrapSvgLines(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function buildGeneratedVisualSvg(moduleName: string, lessonTitle: string, visual: VisualBrief): string {
  const palettes = [
    ['#4f46e5', '#10b981', '#f8fafc'],
    ['#0f766e', '#f59e0b', '#f8fafc'],
    ['#2563eb', '#ec4899', '#f8fafc'],
    ['#7c3aed', '#14b8a6', '#f8fafc'],
    ['#dc2626', '#2563eb', '#fff7ed'],
  ];
  const palette = palettes[hashString(`${moduleName}:${lessonTitle}`) % palettes.length]!;
  const [primary, accent, background] = palette;
  const title = visual.title || lessonTitle;
  const caption = visual.caption || visual.description || `Visual summary for ${lessonTitle}`;
  const titleLines = wrapSvgLines(title, 24, 2);
  const captionLines = wrapSvgLines(caption, 44, 3);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
  <title id="title">${escapeSvg(visual.altText || title)}</title>
  <desc id="desc">${escapeSvg(visual.description || caption)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1200" height="675" rx="44" fill="url(#bg)"/>
  <circle cx="1040" cy="130" r="150" fill="${accent}" opacity="0.16"/>
  <circle cx="145" cy="565" r="170" fill="${primary}" opacity="0.13"/>
  <g filter="url(#shadow)">
    <rect x="96" y="82" width="1008" height="511" rx="38" fill="#fff"/>
  </g>
  <rect x="144" y="134" width="276" height="356" rx="30" fill="url(#card)"/>
  <path d="M196 390c60-92 104-138 156-138 52 0 82 56 122 138" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" opacity="0.86"/>
  <circle cx="260" cy="218" r="46" fill="#fff" opacity="0.9"/>
  <rect x="506" y="164" width="440" height="20" rx="10" fill="${primary}" opacity="0.18"/>
  <rect x="506" y="218" width="520" height="24" rx="12" fill="${primary}" opacity="0.9"/>
  <rect x="506" y="268" width="422" height="18" rx="9" fill="#94a3b8" opacity="0.45"/>
  <rect x="506" y="309" width="485" height="18" rx="9" fill="#94a3b8" opacity="0.36"/>
  <g transform="translate(506 374)">
    <rect width="122" height="86" rx="18" fill="${primary}" opacity="0.12"/>
    <rect x="158" width="122" height="86" rx="18" fill="${accent}" opacity="0.16"/>
    <rect x="316" width="122" height="86" rx="18" fill="${primary}" opacity="0.12"/>
    <path d="M52 43h18m-9-9v18" stroke="${primary}" stroke-width="8" stroke-linecap="round"/>
    <path d="M205 43l20 20 35-42" stroke="${accent}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="377" cy="43" r="22" fill="none" stroke="${primary}" stroke-width="8"/>
  </g>
  <text x="144" y="548" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#334155">${escapeSvg(moduleName.slice(0, 64))}</text>
  <text x="506" y="126" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" letter-spacing="3" fill="${primary}">LESSON VISUAL</text>
  ${titleLines.map((line, index) => `<text x="506" y="${222 + index * 46}" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="800" fill="#0f172a">${escapeSvg(line)}</text>`).join('')}
  ${captionLines.map((line, index) => `<text x="506" y="${520 + index * 30}" font-family="Inter, Arial, sans-serif" font-size="22" fill="#64748b">${escapeSvg(line)}</text>`).join('')}
</svg>`;
}

async function generatedVisualBlock(ctx: ActionCtx, moduleName: string, lessonTitle: string, visual?: VisualBrief): Promise<{ type: string; content: string }> {
  const fallback: VisualBrief = {
    title: lessonTitle,
    altText: `Instructional illustration for ${lessonTitle}`,
    caption: `Visual overview: ${lessonTitle}`,
    description: `A clean instructional visual summarizing ${lessonTitle}.`,
  };
  const finalVisual = visual ?? fallback;
  const svg = buildGeneratedVisualSvg(moduleName, lessonTitle, finalVisual);
  const storageId = await ctx.storage.store(new Blob([svg], { type: 'image/svg+xml' }));
  return {
    type: 'image',
    content: JSON.stringify({
      storageId,
      altText: finalVisual.altText || `Instructional illustration for ${lessonTitle}`,
      caption: finalVisual.caption || finalVisual.title || lessonTitle,
    }),
  };
}

function extractTextFromPlainBytes(bytes: ArrayBuffer): string {
  return cleanExtractedText(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
}

function extractTextFromPdfBytes(bytes: ArrayBuffer): string {
  const raw = new TextDecoder('latin1', { fatal: false }).decode(bytes);
  const chunks: string[] = [];
  const textObjectRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  const arrayTextRegex = /\[((?:\s*\([^()\\]*(?:\\.[^()\\]*)*\)\s*)+)\]\s*TJ/g;

  for (const match of raw.matchAll(textObjectRegex)) {
    if (match[1]) chunks.push(match[1].replace(/\\([()\\])/g, '$1'));
  }
  for (const match of raw.matchAll(arrayTextRegex)) {
    const arrayText = match[1] ?? '';
    for (const part of arrayText.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)) {
      if (part[1]) chunks.push(part[1].replace(/\\([()\\])/g, '$1'));
    }
  }

  return cleanExtractedText(chunks.join(' '));
}

function mimeFromDocxMediaName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return null;
}

async function extractDocxSource(ctx: ActionCtx, bytes: ArrayBuffer): Promise<ExtractedSource> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const text = documentXml
    ? cleanExtractedText(
        decodeXmlEntities(
          documentXml
            .replace(/<w:tab\/>/g, ' ')
            .replace(/<w:br\/>/g, '\n')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, ''),
        ),
      )
    : '';

  const assets: SourceAsset[] = [];
  const mediaFiles = Object.values(zip.files)
    .filter((file) => !file.dir && file.name.startsWith('word/media/'))
    .slice(0, 6);

  for (const mediaFile of mediaFiles) {
    const mimeType = mimeFromDocxMediaName(mediaFile.name);
    if (!mimeType) continue;
    const mediaBytes = await mediaFile.async('arraybuffer');
    const blob = new Blob([mediaBytes], { type: mimeType });
    const storageId = await ctx.storage.store(blob);
    assets.push({
      storageId,
      type: mimeType.startsWith('video/') ? 'video' : 'image',
      mimeType,
      name: mediaFile.name.split('/').pop() ?? 'embedded-media',
    });
  }

  return { text, assets };
}

async function extractSourceFile(ctx: ActionCtx, sourceFile?: SourceFile): Promise<ExtractedSource | null> {
  if (!sourceFile) return null;
  const blob = await ctx.storage.get(sourceFile.storageId as Id<'_storage'>);
  if (!blob) throw new Error('Uploaded source file is unavailable. Please upload it again.');

  const bytes = await blob.arrayBuffer();
  const mimeType = sourceFile.type.toLowerCase();
  const name = sourceFile.name.toLowerCase();

  if (mimeType.startsWith('image/')) {
    return {
      text: '',
      assets: [{ storageId: sourceFile.storageId, type: 'image', mimeType: sourceFile.type, name: sourceFile.name }],
      note: 'The uploaded image was attached as a visual asset. Add descriptive context in the objective if the image content is important.',
    };
  }
  if (mimeType.startsWith('video/')) {
    return {
      text: '',
      assets: [{ storageId: sourceFile.storageId, type: 'video', mimeType: sourceFile.type, name: sourceFile.name }],
      note: 'The uploaded video was attached as a media asset. Add descriptive context in the objective if the video content is important.',
    };
  }
  if (mimeType.includes('wordprocessingml') || name.endsWith('.docx')) {
    return await extractDocxSource(ctx, bytes);
  }
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    const text = extractTextFromPdfBytes(bytes);
    return {
      text,
      assets: [],
      note: text
        ? 'PDF text was extracted best-effort. Embedded PDF media is not extracted in this version.'
        : 'PDF text could not be extracted. Scanned/image-only PDFs need OCR support in a later pass.',
    };
  }
  if (
    mimeType.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.json')
  ) {
    return { text: extractTextFromPlainBytes(bytes), assets: [] };
  }

  throw new Error('Unsupported source file. Upload PDF, DOCX, TXT, Markdown, image, or video.');
}

function sourceAssetBlocks(assets: SourceAsset[]): Array<{ type: string; content: string }> {
  return assets.slice(0, 4).map((asset) => {
    if (asset.type === 'video') {
      return {
        type: 'video',
        content: JSON.stringify({ srcType: 'storage', src: asset.storageId, caption: `Source video: ${asset.name}` }),
      };
    }
    return {
      type: 'image',
      content: JSON.stringify({ storageId: asset.storageId, altText: `Source image from ${asset.name}`, caption: `Source image: ${asset.name}` }),
    };
  });
}

// ── Public action ──────────────────────────────────────────────────────────

/**
 * Generate a full learning module using an open-weight model hosted by Groq.
 * Requires GROQ_API_KEY environment variable set in the Convex dashboard.
 * Optionally override the model with GROQ_MODEL (default: llama-3.3-70b-versatile).
 */
export const generateModule = action({
  args: {
    workspaceId: v.id('workspaces'),
    name: v.string(),
    objective: v.string(),
    type: v.union(v.literal('microLearning'), v.literal('course')),
    description: v.string(),
    sourceFile: v.optional(v.object({
      storageId: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    })),
    sourceText: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, name, objective, type, description, sourceFile, sourceText }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    // Verify workspace membership
    const membership = await ctx.runQuery(internal.ai.checkMembership, {
      workspaceId,
      userId,
    });
    if (!membership) throw new Error('Forbidden');

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('AI not configured — set GROQ_API_KEY in the Convex dashboard');

    const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const source = await extractSourceFile(ctx, sourceFile);
    const mergedSourceText = cleanExtractedText(`${sourceText ?? ''}\n\n${source?.text ?? ''}`);
    const sourceTextBlock = mergedSourceText ? `\n\nSource document excerpts:\n${mergedSourceText}` : '';
    const sourceNote = source?.note ? `\n\nSource handling note: ${source.note}` : '';

    const systemPrompt = buildSystemPrompt(type);
    const userPrompt = `Create a ${type === 'microLearning' ? 'micro-learning' : 'full course'} module with these details:

Module name: ${name}
Learning objective: ${objective}
Description: ${description || 'Use the uploaded source file as the primary source material.'}${sourceTextBlock}${sourceNote}

Output only the JSON structure. Begin now.`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`AI error: ${data.error.message}`);

    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('AI returned an empty response');

    // Parse generated structure
    let generated: {
      lessons: Array<{
        title: string;
        visual?: VisualBrief;
        blocks: Array<{ type: string; content: string }>;
      }>;
    };

    try {
      generated = JSON.parse(rawText) as typeof generated;
    } catch {
      throw new Error('AI returned malformed JSON — please try again');
    }

    if (!Array.isArray(generated?.lessons) || generated.lessons.length === 0) {
      throw new Error('AI returned no lessons — please try again');
    }

    // Sanitise and cap lengths to avoid schema violations
    const lessons = await Promise.all(generated.lessons.slice(0, 10).map(async (l) => {
      const title = String(l?.title ?? 'Lesson').slice(0, 200);
      const blocks = (Array.isArray(l?.blocks) ? l.blocks : []).slice(0, 24).map((b) => ({
        type: String(b?.type ?? 'richText'),
        content: String(b?.content ?? ''),
      }));
      const visualBlock = await generatedVisualBlock(ctx, name.trim() || 'AI-Generated Module', title, l?.visual);
      const insertAt = Math.min(1, blocks.length);
      blocks.splice(insertAt, 0, visualBlock);
      return {
        title,
        blocks,
      };
    }));

    const assetBlocks = sourceAssetBlocks(source?.assets ?? []);
    if (assetBlocks.length > 0) {
      lessons[0]?.blocks.splice(1, 0, ...assetBlocks);
    }

    const moduleId = await ctx.runMutation(internal.ai.createModuleFromAI, {
      workspaceId,
      userId,
      title: name.trim().slice(0, 200) || 'AI-Generated Module',
      lessons,
    });

    return moduleId as string;
  },
});

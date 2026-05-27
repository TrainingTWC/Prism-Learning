import { v } from 'convex/values';
import { action, internalMutation, internalQuery } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal } from './_generated/api';

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
  const blockRange = isMicro ? '2 to 4' : '4 to 8';

  return `You are an expert instructional designer. Generate a complete e-learning module as a single JSON object — no markdown, no prose, only valid JSON.

Output schema:
{
  "lessons": [
    {
      "title": "string",
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
- richText content: well-formed HTML using only <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>. No <script>, no inline styles.
- mcq content: a JSON-encoded string: {"question":"...","options":[{"id":"1","text":"...","isCorrect":true,"feedback":"..."},{"id":"2","text":"...","isCorrect":false,"feedback":"..."},{"id":"3","text":"...","isCorrect":false,"feedback":"..."}],"multiSelect":false,"showFeedback":true}. Exactly one option must have isCorrect:true.
- trueFalse content: a JSON-encoded string: {"statement":"...","correctAnswer":true,"trueFeedback":"...","falseFeedback":"..."}.
- accordion content: a JSON-encoded string: {"sections":[{"title":"...","content":"..."},{"title":"...","content":"..."}]} with 2 to 4 sections.
- Each lesson must start with a richText block, then include at least one interactive block (mcq or trueFalse).
- Block content strings must be properly escaped so the outer object is valid JSON (double-encode inner JSON strings).
- Keep all content educational, accurate, and engaging.`;
}

// ── Public action ──────────────────────────────────────────────────────────

/**
 * Generate a full learning module using Gemma 4 via Google AI Studio.
 * Requires GEMINI_API_KEY environment variable set in the Convex dashboard.
 * Optionally override the model with GEMINI_MODEL (default: gemma-4-9b-it).
 */
export const generateModule = action({
  args: {
    workspaceId: v.id('workspaces'),
    name: v.string(),
    objective: v.string(),
    type: v.union(v.literal('microLearning'), v.literal('course')),
    description: v.string(),
  },
  handler: async (ctx, { workspaceId, name, objective, type, description }): Promise<string> => {
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

    const systemPrompt = buildSystemPrompt(type);
    const userPrompt = `Create a ${type === 'microLearning' ? 'micro-learning' : 'full course'} module with these details:

Module name: ${name}
Learning objective: ${objective}
Description: ${description}

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
    const lessons = generated.lessons.slice(0, 10).map((l) => ({
      title: String(l?.title ?? 'Lesson').slice(0, 200),
      blocks: (Array.isArray(l?.blocks) ? l.blocks : []).slice(0, 20).map((b) => ({
        type: String(b?.type ?? 'richText'),
        content: String(b?.content ?? ''),
      })),
    }));

    const moduleId = await ctx.runMutation(internal.ai.createModuleFromAI, {
      workspaceId,
      userId,
      title: name.trim().slice(0, 200) || 'AI-Generated Module',
      lessons,
    });

    return moduleId as string;
  },
});

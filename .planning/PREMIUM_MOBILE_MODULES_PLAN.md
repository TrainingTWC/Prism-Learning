# Premium Mobile Modules Plan

## Purpose

Prism modules should feel like polished, phone-first learning experiences, not static web pages. The target quality bar is Articulate 360/Rise-level polish or better: clean instructional pacing, premium motion, strong mobile ergonomics, accessible interactions, and SCORM output that looks like the preview.

This plan covers the learner-facing module output only: preview, renderer, AI-generated module structure, and SCORM export. The authoring/editor UI remains desktop-focused unless explicitly changed later.

## Current Baseline

The current implementation already has the important architectural split:

- `packages/renderer/src/Module.tsx` renders the shared learner block tree.
- `apps/web/src/pages/PreviewPage.tsx` renders the learner preview from Convex content.
- `apps/web/src/lib/scormExport.ts` builds standalone HTML/CSS/JS for exported SCORM packages.
- Interactive blocks exist for rich text, image, video, Lottie, MCQ, true/false, and accordion.
- AI generation creates lessons and blocks from a focused form.

Current gaps:

- Preview is responsive, but not phone-framed or explicitly mobile-first.
- Motion is minimal and inconsistent across blocks.
- Preview and SCORM output use different rendering systems, so parity must be deliberately maintained.
- Lesson flow has no premium progress shell, lesson transition, summary screen, or completion moment.
- AI output is structurally valid, but does not yet target mobile pacing, chunking, or interaction density.

## Product Outcome

When an author generates or previews a module, the result should feel like a finished mobile learning product:

1. A learner can complete the module comfortably on a 360px wide phone viewport.
2. Every lesson has clear pacing: title, short explanation, interaction, feedback, and next step.
3. Blocks animate into view smoothly without distracting from learning.
4. Lesson navigation feels app-like: progress, previous/next controls, transitions, and final completion state.
5. The preview presents a realistic phone learner experience by default.
6. Exported SCORM output preserves the same content structure, theme, motion language, and mobile layout.
7. Motion respects `prefers-reduced-motion` and never blocks keyboard or screen-reader access.

## Premium Output Expectations

### Mobile-First Layout

Learner output must be designed from the phone viewport up.

Required behavior:

- Primary design viewport: 390 x 844.
- Minimum supported viewport: 360px wide.
- No horizontal scrolling at 360px.
- Content width capped for readability on desktop, but the design should still visually read as a mobile course rather than a stretched article.
- Touch targets at least 44 x 44px for navigation and interactive controls.
- Sticky bottom navigation on mobile with safe-area padding.
- Lesson progress visible without opening a menu.
- Preview defaults to a centered phone frame on desktop.
- Preview offers viewport toggles: phone, tablet, desktop.
- Desktop preview can show the phone frame first, because the authored course is phone-focused.

### Course Shell

The learner shell should feel like a course app.

Required elements:

- Top course header with module title, lesson title, and progress indicator.
- Lesson progress indicator, either segmented or percentage-based.
- Mobile bottom navigation with Previous and Continue.
- Disabled next state until required interaction is complete, when a lesson contains a required quiz.
- Final summary screen with completion state, quiz score, and restart/review actions.
- Smooth lesson transition when moving between lessons.
- Lesson sidebar should not be the default mobile navigation model.

### Motion Language

Motion should feel calm, confident, and instructional. It should guide attention rather than decorate.

Motion principles:

- Use subtle transforms, opacity, and height transitions.
- Avoid large bounces, spinning decorative objects, or excessive parallax.
- Prefer consistent durations and easing.
- Keep transitions short enough that repeated learning does not feel slow.
- Animate feedback more strongly than passive content because feedback is a learner event.
- Support `prefers-reduced-motion: reduce` across preview and export.

Motion tokens:

- `--prism-motion-fast`: 120ms
- `--prism-motion-base`: 220ms
- `--prism-motion-slow`: 360ms
- `--prism-ease-standard`: cubic-bezier(.2, 0, 0, 1)
- `--prism-ease-emphasized`: cubic-bezier(.2, .8, .2, 1)
- `--prism-stagger-step`: 55ms

Required animation types:

- Lesson enter: fade + 12px upward slide, 260ms.
- Lesson exit: fade + 8px downward slide, 160ms.
- Block reveal: staggered fade + 10px upward slide.
- Button press: 98 percent scale for 90ms.
- Quiz selection: border/color transition + subtle marker scale.
- Correct answer: check marker scale-in and feedback slide/fade.
- Incorrect answer: no shaking by default; use color and feedback motion.
- Accordion open: height/opacity transition, arrow rotation.
- Image/media load: placeholder shimmer or soft fade-in.
- Final completion: contained celebratory moment, such as progress ring complete and check icon scale-in.

### Block-Level Expectations

#### Rich Text

- Paragraphs are short enough for phone reading.
- Headings use mobile-appropriate scale, not desktop hero sizing.
- Lists have comfortable spacing and do not wrap awkwardly.
- Callouts render as premium instructional cards with an icon or accent rail.
- First rich-text block in a lesson should introduce the learning target in 2-4 short paragraphs or bullets.

#### Image

- Images fill available width with stable aspect ratio.
- Captions are readable but visually secondary.
- Loading state does not cause layout jump.
- Images fade in after load.

#### Video

- Video embeds preserve 16:9 and never overflow the phone frame.
- Caption remains visible below.
- Video blocks should not autoplay.

#### Lottie

- Lottie is used as instructional reinforcement, not random decoration.
- Natural aspect ratio is preserved.
- Loading fallback has fixed height.
- Motion respects reduced-motion settings where technically possible.

#### MCQ

- Question appears as a focused card.
- Options are full-width touch controls.
- Selected state is immediate and obvious.
- Submit button remains near the options on mobile.
- Correct and incorrect feedback appears inline with a smooth reveal.
- Retry is available after feedback.
- The block reports completion and score state to the course shell.

#### True/False

- True and False controls are large side-by-side buttons on wider phones, stacked if needed at 360px.
- Feedback reveals below the selected answer.
- The block reports completion and score state to the course shell.

#### Accordion

- Headers are full-width buttons.
- Body expands with a smooth height transition.
- Multiple items may remain open.
- Content inside bodies should be concise on phone.

## AI-Generated Module Expectations

The Build with AI feature must generate content that is already optimized for mobile learner output.

### Form Input Contract

The existing four-field form remains correct:

- Module name
- Learning objective
- Type: micro-learning or course
- Description, max 1000 characters

No extra fields should be added until the core output quality is consistently good.

### Generated Structure Rules

For `microLearning`:

- 1-3 lessons.
- Each lesson should take 2-4 minutes.
- Each lesson should contain 3-6 blocks.
- Total quiz interactions: 1-3.

For `course`:

- 3-7 lessons.
- Each lesson should take 4-7 minutes.
- Each lesson should contain 4-8 blocks.
- Total quiz interactions: 3-8.

All AI-generated lessons must follow this pattern:

1. Short lesson title, action-oriented when possible.
2. Rich-text learning setup with mobile-sized chunks.
3. One explanatory or scenario block.
4. At least one interaction in most lessons.
5. Feedback that teaches, not just says correct/incorrect.
6. A short closing takeaway.

### AI Prompt Updates Needed

Update `convex/ai.ts` so the system prompt includes:

- Mobile-first output requirement.
- Short paragraphs: 1-3 sentences each.
- Avoid giant rich-text blocks.
- Prefer plain, concrete examples.
- Use interactions to check the objective, not trivia.
- Include scenario-based MCQs when the objective is behavioral.
- Use `accordion` blocks for optional detail or misconceptions.
- Do not generate unsupported block types.
- Keep every lesson coherent as a phone screen sequence.

### Quality Gates For Generated Content

Before writing generated content to Convex, validate:

- Lesson count matches the selected module type.
- Each lesson has at least one richText block.
- At least 70 percent of lessons include an interactive block.
- No single richText block exceeds a reasonable mobile chunk length.
- MCQs have 2-6 options and at least one correct answer.
- True/false blocks have feedback for both outcomes.
- Accordion sections have non-empty titles and bodies.

If the model response fails these gates, the action should either repair it deterministically or ask the model once for a corrected JSON response.

## Implementation Plan

### Wave 1: Motion Foundation

Goal: establish reusable motion primitives that work in React preview and static SCORM export.

Tasks:

- Add shared CSS motion tokens to the renderer layer.
- Add base classes for `prism-lesson-enter`, `prism-block-reveal`, `prism-pressable`, `prism-feedback-enter`, and `prism-media-loaded`.
- Add reduced-motion CSS override.
- Prefer CSS animation classes over a React-only animation library so SCORM export can match preview.
- Add a tiny React helper only if needed for stagger indexes or lesson transition state.

Acceptance criteria:

- Reduced-motion users see no unnecessary movement.
- Block reveal can be used by every renderer block.
- SCORM CSS contains equivalent motion tokens/classes.
- Typecheck passes.

### Wave 2: Premium Mobile Preview Shell

Goal: make preview feel like the actual learner phone experience.

Tasks:

- Refactor `PreviewPage.tsx` around a learner shell instead of a desktop content page.
- Default desktop preview to a phone frame with a 390px content viewport.
- Add viewport controls for phone/tablet/desktop.
- Replace the desktop lesson sidebar as the primary navigation with mobile-first course navigation.
- Add top course progress and bottom navigation.
- Add lesson transition state when moving previous/next.
- Add final summary screen after the last lesson.

Acceptance criteria:

- At 390px, preview looks native to a phone-sized learning experience.
- At desktop widths, the phone preview is centered and readable.
- Navigation is keyboard-operable.
- No horizontal scroll at 360px.
- Visual state is stable while assets resolve.

### Wave 3: Renderer Block Animation Polish

Goal: upgrade each block to a premium, animated, touch-friendly learner component.

Tasks:

- Wrap blocks in a consistent reveal container in `Module.tsx`.
- Add stagger index support while keeping renderer props simple.
- Upgrade MCQ option transitions, feedback reveal, and marker animation.
- Upgrade true/false button layout and feedback reveal.
- Upgrade accordion body transition from conditional instant render to animated open/close.
- Add fixed media loading states and image fade-in.
- Review typography and spacing for 360px phone output.

Acceptance criteria:

- Every block has a consistent first-render reveal.
- Interactive blocks have immediate visual response.
- Feedback feels deliberate and premium.
- Accordions animate without content jump.
- No block requires pointer-only interaction.

### Wave 4: SCORM Output Parity

Goal: exported packages match the premium preview as closely as possible.

Tasks:

- Update `buildCss()` in `scormExport.ts` with the same motion tokens and mobile shell styles.
- Update lesson HTML template to include course shell, progress, and mobile navigation.
- Update interaction JS to apply the same selected/correct/incorrect/feedback animation classes.
- Add final summary behavior if feasible within the current static HTML export model.
- Preserve SCORM status/score reporting while adding animations.

Acceptance criteria:

- Exported module has the same mobile-first layout as preview.
- Exported quiz/accordion interactions animate like preview.
- SCORM package remains self-contained.
- SCORM interaction JS remains small and readable.
- Export still works without external network calls except LMS SCORM API calls.

### Wave 5: AI Generation Quality Upgrade

Goal: make AI-generated modules feel designed for the new learner shell.

Tasks:

- Update `buildSystemPrompt()` in `convex/ai.ts` with mobile-first lesson pacing rules.
- Add deterministic response validation and normalization helpers.
- Add one repair retry for malformed or low-quality structure.
- Improve error messages so authors know whether the issue is model response, rate limit, or configuration.

Acceptance criteria:

- Generated modules follow micro-learning/course sizing rules.
- Generated rich text is chunked for phone reading.
- Generated lessons contain meaningful interactions.
- Invalid AI output does not create half-broken modules.

### Wave 6: Verification And Polish

Goal: prove the experience meets the premium bar.

Tasks:

- Run typecheck and build.
- Use Playwright screenshots at 360, 390, 768, and desktop phone-frame preview.
- Test reduced-motion mode.
- Test keyboard interaction for next/previous, MCQ, true/false, and accordion.
- Export a sample module and inspect the HTML package for layout and animation parity.
- Validate no horizontal scrolling at 360px.

Acceptance criteria:

- Preview screenshots show a premium mobile learning product.
- Export screenshots visually match preview within expected SCORM constraints.
- No interaction blocks regress.
- No accessibility-critical regressions.

## Recommended Technical Approach

Use CSS-first motion rather than adding Framer Motion as a dependency.

Reasoning:

- The renderer must stay portable and mostly pure.
- SCORM export is static HTML/CSS/JS, not the React app.
- CSS tokens/classes can be shared conceptually between React preview and export CSS.
- A React-only animation library would make preview nice but export inconsistent.

Use React state only for:

- Lesson transition direction.
- Completion/summary screen state.
- Per-block interaction state that already exists.
- Optional viewport toggle in preview.

Avoid:

- Scroll-jacking.
- Heavy animation timelines.
- Decorative motion that does not support learning.
- A custom animation editor.
- Per-block custom animation settings in v1.

## Files Expected To Change During Implementation

Primary:

- `apps/web/src/pages/PreviewPage.tsx`
- `packages/renderer/src/Module.tsx`
- `packages/renderer/src/RichTextBlock.tsx`
- `packages/renderer/src/ImageBlockRenderer.tsx`
- `packages/renderer/src/VideoBlockRenderer.tsx`
- `packages/renderer/src/LottieBlockRenderer.tsx`
- `packages/renderer/src/MCQBlockRenderer.tsx`
- `packages/renderer/src/TrueFalseBlockRenderer.tsx`
- `packages/renderer/src/AccordionBlockRenderer.tsx`
- `apps/web/src/lib/scormExport.ts`
- `convex/ai.ts`

Possible support files:

- `packages/renderer/src/motion.ts`
- `packages/renderer/src/BlockShell.tsx`
- `packages/renderer/src/mobileStyles.ts` or equivalent CSS helper if the project adopts renderer-owned CSS strings later.

## Non-Goals

- Mobile authoring UI.
- Branching scenarios.
- Custom per-block animation controls.
- SCORM 2004 or xAPI.
- Audio narration.
- Full Rise clone template marketplace.
- Heavy 3D, parallax, or game-like animation.

## Risks And Mitigations

### Risk: Preview Looks Better Than Export

Mitigation: define motion in CSS tokens/classes and update preview/export together in the same implementation wave.

### Risk: Animations Hurt Accessibility

Mitigation: ship reduced-motion styles in Wave 1 and test keyboard behavior in Wave 6.

### Risk: AI Generates Long, Dense Lessons

Mitigation: strengthen prompt, validate output, and cap content sizes before DB insert.

### Risk: Mobile Shell Complicates SCORM Scoring

Mitigation: keep quiz scoring state local but route score events through one helper in preview and one equivalent helper in export JS.

### Risk: Course Feels Pretty But Not Instructional

Mitigation: require every generated lesson to include setup, example/scenario, interaction, feedback, and takeaway.

## Definition Of Done

This phase is complete when:

- Preview opens to a phone-first learner shell by default.
- Modules have smooth lesson transitions and block reveal animations.
- Interactive blocks have polished selected, feedback, retry, and completion states.
- Exported SCORM output uses the same mobile-first structure and motion language.
- AI-generated modules follow mobile lesson pacing and interaction expectations.
- Typecheck and build pass.
- Screenshots at 360px and desktop phone-frame preview look premium and free of layout glitches.
- Reduced-motion mode is supported.

## Suggested First Implementation Slice

Start with the smallest slice that proves the direction:

1. Add motion tokens and block reveal wrapper in the renderer.
2. Refactor preview into a phone-frame learner shell with top progress and bottom nav.
3. Polish MCQ and accordion animations.
4. Update SCORM CSS/JS for the same shell and block animations.
5. Update AI prompt for mobile-first lesson pacing.

This gives an end-to-end visible improvement quickly while protecting preview/export parity.

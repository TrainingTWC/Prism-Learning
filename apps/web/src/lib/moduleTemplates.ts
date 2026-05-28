/**
 * Module templates — pre-built starting points authors can import and edit.
 *
 * Each template is a fully-formed module spec (title + lessons + blocks).
 * Block `type` values MUST match the convex/schema.ts blocks.type union.
 * Block `content` matches the on-the-wire shape consumed by renderers
 * (HTML string for `richText`, JSON string for everything else).
 */

export type TemplateBlock = {
  type: string;
  /** HTML for richText, JSON-stringified payload for media/interactive blocks. */
  content: string;
};

export type TemplateLesson = {
  title: string;
  blocks: TemplateBlock[];
};

export type ModuleTemplate = {
  id: string;
  name: string;
  description: string;
  /** Short emoji used as a thumbnail glyph. */
  glyph: string;
  category: 'Onboarding' | 'Compliance' | 'Product' | 'Safety' | 'Microlearning' | 'Sales';
  /** Tailwind gradient classes for the card preview. */
  gradient: string;
  /** Suggested module title when imported. */
  suggestedTitle: string;
  lessons: TemplateLesson[];
};

const j = (o: unknown) => JSON.stringify(o);

// ───────── Helpers to keep template payloads readable ─────────
const rt = (html: string): TemplateBlock => ({ type: 'richText', content: html });
const quote = (text: string, attribution?: string): TemplateBlock => ({
  type: 'quote',
  content: j({ text, attribution: attribution ?? '' }),
});
const callout = (
  variant: 'info' | 'warning' | 'success' | 'tip',
  title: string,
  body: string,
): TemplateBlock => ({ type: 'callout', content: j({ variant, title, body }) });
const divider = (variant: 'line' | 'space' | 'dots' | 'label', label?: string): TemplateBlock => ({
  type: 'divider',
  content: j({ variant, label: label ?? '' }),
});
const process = (steps: { title: string; description: string }[]): TemplateBlock => ({
  type: 'process',
  content: j({ steps }),
});
const tabs = (items: { label: string; content: string }[]): TemplateBlock => ({
  type: 'tabs',
  content: j({ tabs: items }),
});
const accordion = (items: { title: string; body: string }[]): TemplateBlock => ({
  type: 'accordion',
  content: j({ items }),
});
const mcq = (
  question: string,
  options: string[],
  correctIndex: number,
  explanation?: string,
): TemplateBlock => ({
  type: 'mcq',
  content: j({ question, options, correctIndex, explanation: explanation ?? '' }),
});
const trueFalse = (
  question: string,
  answer: boolean,
  explanation?: string,
): TemplateBlock => ({
  type: 'trueFalse',
  content: j({ question, answer, explanation: explanation ?? '' }),
});
const flashcard = (cards: { front: string; back: string }[]): TemplateBlock => ({
  type: 'flashcard',
  content: j({ cards }),
});
const fillBlanks = (
  text: string,
  blanks: { answer: string; alternates?: string[] }[],
): TemplateBlock => ({
  type: 'fillBlanks',
  content: j({ text, blanks }),
});
const revealCards = (cards: { front: string; back: string }[]): TemplateBlock => ({
  type: 'revealCards',
  content: j({ cards }),
});
const scenario = (
  intro: string,
  branches: { id: string; text: string; choices: { label: string; nextId: string }[] }[],
  startId: string,
): TemplateBlock => ({
  type: 'scenario',
  content: j({ intro, startId, branches }),
});
const button = (label: string, href: string, variant: 'primary' | 'outline' | 'ghost' = 'primary'): TemplateBlock => ({
  type: 'button',
  content: j({ label, href, variant }),
});

// ───────── Templates ─────────

export const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    id: 'team-onboarding',
    name: 'Team Onboarding',
    description: 'Welcome new hires with a guided tour of your team, tools, and first-week milestones.',
    glyph: '👋',
    category: 'Onboarding',
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    suggestedTitle: 'Welcome to the team',
    lessons: [
      {
        title: 'Welcome aboard',
        blocks: [
          rt('<h2>You made it!</h2><p>We are <strong>thrilled</strong> to have you join us. This short module will walk you through what to expect in your first week, how we work, and where to find help.</p>'),
          callout('info', 'Heads up', 'This module takes about 15 minutes. You can pause and resume anytime — your progress is saved.'),
          quote('The first 90 days are the most important of any new role. Use them well.', 'Onboarding handbook'),
          process([
            { title: 'Day 1 — Meet the team', description: 'Intros, lunch, and a tour of the tools you’ll use every day.' },
            { title: 'Days 2–5 — Shadow & explore', description: 'Sit in on standups, read project docs, and ask everything.' },
            { title: 'Week 2 — Your first task', description: 'A small, scoped ticket to ship something real.' },
            { title: 'Day 30 — First retro', description: 'Quick check-in with your manager. What’s working? What isn’t?' },
          ]),
        ],
      },
      {
        title: 'How we work',
        blocks: [
          rt('<h2>Our working style</h2><p>We default to written communication, async-first, and weekly demos. Below are the tools and rituals that hold it all together.</p>'),
          tabs([
            { label: 'Communication', content: 'Slack for quick async, email for external, docs for decisions. No meetings before 10am.' },
            { label: 'Planning', content: 'Two-week sprints, kicked off Monday, demoed Friday. Tickets live in Linear.' },
            { label: 'Reviews', content: 'Code review within 24 hours. Aim for kindness + clarity. Approve fast, comment thoughtfully.' },
          ]),
          accordion([
            { title: 'Where do I report time off?', body: 'In Workday. Submit at least one week in advance for anything over two days.' },
            { title: 'What if I get stuck?', body: 'Post in #help or DM your buddy. Don’t spend more than 30 minutes blocked.' },
            { title: 'When are reviews?', body: 'Performance reviews happen every six months. Salary reviews annually.' },
          ]),
        ],
      },
      {
        title: 'Quick check',
        blocks: [
          rt('<h2>A quick check</h2><p>Just to make sure the basics stuck:</p>'),
          mcq(
            'When do most meetings start?',
            ['Before 10am', 'After 10am', 'Whenever', 'Never'],
            1,
            'We keep mornings meeting-free so people can do deep work.',
          ),
          trueFalse(
            'You should spend hours stuck before asking for help.',
            false,
            'Nope — ping #help after 30 minutes max. Saves you and the team time.',
          ),
          callout('success', 'You’re ready', 'That’s the basics. Your buddy will walk you through everything else in person.'),
        ],
      },
    ],
  },
  {
    id: 'compliance-essentials',
    name: 'Compliance Essentials',
    description: 'A short, no-nonsense overview of data handling, security basics, and reporting concerns.',
    glyph: '🛡️',
    category: 'Compliance',
    gradient: 'from-blue-600 via-cyan-500 to-teal-500',
    suggestedTitle: 'Compliance basics',
    lessons: [
      {
        title: 'Why compliance matters',
        blocks: [
          rt('<h2>Compliance isn’t bureaucracy — it’s trust</h2><p>Every rule in this module exists because someone, somewhere, got hurt. Following them keeps our customers safe, our company funded, and you out of legal trouble.</p>'),
          callout('warning', 'This is mandatory', 'You must complete this module within 14 days of starting. Completion is tracked.'),
          quote('Compliance is what you do when no one is watching.', 'Internal audit team'),
        ],
      },
      {
        title: 'Handling customer data',
        blocks: [
          rt('<h2>The three rules of customer data</h2>'),
          process([
            { title: 'Need to know', description: 'Only access data you actively need for your job. Snooping is a fireable offense.' },
            { title: 'Stay in approved tools', description: 'Never copy customer data to a personal device, email it, or paste it into ChatGPT.' },
            { title: 'Report incidents fast', description: 'If data leaks — even by accident — report it in <60 minutes via #security-incidents.' },
          ]),
          fillBlanks(
            'If a teammate asks for customer data they don’t need, the right answer is to say {{0}} and direct them to the {{1}} team.',
            [
              { answer: 'no', alternates: ['No', 'decline'] },
              { answer: 'security', alternates: ['compliance', 'data'] },
            ],
          ),
        ],
      },
      {
        title: 'Spot a phishing attempt',
        blocks: [
          rt('<h2>What to look for</h2><p>Most breaches start with a single click on a phishing email. Here are the tells:</p>'),
          revealCards([
            { front: 'Urgent tone', back: '“Act now or lose access” → 90% chance it’s a scam.' },
            { front: 'Sender mismatch', back: 'Display name says “IT” but the address is a personal Gmail.' },
            { front: 'Weird links', back: 'Hover before clicking. Real ones go to known domains.' },
            { front: 'Asks for credentials', back: 'No one legitimate will ever ask for your password in chat or email.' },
          ]),
          mcq(
            'An email from "ceo@notmycompany.com" asks you to wire money. What do you do?',
            ['Wire it — it’s the CEO', 'Reply asking for confirmation', 'Report it in #security and ignore', 'Forward it to a friend for a laugh'],
            2,
            'Always verify out of band, and never act on financial requests from unverified email.',
          ),
        ],
      },
      {
        title: 'Knowledge check',
        blocks: [
          trueFalse('Pasting customer emails into ChatGPT is allowed if it’s just for drafting.', false, 'Never paste real customer data into external AI tools.'),
          trueFalse('You should report a suspected leak even if you’re not sure it’s real.', true, 'Yes — false alarms cost nothing, missed leaks cost everything.'),
          callout('success', 'Module complete', 'Your completion will be logged and visible to compliance. Thanks for taking the time.'),
        ],
      },
    ],
  },
  {
    id: 'product-walkthrough',
    name: 'Product Walkthrough',
    description: 'Introduce a feature with screenshots, comparisons, and a hands-on quiz at the end.',
    glyph: '🚀',
    category: 'Product',
    gradient: 'from-orange-500 via-rose-500 to-pink-600',
    suggestedTitle: 'New feature walkthrough',
    lessons: [
      {
        title: 'What’s new',
        blocks: [
          rt('<h1>Meet the new feature</h1><p>We’ve rebuilt the way you do <strong>X</strong>. It’s faster, simpler, and removes three steps from the old flow. Here’s what changed.</p>'),
          callout('tip', 'Why we built it', 'Customers told us the old flow took too long. This redesign cuts the time-to-result by 60%.'),
          process([
            { title: 'Before', description: 'Open the modal → fill 5 fields → wait for confirmation → re-open to verify.' },
            { title: 'After', description: 'Inline edit → instant save → live preview, no modal.' },
          ]),
          button('See it in the app', '#', 'primary'),
        ],
      },
      {
        title: 'How to use it',
        blocks: [
          rt('<h2>Step by step</h2><p>Follow these to give it a try:</p>'),
          tabs([
            { label: 'Step 1', content: 'Open any record. You’ll see a new inline edit pencil next to each field.' },
            { label: 'Step 2', content: 'Click the pencil, type, and tab away — changes save instantly.' },
            { label: 'Step 3', content: 'The live preview on the right updates as you type, so you always see the result.' },
          ]),
          accordion([
            { title: 'Can I still use the old modal?', body: 'For now, yes — toggle it on in Settings → Labs. We’ll remove it next quarter.' },
            { title: 'Does this work on mobile?', body: 'Yes, with a long-press to enter edit mode.' },
            { title: 'What about permissions?', body: 'Same as before — viewers see read-only, editors can edit.' },
          ]),
        ],
      },
      {
        title: 'Try it yourself',
        blocks: [
          rt('<h2>Quick check</h2>'),
          mcq(
            'How do you enter inline edit mode?',
            ['Double-click the field', 'Click the pencil icon', 'Right-click → Edit', 'Hold shift'],
            1,
            'A single click on the pencil pops you straight into edit mode.',
          ),
          trueFalse('The old modal flow has been removed entirely.', false, 'Not yet — you can still toggle it on in Settings → Labs.'),
          callout('success', 'You’re all set', 'Try it on a real record next time you’re in the app. Reach out in #product-feedback with thoughts.'),
        ],
      },
    ],
  },
  {
    id: 'workplace-safety',
    name: 'Workplace Safety',
    description: 'Identify hazards, follow safe procedures, and know what to do in an emergency.',
    glyph: '⛑️',
    category: 'Safety',
    gradient: 'from-amber-500 via-orange-600 to-red-600',
    suggestedTitle: 'Workplace safety basics',
    lessons: [
      {
        title: 'Hazard awareness',
        blocks: [
          rt('<h2>Spotting hazards before they hurt anyone</h2><p>Most workplace injuries are preventable. The first defense is noticing the hazard in time.</p>'),
          callout('warning', 'Stop if you see this', 'Wet floors, exposed wiring, or blocked exits → tag it, report it, don’t walk past.'),
          revealCards([
            { front: 'Wet floor', back: 'Place a sign, alert facilities, and re-route foot traffic.' },
            { front: 'Frayed cord', back: 'Unplug, tag it out of service, file a ticket with IT.' },
            { front: 'Blocked exit', back: 'Clear it immediately, then notify the floor lead.' },
            { front: 'Spilled chemical', back: 'Evacuate the area, alert facilities, don’t attempt cleanup unless trained.' },
          ]),
        ],
      },
      {
        title: 'Emergency procedures',
        blocks: [
          rt('<h2>In an emergency</h2><p>Memorize this. Two minutes of preparation can save lives.</p>'),
          process([
            { title: 'Alert', description: 'Pull the nearest alarm. Don’t investigate first.' },
            { title: 'Evacuate', description: 'Use stairs, never elevators. Help anyone who needs it.' },
            { title: 'Assemble', description: 'Go to your floor’s muster point. Stay put until cleared.' },
            { title: 'Account', description: 'Floor lead does a headcount. Speak up if someone is missing.' },
          ]),
          accordion([
            { title: 'Fire', body: 'Pull alarm → exit via stairs → muster point → wait for fire marshal all-clear.' },
            { title: 'Medical', body: 'Call 911 → notify reception → first-aiders are listed on the back of every door.' },
            { title: 'Active threat', body: 'Run if you can, hide if you can’t, fight only as last resort. Lock doors, silence phones.' },
          ]),
        ],
      },
      {
        title: 'Safety check',
        blocks: [
          mcq(
            'You see smoke coming from a server room. First action?',
            ['Open the door to look', 'Pull the alarm', 'Take a photo', 'Find your manager'],
            1,
            'Always alert first. Investigation can wait — seconds matter in a fire.',
          ),
          trueFalse('It’s OK to use elevators during a fire if the stairs are crowded.', false, 'Never use elevators in a fire — they can fail or open onto the fire floor.'),
          fillBlanks(
            'In an evacuation, go to your floor’s {{0}} point and wait for the {{1}} marshal.',
            [
              { answer: 'muster', alternates: ['assembly', 'gathering'] },
              { answer: 'fire', alternates: ['safety', 'floor'] },
            ],
          ),
        ],
      },
    ],
  },
  {
    id: 'microlearning-burst',
    name: 'Microlearning Burst',
    description: 'A tiny, single-concept lesson with a quote, a callout, and one quick check. Perfect for daily nuggets.',
    glyph: '⚡',
    category: 'Microlearning',
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-600',
    suggestedTitle: 'Today’s 2-minute lesson',
    lessons: [
      {
        title: 'One idea, five questions',
        blocks: [
          rt('<h1>The 5 Whys</h1><p>When something breaks, asking <em>“why?”</em> five times in a row gets you past the symptom and down to the root cause. It’s the simplest debugging tool ever invented.</p>'),
          quote('Be hard on the problem, soft on the people.', 'Toyota Production System'),
          process([
            { title: 'Why did the server crash?', description: 'It ran out of memory.' },
            { title: 'Why did it run out of memory?', description: 'A queue grew unbounded.' },
            { title: 'Why was the queue unbounded?', description: 'Workers stopped processing it.' },
            { title: 'Why did workers stop?', description: 'A bad deploy crashed them on startup.' },
            { title: 'Why didn’t we catch the bad deploy?', description: 'No smoke test in CI.' },
          ]),
          callout('tip', 'The real fix', 'Notice how the answer is at step 5, not step 1. That’s the whole point.'),
          mcq(
            'What’s the goal of asking “why?” five times?',
            ['To find someone to blame', 'To get to the root cause', 'To fill time in a meeting', 'To document the symptom'],
            1,
            'Symptoms are easy; root causes are where fixes actually live.',
          ),
        ],
      },
    ],
  },
  {
    id: 'sales-pitch-essentials',
    name: 'Sales Pitch Essentials',
    description: 'Structure a pitch, handle objections, and close with confidence. Includes a branching scenario.',
    glyph: '💼',
    category: 'Sales',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    suggestedTitle: 'Sales pitch fundamentals',
    lessons: [
      {
        title: 'Anatomy of a pitch',
        blocks: [
          rt('<h1>Every great pitch has four parts</h1><p>The order matters. Skip a step and the prospect will too.</p>'),
          process([
            { title: 'Hook', description: 'One sentence that names the prospect’s pain. They should think “that’s me.”' },
            { title: 'Proof', description: 'A real customer story with a real number. Specifics build trust.' },
            { title: 'Mechanism', description: 'A 30-second explainer of how your thing works. Skip the jargon.' },
            { title: 'Ask', description: 'A clear, easy next step. “Can we do 20 minutes Tuesday?”' },
          ]),
          divider('label', 'Worth remembering'),
          quote('People don’t buy products. They buy better versions of themselves.', 'Seth Godin'),
        ],
      },
      {
        title: 'Handling objections',
        blocks: [
          rt('<h2>The three objections you’ll hear most</h2>'),
          tabs([
            { label: '“Too expensive”', content: 'Reframe in terms of ROI or cost of inaction. Never apologize for the price.' },
            { label: '“No budget”', content: 'Ask when budgets are set, and offer a small pilot that fits petty cash.' },
            { label: '“Need to think”', content: 'Probe gently — what specifically do they need to think about? That’s the real objection.' },
          ]),
          flashcard([
            { front: '“We’re happy with our current vendor.”', back: '“What would have to be true for you to consider a switch?”' },
            { front: '“Send me some info.”', back: '“Happy to. Could we book 15 minutes to walk through it together first?”' },
            { front: '“Call me back next quarter.”', back: '“Sure — what changes next quarter that we should plan for?”' },
          ]),
        ],
      },
      {
        title: 'Live scenario',
        blocks: [
          rt('<h2>The call</h2><p>You’re 5 minutes into a discovery call with a CFO. They’re skeptical. Pick your path:</p>'),
          scenario(
            'You’re 5 minutes into a discovery call. The CFO crosses their arms and says: “Look, we already use a competitor. Make it quick.”',
            [
              {
                id: 'start',
                text: 'The CFO crosses their arms: “We already use a competitor. Make it quick.”',
                choices: [
                  { label: 'Launch into your slide deck', nextId: 'bad-deck' },
                  { label: 'Ask why they took the call', nextId: 'good-ask' },
                  { label: 'Trash-talk the competitor', nextId: 'bad-trash' },
                ],
              },
              {
                id: 'bad-deck',
                text: 'They tune out by slide 3 and end the call early. Lost.',
                choices: [{ label: 'Try again', nextId: 'start' }],
              },
              {
                id: 'good-ask',
                text: 'They pause. “Honestly, the rep wouldn’t stop emailing.” You’ve got an opening.',
                choices: [
                  { label: 'Pitch features now', nextId: 'bad-deck' },
                  { label: 'Ask what’s not working with the competitor', nextId: 'great' },
                ],
              },
              {
                id: 'bad-trash',
                text: 'They cut you off: “That’s unprofessional.” Call over. Don’t do this.',
                choices: [{ label: 'Try again', nextId: 'start' }],
              },
              {
                id: 'great',
                text: 'They open up about three real pain points. You’ve earned 20 more minutes. This is a meeting now.',
                choices: [{ label: 'Restart scenario', nextId: 'start' }],
              },
            ],
            'start',
          ),
          callout('success', 'The pattern', 'Always earn the right to pitch by understanding the pain first. Discovery > demo.'),
        ],
      },
    ],
  },
];

export function getTemplateById(id: string): ModuleTemplate | undefined {
  return MODULE_TEMPLATES.find((t) => t.id === id);
}

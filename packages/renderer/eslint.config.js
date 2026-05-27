// Purity boundary for @prism/renderer.
// This package MUST NOT import: Convex, fetch, auth modules, network code,
// or use absolute hex colors in source files (theme tokens only).
//
// Enforced architecturally; we'll wire a no-restricted-imports rule into the
// root ESLint config when source files start landing. For now the rule below
// is documentation — kept narrow so it doesn't false-positive on early stubs.
import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'convex', message: 'Renderer must be pure — no Convex imports.' },
            { name: 'convex/react', message: 'Renderer must be pure — no Convex imports.' },
            { name: 'convex/values', message: 'Renderer must be pure — no Convex imports.' },
          ],
          patterns: [
            { group: ['convex/*'], message: 'Renderer must be pure — no Convex imports.' },
            { group: ['**/auth/*'], message: 'Renderer must be pure — no auth imports.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Renderer must be pure — no network I/O. Use resolveAsset prop.' },
      ],
    },
  },
];

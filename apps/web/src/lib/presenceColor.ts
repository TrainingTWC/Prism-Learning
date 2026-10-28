/** Stable per-user presence colours (all pass white-text contrast). */
export const PRESENCE_PALETTE = [
  '#8C43D0',
  '#C2410C',
  '#1D5FD1',
  '#0F7B6C',
  '#B4235A',
  '#7A5C00',
  '#3A6EA5',
  '#5B6B1F',
] as const;

/** Deterministic palette pick for a user id (same id -> same colour). */
export function presenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_PALETTE[hash % PRESENCE_PALETTE.length]!;
}

/** Up-to-two-letter initials from a display name (or email). */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const base = trimmed.includes('@') ? (trimmed.split('@')[0] ?? trimmed) : trimmed;
  const words = base.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

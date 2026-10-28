import { initials, presenceColor } from '../../lib/presenceColor';

export interface PresenceRow {
  _id: string;
  userId: string;
  displayName: string;
  activeLessonId?: string;
}

interface PresenceAvatarsProps {
  rows: readonly PresenceRow[];
  /** Max circles before collapsing into "+N". */
  max?: number;
  size?: number;
}

/** Overlapping initials circles with a stable colour per user. */
export function PresenceAvatars({ rows, max = 4, size = 28 }: PresenceAvatarsProps) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, max);
  const extra = rows.length - shown.length;
  const font = Math.max(9, Math.round(size * 0.38));
  return (
    <div className="flex items-center" aria-label={`${rows.length} here now`}>
      {shown.map((r, i) => (
        <span
          key={r._id}
          title={r.displayName}
          className="flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white"
          style={{
            width: size,
            height: size,
            fontSize: font,
            background: presenceColor(r.userId),
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          {initials(r.displayName)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-[#EDEDF1] font-semibold text-ink-2 ring-2 ring-white"
          style={{ width: size, height: size, fontSize: font, marginLeft: -8 }}
          title={rows
            .slice(max)
            .map((r) => r.displayName)
            .join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

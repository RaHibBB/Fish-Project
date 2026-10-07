// Dependency-free SVG charts (render on the server, print cleanly).
import { compactTaka, taka } from "@/lib/format";

export function Donut({
  slices,
  total,
  label = "মোট",
  size = 180,
}: {
  slices: { value: number; color: string; key: string | number }[];
  total: number;
  label?: string;
  size?: number;
}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label={`${label} ${taka(total)}`}>
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--muted)" strokeWidth="22" />
      {total > 0 &&
        slices.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.key}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            />
          );
          offset += len;
          return el;
        })}
      <text x="90" y="82" textAnchor="middle" fontSize="13" fill="var(--muted-foreground)">
        {label}
      </text>
      <text x="90" y="106" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">
        {compactTaka(total)}
      </text>
    </svg>
  );
}

/** Vertical bars, e.g. month-by-month totals. */
export function BarChart({
  bars,
  color = "var(--chart-1)",
  height = 160,
}: {
  bars: { label: string; value: number; key: string }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = 44;
  const width = Math.max(bars.length * slot, 300);
  const chartH = height - 36;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="মাসিক খরচের চার্ট">
        <line x1="0" x2={width} y1={chartH + 14} y2={chartH + 14} stroke="var(--border)" />
        {bars.map((b, i) => {
          const h = Math.round((b.value / max) * chartH);
          const x = i * slot + 8;
          return (
            <g key={b.key}>
              <rect x={x} y={chartH + 14 - h} width={slot - 16} height={h} rx="4" fill={color} />
              {b.value > 0 && (
                <text x={x + (slot - 16) / 2} y={chartH + 10 - h} textAnchor="middle" fontSize="10" fill="currentColor">
                  {compactTaka(b.value)}
                </text>
              )}
              <text x={x + (slot - 16) / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Thin horizontal share bar under a list row. */
export function ShareBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.max(percent, 0.5)}%`, backgroundColor: color }} />
    </div>
  );
}

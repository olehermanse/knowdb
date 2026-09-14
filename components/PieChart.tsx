import { ReactNode } from "react";
import EntryLink from "@/components/EntryLink";
import { EntryRef } from "@/lib/data";

// One slice of a pie: a label, how many hosts, and optionally the entry the
// label links to (a slice like "own data center" has no entry).
export interface PieItem {
  label: string;
  hosts: number;
  link?: EntryRef;
}

// The categorical palette has 8 fixed slots. Items beyond the first 7 are
// folded into a single "Other" slice so the chart never needs a 9th colour;
// the ranked list below the chart still names every item.
const MAX_SLICES = 8;
const OTHER = "Other";

const CX = 100;
const CY = 100;
const R = 90;

function polar(fraction: number): [number, number] {
  // Start at 12 o'clock and go clockwise.
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [CX + R * Math.cos(angle), CY + R * Math.sin(angle)];
}

function slicePath(start: number, end: number): string {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function hostsLabel(n: number): string {
  return `${n} ${n === 1 ? "host" : "hosts"}`;
}

function ItemLabel({ item }: { item: PieItem }) {
  return item.link ? <EntryLink type={item.link.type} name={item.link.name} label={item.label} /> : <>{item.label}</>;
}

// A GitHub-style pie chart with a ranked list, most hosts first. `testId`
// prefixes the test ids ("os" gives os-chart, os-pie, os-list, os-summary).
export default function PieChart({
  items,
  subject,
  noun,
  testId,
  ariaLabel,
  single,
}: {
  items: PieItem[];
  // What the hosts belong to, e.g. "This group", for the single-item sentence.
  subject: string;
  // What the items are, e.g. "operating system", for the single-item sentence.
  noun: string;
  testId: string;
  ariaLabel: string;
  // Optional replacement for the single-item sentence.
  single?: (item: PieItem) => ReactNode;
}) {
  const total = items.reduce((sum, c) => sum + c.hosts, 0);

  if (items.length === 0) {
    return (
      <p className="muted" data-testid={`${testId}-summary`}>
        {subject} has no hosts.
      </p>
    );
  }

  if (items.length === 1) {
    const only = items[0];
    return (
      <p data-testid={`${testId}-summary`}>
        {single ? (
          single(only)
        ) : (
          <>
            {subject} has only 1 {noun}: <ItemLabel item={only} /> ({hostsLabel(only.hosts)}).
          </>
        )}
      </p>
    );
  }

  const foldFrom = items.length > MAX_SLICES ? MAX_SLICES - 1 : items.length;
  const slices = items.slice(0, foldFrom).map((c, i) => ({ ...c, slot: i + 1 }));
  const folded = items.slice(foldFrom);
  if (folded.length > 0) {
    slices.push({
      label: OTHER,
      hosts: folded.reduce((sum, c) => sum + c.hosts, 0),
      slot: MAX_SLICES,
    });
  }
  const slotFor = (index: number) => (index < foldFrom ? index + 1 : MAX_SLICES);

  // Start and end of each slice as a fraction of the full circle.
  const arcs: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const slice of slices) {
    arcs.push({ start: cursor, end: cursor + slice.hosts / total });
    cursor += slice.hosts / total;
  }

  return (
    <div className="os-chart" data-testid={`${testId}-chart`}>
      <svg
        className="pie"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${ariaLabel} of ${total} hosts`}
        data-testid={`${testId}-pie`}
      >
        {slices.map((slice, i) => {
          const { start, end } = arcs[i];
          const percent = Math.round((slice.hosts / total) * 100);
          return (
            <path
              key={slice.label}
              className={`slice slice-${slice.slot}`}
              d={slicePath(start, end)}
              data-os={slice.label}
              data-label={slice.label}
            >
              <title>{`${slice.label}: ${hostsLabel(slice.hosts)} (${percent}%)`}</title>
            </path>
          );
        })}
      </svg>
      <ol className="os-list" data-testid={`${testId}-list`}>
        {items.map((c, i) => (
          <li key={c.label}>
            <span className={`swatch slice-${slotFor(i)}`} aria-hidden="true" />
            <ItemLabel item={c} />
            <span className="muted">
              {hostsLabel(c.hosts)}, {Math.round((c.hosts / total) * 100)}%
              {i >= foldFrom && ` (in ${OTHER})`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

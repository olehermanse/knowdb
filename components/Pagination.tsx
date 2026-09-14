import Link from "next/link";

export const PAGE_SIZE = 50;

// Parse a ?page= query value into a page number (1-based), defaulting to 1.
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// The slice of `items` for `page`, clamping out-of-range pages to the last.
export function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  return { shown: items.slice(start, start + PAGE_SIZE), current, totalPages, start };
}

// "Showing 51–100 of 100 hosts" with Previous/Next and page links. Renders
// nothing when everything fits on one page.
export default function Pagination({
  total,
  shown,
  start,
  current,
  totalPages,
  noun,
  hrefForPage,
}: {
  total: number;
  shown: number;
  start: number;
  current: number;
  totalPages: number;
  noun: string;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination" data-testid="pagination">
      <span className="muted" data-testid="pagination-summary">
        Showing {start + 1}–{start + shown} of {total} {noun}
      </span>
      <span className="pagination-links">
        {current > 1 ? (
          <Link href={hrefForPage(current - 1)} rel="prev">
            ← Previous
          </Link>
        ) : (
          <span className="muted">← Previous</span>
        )}
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
          n === current ? (
            <span key={n} className="pagination-current" aria-current="page">
              {n}
            </span>
          ) : (
            <Link key={n} href={hrefForPage(n)}>
              {n}
            </Link>
          ),
        )}
        {current < totalPages ? (
          <Link href={hrefForPage(current + 1)} rel="next">
            Next →
          </Link>
        ) : (
          <span className="muted">Next →</span>
        )}
      </span>
    </nav>
  );
}

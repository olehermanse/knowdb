import Link from "next/link";
import HostListItem from "@/components/HostListItem";
import { Host } from "@/lib/data";

export const HOSTS_PER_PAGE = 50;

// Parse a ?page= query value into a page number (1-based), defaulting to 1.
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// A list of hosts, shown HOSTS_PER_PAGE at a time with Previous/Next and
// page links. Out-of-range pages are clamped to the last page.
export default function HostList({
  hosts,
  page,
  hrefForPage,
  testId = "linked-hosts",
}: {
  hosts: Host[];
  page: number;
  hrefForPage: (page: number) => string;
  testId?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(hosts.length / HOSTS_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * HOSTS_PER_PAGE;
  const shown = hosts.slice(start, start + HOSTS_PER_PAGE);

  return (
    <>
      <ul className="entry-list" data-testid={testId}>
        {shown.map((host) => (
          <HostListItem key={host.id} host={host} />
        ))}
      </ul>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination" data-testid="pagination">
          <span className="muted" data-testid="pagination-summary">
            Showing {start + 1}–{start + shown.length} of {hosts.length} hosts
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
      )}
    </>
  );
}

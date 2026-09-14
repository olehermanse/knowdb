import EntryLink from "@/components/EntryLink";
import HostList, { parsePage } from "@/components/HostList";
import HostListItem from "@/components/HostListItem";
import Pagination, { paginate } from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";
import {
  describeEntry,
  describeFilters,
  entriesOfType,
  getHost,
  isEntryType,
  TYPE_LABELS,
  type EntryType,
  type Host,
  parseSearchQuery,
  searchEntries,
  searchHosts,
} from "@/lib/data";

// Everything of one type, 50 at a time; hosts use the host cards.
function TypeListing({ type, page }: { type: EntryType; page: number }) {
  const all = entriesOfType(type);
  const label = TYPE_LABELS[type];
  const hrefForPage = (n: number) => `/search?type=${type}${n > 1 ? `&page=${n}` : ""}`;
  const summary = (
    <p className="muted" data-testid="search-summary">
      {`${all.length} ${all.length === 1 ? label.replace(/s$/, "") : label.toLowerCase()} in your infrastructure.`}
    </p>
  );
  if (type === "host") {
    const hosts = all.map((e) => getHost(e.name)).filter((h): h is Host => h !== undefined);
    return (
      <>
        {summary}
        <HostList hosts={hosts} page={page} testId="search-results" hrefForPage={hrefForPage} />
      </>
    );
  }
  const { shown, current, totalPages, start } = paginate(all, page);
  return (
    <>
      {summary}
      <ul className="entry-list" data-testid="search-results">
        {shown.map((entry) => (
          <li key={`${entry.type}:${entry.name}`} className="host-item">
            <span className="type-badge">{entry.type}</span>
            <div className="host-summary">
              <div>
                <EntryLink type={entry.type} name={entry.name} />
              </div>
              <div className="muted host-facts">{describeEntry(entry)}</div>
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        total={all.length}
        shown={shown.length}
        start={start}
        current={current}
        totalPages={totalPages}
        noun={label.toLowerCase()}
        hrefForPage={hrefForPage}
      />
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  const page = parsePage(params.page);
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const listType = rawType && isEntryType(rawType) ? rawType : undefined;
  const parsed = parseSearchQuery(query);
  const filtered = parsed.filters.length > 0;
  const hostResults = filtered ? searchHosts(parsed) : [];
  const results = query && !filtered ? searchEntries(query) : [];

  return (
    <>
      <h1>Search</h1>
      <SearchForm query={query} />
      {listType && <TypeListing type={listType} page={page} />}
      {!query && !listType && (
        <p className="muted" data-testid="search-hint">
          Search for anything: a hostname, port number, software, user,
          operating system, group, or words from a description. Use filters
          like <code>port:22 group:Windows</code> to list only the hosts
          matching all of them.
        </p>
      )}
      {query && filtered && (
        <p className="muted" data-testid="search-summary">
          {`${hostResults.length} ${hostResults.length === 1 ? "host" : "hosts"} matching ${describeFilters(parsed.filters)}`}
          {parsed.text && ` with “${parsed.text}” in the hostname`}.
        </p>
      )}
      {query && !filtered && (
        <p className="muted" data-testid="search-summary">
          {results.length === 0
            ? `No results for “${query}”.`
            : `${results.length} ${results.length === 1 ? "result" : "results"} for “${query}”.`}
        </p>
      )}
      {hostResults.length > 0 && (
        <HostList
          hosts={hostResults}
          page={page}
          testId="search-results"
          hrefForPage={(n) =>
            `/search?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ""}`
          }
        />
      )}
      {results.length > 0 && (
        <ul className="entry-list" data-testid="search-results">
          {results.map(({ entry, description }) => {
            const host = entry.type === "host" ? getHost(entry.name) : undefined;
            if (host) return <HostListItem key={`host:${host.id}`} host={host} />;
            return (
              <li key={`${entry.type}:${entry.name}`} className="host-item">
                <span className="type-badge">{entry.type}</span>
                <div className="host-summary">
                  <div>
                    <EntryLink type={entry.type} name={entry.name} />
                  </div>
                  <div className="muted host-facts">{description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

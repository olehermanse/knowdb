import EntryLink from "@/components/EntryLink";
import HostList, { parsePage } from "@/components/HostList";
import HostListItem from "@/components/HostListItem";
import SearchForm from "@/components/SearchForm";
import {
  describeFilters,
  getHost,
  parseSearchQuery,
  searchEntries,
  searchHosts,
} from "@/lib/data";

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  const page = parsePage(params.page);
  const parsed = parseSearchQuery(query);
  const filtered = parsed.filters.length > 0;
  const hostResults = filtered ? searchHosts(parsed) : [];
  const results = query && !filtered ? searchEntries(query) : [];

  return (
    <>
      <h1>Search</h1>
      <SearchForm query={query} />
      {!query && (
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

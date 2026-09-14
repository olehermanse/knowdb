import EntryLink from "@/components/EntryLink";
import HostListItem from "@/components/HostListItem";
import SearchForm from "@/components/SearchForm";
import { getHost, searchEntries } from "@/lib/data";

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  const results = query ? searchEntries(query) : [];

  return (
    <>
      <h1>Search</h1>
      <SearchForm query={query} />
      {!query && (
        <p className="muted" data-testid="search-hint">
          Search for anything: a hostname, port number, software, user,
          operating system, group, or words from a description.
        </p>
      )}
      {query && (
        <p className="muted" data-testid="search-summary">
          {results.length === 0
            ? `No results for “${query}”.`
            : `${results.length} ${results.length === 1 ? "result" : "results"} for “${query}”.`}
        </p>
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

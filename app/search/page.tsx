import EntryLink from "@/components/EntryLink";
import HostList, { parsePage } from "@/components/HostList";
import HostListItem from "@/components/HostListItem";
import Pagination, { paginate } from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";
import {
  describeCondition,
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

// Everything of one type, a page at a time; hosts use the host cards. With
// `only` set, just the entries of the type that have at least one of those
// hosts (`type:cloud os:"Ubuntu 24"` lists the clouds with Ubuntu 24 hosts).
function TypeListing({
  type,
  page,
  only,
  narrowedBy,
  hrefForPage,
}: {
  type: EntryType;
  page: number;
  only?: Set<string>;
  narrowedBy?: string;
  hrefForPage: (n: number) => string;
}) {
  const all = entriesOfType(type).filter((e) => !only || e.hosts.some((k) => only.has(k)));
  const label = TYPE_LABELS[type];
  const noun = all.length === 1 ? label.replace(/s$/, "").toLowerCase() : label.toLowerCase();
  const summary = (
    <p className="muted" data-testid="search-summary">
      {narrowedBy
        ? `${all.length} ${noun} ${type === "host" ? "matching" : "with hosts matching"} ${narrowedBy}.`
        : `${all.length} ${noun} in your infrastructure.`}
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
  const parsed = parseSearchQuery(query);
  // A listing of one type comes from the front page buttons (`?type=os`) or
  // from typing `type:os` in the search bar; both show `type:os` there.
  const listType = rawType && isEntryType(rawType) ? rawType : parsed.listType;
  const searching = query.length > 0 && !listType;
  const filtered = parsed.filters.length > 0 || parsed.conditions.length > 0 || parsed.hubs.length > 0;
  const hostResults = searching && filtered ? searchHosts(parsed) : [];
  const results = searching && !filtered ? searchEntries(query) : [];
  // The search bar shows the query as typed, so it stays in sync with the
  // URL; a listing from a front page button (`?type=os`) shows `type:os`.
  const shownQuery = query || (listType ? `type:${listType}` : "");
  const hrefForPage = (n: number) =>
    `/search?${query ? `q=${encodeURIComponent(query)}` : `type=${listType}`}${n > 1 ? `&page=${n}` : ""}`;
  // `type:cloud os:"Ubuntu 24"`: only the clouds with hosts matching the rest.
  const narrowing = listType && (filtered || parsed.text.length > 0);
  const narrowedBy = narrowing
    ? [
        describeFilters(parsed.filters, parsed.hubs),
        ...parsed.conditions.map(describeCondition),
        parsed.text && `“${parsed.text}” in the hostname`,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;

  return (
    <>
      <h1>Search</h1>
      <SearchForm query={shownQuery} />
      {listType && (
        <TypeListing
          type={listType}
          page={page}
          only={narrowing ? new Set(searchHosts(parsed).map((h) => h.id)) : undefined}
          narrowedBy={narrowedBy}
          hrefForPage={hrefForPage}
        />
      )}
      {!query && !listType && (
        <p className="muted" data-testid="search-hint">
          Search for anything: a hostname, port number, software, user,
          operating system, group, or words from a description. Use filters
          like <code>port:22 group:Windows</code> or{" "}
          <code>role:Client hub:18.130.49.157</code> to list only the hosts
          matching all of them; repeat a filter, like{" "}
          <code>os:&quot;Ubuntu 24&quot; os:&quot;Ubuntu 22&quot;</code>, to match either.
          Use conditions like <code>disk&lt;20%</code> and{" "}
          <code>memory&lt;10%</code> for hosts with little free disk or memory,
          or <code>type:os</code> to list everything of one type.
        </p>
      )}
      {searching && filtered && (
        <p className="muted" data-testid="search-summary">
          {`${hostResults.length} ${hostResults.length === 1 ? "host" : "hosts"} matching ${[
            describeFilters(parsed.filters, parsed.hubs),
            ...parsed.conditions.map(describeCondition),
          ]
            .filter(Boolean)
            .join(", ")}`}
          {parsed.text && ` with “${parsed.text}” in the hostname`}.
        </p>
      )}
      {searching && !filtered && (
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
          hrefForPage={hrefForPage}
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

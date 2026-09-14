// Plain GET form so search works without client-side JavaScript.
export default function SearchForm({ query = "" }: { query?: string }) {
  return (
    <form action="/search" method="get" className="search-form" role="search">
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search hosts, ports, software, users…"
        aria-label="Search"
        data-testid="search-input"
      />
      <button type="submit">Search</button>
    </form>
  );
}

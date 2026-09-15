import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import Comments from "@/components/Comments";
import Pagination, { paginate } from "@/components/Pagination";
import { hostsLabel } from "@/components/PortsSection";
import {
  describeEntry,
  similarEntries,
  TYPE_LABELS,
  aggregateValues,
  aggregateVersions,
  Entry,
  entryHref,
  externalLinkLabel,
  getComments,
  getEntryLinks,
  filterSearchHref,
  valueEntryName,
  versionEntryName,
} from "@/lib/data";

// The entry's own tabs, shown on the left of an entry page: versions (for
// software), values (for variables), similar entries, resources and
// comments. The hosts' ports are a tab on the right, with the hosts.
export type Tab = "versions" | "values" | "similar" | "resources" | "comments";
const TAB_ORDER: Tab[] = ["versions", "values", "similar", "resources", "comments"];

export function parseTab(raw: string | string[] | undefined): Tab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TAB_ORDER as string[]).includes(value ?? "") ? (value as Tab) : undefined;
}

// Versions only for software and values only for variables.
export function entryTabs(entry: Entry): Tab[] {
  const tabs: Tab[] = [];
  if (entry.type === "software") tabs.push("versions");
  if (entry.type === "variable") tabs.push("values");
  tabs.push("similar", "resources", "comments");
  return tabs;
}

// Query parameters belonging to the other side of the page (e.g. the
// right pane's htab and page), kept as they are when following a link.
export type KeptQuery = Record<string, string | undefined>;

// Link to a tab (and a page of its list); the first tab and first page
// need no query parameters. The tab lists page with `tpage`, separate from
// the host list's `page` on the right, whose parameters are kept.
export function tabHref(entry: Entry, tabs: Tab[], tab: Tab, page = 1, keep: KeptQuery = {}): string {
  const params = new URLSearchParams();
  if (tab !== tabs[0]) params.set("tab", tab);
  if (page > 1) params.set("tpage", String(page));
  for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
  const q = params.toString();
  return `${entryHref(entry)}${q ? `?${q}` : ""}`;
}

// Props shared by the paginated tab panels.
interface PanelProps {
  entry: Entry;
  tabs: Tab[];
  page: number;
  keep: KeptQuery;
}

function TabPagination({
  entry,
  tabs,
  tab,
  keep,
  total,
  shown,
  start,
  current,
  totalPages,
  noun,
}: PanelProps & {
  tab: Tab;
  total: number;
  shown: number;
  start: number;
  current: number;
  totalPages: number;
  noun: string;
}) {
  return (
    <Pagination
      total={total}
      shown={shown}
      start={start}
      current={current}
      totalPages={totalPages}
      noun={noun}
      hrefForPage={(n) => tabHref(entry, tabs, tab, n, keep)}
    />
  );
}

// Versions of a piece of software, one card per version, most hosts first.
function VersionsPanel({ entry, tabs, page, keep }: PanelProps) {
  const versions = aggregateVersions(entry.name, entry.hosts);
  const paged = paginate(versions, page);
  return (
    <>
      <p className="muted" data-testid="versions-description">
        Versions of {entry.name} in your infrastructure:
      </p>
      {versions.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="versions">
        {paged.shown.map(({ version, hosts }) => {
          const name = versionEntryName(entry.name, version);
          const searchHref = filterSearchHref([{ type: "version", name }]);
          return (
            <li key={version} className="host-item" data-testid="version-item">
              <span className="type-badge">version</span>
              <div className="host-summary">
                <div>
                  <EntryLink type="version" name={name} />
                </div>
                <div className="muted host-facts">
                  <Link href={searchHref} className="entry-link" data-testid="version-hosts-link">
                    {hostsLabel(hosts)}
                  </Link>
                  <span>{describeEntry({ type: "version", name })}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="versions"
        page={page}
        total={versions.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="versions"
      />
    </>
  );
}

// Values of a variable, one card per value, most hosts first.
function ValuesPanel({ entry, tabs, page, keep }: PanelProps) {
  const values = aggregateValues(entry.name, entry.hosts);
  const paged = paginate(values, page);
  return (
    <>
      <p className="muted" data-testid="values-description">
        Values of {entry.name} in your infrastructure:
      </p>
      {values.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="values">
        {paged.shown.map(({ value, hosts }) => {
          const name = valueEntryName(entry.name, value);
          const searchHref = filterSearchHref([{ type: "value", name }]);
          return (
            <li key={value} className="host-item" data-testid="value-item">
              <span className="type-badge">value</span>
              <div className="host-summary">
                <div>
                  <EntryLink type="value" name={name} />
                </div>
                <div className="muted host-facts">
                  <Link href={searchHref} className="entry-link" data-testid="value-hosts-link">
                    {hostsLabel(hosts)}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="values"
        page={page}
        total={values.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="values"
      />
    </>
  );
}

// Entries of the same type with similar names, longest shared prefix first.
function SimilarPanel({ entry, tabs, page, keep }: PanelProps) {
  const similar = similarEntries(entry);
  const paged = paginate(similar, page);
  return (
    <>
      <p className="muted" data-testid="similar-description">
        {entry.type === "ip" || entry.type === "mac"
          ? `Other similar ${TYPE_LABELS[entry.type]}:`
          : `Other ${TYPE_LABELS[entry.type].toLowerCase()} with similar names:`}
      </p>
      <ul className="entry-list" data-testid="similar">
        {paged.shown.map(({ entry: e, common }) => (
          <li key={e.name} className="host-item" data-testid="similar-item" data-common={common}>
            <span className="type-badge">{e.type}</span>
            <div className="host-summary">
              <div>
                <EntryLink type={e.type} name={e.name} />
              </div>
              <div className="muted host-facts">{describeEntry(e)}</div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="similar"
        page={page}
        total={similar.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun={TYPE_LABELS[entry.type].toLowerCase()}
      />
    </>
  );
}

// External resources (Wikipedia, official sites, ...) from info.json.
function ResourcesPanel({ entry }: { entry: Entry }) {
  const links = getEntryLinks(entry);
  return (
    <>
      <p className="muted" data-testid="resources-description">
        Read more about {entry.name}:
      </p>
      <ul className="entry-list" data-testid="external-links">
        {links.map((link) => (
          <li key={link.url} className="host-item" data-testid="resource-item">
            <span className="type-badge">link</span>
            <div className="host-summary">
              <div>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="entry-link">
                  {externalLinkLabel(link)}
                </a>
              </div>
              <div className="muted host-facts">{link.url}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// The ports the related hosts listen on, one card per port, ascending.
export default function RelatedHosts({
  entry,
  tabs,
  tab,
  page,
  keep = {},
  testId,
}: {
  entry: Entry;
  tabs: Tab[];
  tab?: Tab;
  // Page of the current tab's list (the `tpage` query parameter).
  page: number;
  // The other side's query parameters, kept when switching tabs here.
  keep?: KeptQuery;
  testId: string;
}) {
  const similarCount = similarEntries(entry).length;
  const resourceCount = getEntryLinks(entry).length;
  // Tabs with nothing to show are disabled: visible, gray, not clickable.
  const disabled = new Set<Tab>();
  if (similarCount === 0) disabled.add("similar");
  if (resourceCount === 0) disabled.add("resources");
  const enabled = tabs.filter((t) => !disabled.has(t));
  const current = tab && enabled.includes(tab) ? tab : enabled[0];
  const counts: Record<Tab, number> = {
    similar: similarCount,
    resources: resourceCount,
    comments: getComments(entry).length,
    versions: entry.type === "software" ? aggregateVersions(entry.name, entry.hosts).length : 0,
    values: entry.type === "variable" ? aggregateValues(entry.name, entry.hosts).length : 0,
  };
  const labels: Record<Tab, string> = {
    versions: "Versions",
    values: "Values",
    similar: "Similar",
    resources: "Resources",
    comments: "Comments",
  };
  const testIds: Record<Tab, string> = {
    versions: "versions-heading",
    values: "values-heading",
    similar: "similar-heading",
    resources: "resources-heading",
    comments: "comments-heading",
  };
  return (
    <section className="related-hosts" data-testid={testId}>
      <nav className="tabs" role="tablist" aria-label="Related information">
        {tabs.map((t) =>
          disabled.has(t) ? (
            <span
              key={t}
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              className="tab tab-disabled"
              data-testid={testIds[t]}
            >
              {labels[t]} <span className="muted">({counts[t]})</span>
            </span>
          ) : (
            <Link
              key={t}
              href={tabHref(entry, tabs, t, 1, keep)}
              role="tab"
              aria-selected={t === current}
              className={`tab${t === current ? " tab-current" : ""}`}
              data-testid={testIds[t]}
            >
              {labels[t]}{" "}
              {t === "comments" ? (
                <span
                  className="muted"
                  data-comments-count
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{ __html: `(${counts[t]})` }}
                />
              ) : (
                <span className="muted">({counts[t]})</span>
              )}
            </Link>
          ),
        )}
      </nav>
      {current && (
        <div className="tab-panel" role="tabpanel" data-testid={`tab-${current}`}>
          {current === "versions" && (
            <VersionsPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "values" && (
            <ValuesPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "similar" && (
            <SimilarPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "resources" && <ResourcesPanel entry={entry} />}
          {current === "comments" && <Comments entry={entry} />}
        </div>
      )}
    </section>
  );
}

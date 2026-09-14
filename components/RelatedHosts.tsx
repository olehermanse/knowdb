import Image from "next/image";
import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import {
  describeEntry,
  similarEntries,
  TYPE_LABELS,
  aggregatePorts,
  aggregateVersions,
  Entry,
  entryHref,
  filterSearchHref,
  getPortInfo,
  versionEntryName,
} from "@/lib/data";

// The entry's own tabs, shown on the left of an entry page: versions (for
// software), the ports its hosts listen on, and similar entries.
export type Tab = "versions" | "ports" | "similar";
const TAB_ORDER: Tab[] = ["versions", "ports", "similar"];

export function parseTab(raw: string | string[] | undefined): Tab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TAB_ORDER as string[]).includes(value ?? "") ? (value as Tab) : undefined;
}

// Versions only for software; ports unless the entry is a port or matches
// a single host (whose ports are already shown in the host view).
export function entryTabs(entry: Entry): Tab[] {
  const tabs: Tab[] = [];
  if (entry.type === "software") tabs.push("versions");
  if (entry.type !== "port" && entry.hosts.length > 1) tabs.push("ports");
  tabs.push("similar");
  return tabs;
}

// Link to a tab; the first tab needs no query parameter.
export function tabHref(entry: Entry, tabs: Tab[], tab: Tab): string {
  return tab === tabs[0] ? entryHref(entry) : `${entryHref(entry)}?tab=${tab}`;
}

function hostsLabel(n: number): string {
  return `${n} ${n === 1 ? "host" : "hosts"}`;
}

// "22 (ssh, 50 hosts)": the port number links to the port, the number of
// hosts links to a search for exactly those hosts.
function AggregatedPort({
  entry,
  port,
  hosts,
}: {
  entry: Entry;
  port: number;
  hosts: number;
}) {
  const info = getPortInfo(port);
  const searchHref = filterSearchHref([
    { type: "port", name: String(port) },
    { type: entry.type, name: entry.name },
  ]);
  return (
    <li className="host-item" data-testid="aggregated-port">
      <span className="type-badge">port</span>
      {info?.logo && (
        <Image
          className="list-logo"
          src={info.logo}
          alt={`${info.name} logo`}
          width={32}
          height={32}
          unoptimized
          data-testid="port-logo"
        />
      )}
      <div className="host-summary">
        <div>
          <EntryLink type="port" name={String(port)} />
          {info && <span className="muted"> ({info.name})</span>}
        </div>
        <div className="muted host-facts">
          <Link href={searchHref} className="entry-link" data-testid="port-hosts-link">
            {hostsLabel(hosts)}
          </Link>
        </div>
      </div>
    </li>
  );
}

// Versions of a piece of software, one card per version, most hosts first.
function VersionsPanel({ entry }: { entry: Entry }) {
  const versions = aggregateVersions(entry.name, entry.hosts);
  return (
    <>
      <p className="muted" data-testid="versions-description">
        Versions of {entry.name} in your infrastructure:
      </p>
      {versions.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="versions">
        {versions.map(({ version, hosts }) => {
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
    </>
  );
}

function portsDescription(entry: Entry): string {
  switch (entry.type) {
    case "software":
      return `The ${entry.name} hosts are listening to these ports:`;
    case "version":
      return `The hosts with ${entry.name} are listening to these ports:`;
    case "os":
    case "class":
      return `The ${entry.name} hosts are listening to these ports:`;
    case "cloud":
      return `The hosts on ${entry.name} are listening to these ports:`;
    default:
      return "The hosts are listening to these ports:";
  }
}

// Entries of the same type with similar names, longest shared prefix first.
function SimilarPanel({ entry }: { entry: Entry }) {
  const similar = similarEntries(entry);
  return (
    <>
      <p className="muted" data-testid="similar-description">
        {entry.type === "ip" || entry.type === "mac"
          ? `Other similar ${TYPE_LABELS[entry.type]}:`
          : `Other ${TYPE_LABELS[entry.type].toLowerCase()} with similar names:`}
      </p>
      <ul className="entry-list" data-testid="similar">
        {similar.map(({ entry: e, common }) => (
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
    </>
  );
}

// The ports the related hosts listen on, one card per port, ascending.
function PortsPanel({ entry }: { entry: Entry }) {
  const ports = aggregatePorts(entry.hosts);
  return (
    <>
      <p className="muted" data-testid="ports-description">
        {portsDescription(entry)}
      </p>
      {ports.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="aggregated-ports">
        {ports.map(({ port, hosts }) => (
          <AggregatedPort key={port} entry={entry} port={port} hosts={hosts} />
        ))}
      </ul>
    </>
  );
}

export default function RelatedHosts({
  entry,
  tabs,
  tab,
  testId,
}: {
  entry: Entry;
  tabs: Tab[];
  tab?: Tab;
  testId: string;
}) {
  const similarCount = similarEntries(entry).length;
  // Tabs with nothing to show are disabled: visible, gray, not clickable.
  const disabled = new Set<Tab>(similarCount === 0 ? ["similar"] : []);
  const enabled = tabs.filter((t) => !disabled.has(t));
  const current = tab && enabled.includes(tab) ? tab : enabled[0];
  const counts: Record<Tab, number> = {
    similar: similarCount,
    versions: entry.type === "software" ? aggregateVersions(entry.name, entry.hosts).length : 0,
    ports: aggregatePorts(entry.hosts).length,
  };
  const labels: Record<Tab, string> = { versions: "Versions", ports: "Ports", similar: "Similar" };
  const testIds: Record<Tab, string> = {
    versions: "versions-heading",
    ports: "ports-heading",
    similar: "similar-heading",
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
              href={tabHref(entry, tabs, t)}
              role="tab"
              aria-selected={t === current}
              className={`tab${t === current ? " tab-current" : ""}`}
              data-testid={testIds[t]}
            >
              {labels[t]} <span className="muted">({counts[t]})</span>
            </Link>
          ),
        )}
      </nav>
      {current && (
        <div className="tab-panel" role="tabpanel" data-testid={`tab-${current}`}>
          {current === "versions" && <VersionsPanel entry={entry} />}
          {current === "ports" && <PortsPanel entry={entry} />}
          {current === "similar" && <SimilarPanel entry={entry} />}
        </div>
      )}
    </section>
  );
}

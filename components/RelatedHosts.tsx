import Image from "next/image";
import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import HostList from "@/components/HostList";
import CloudProviders from "@/components/CloudProviders";
import OperatingSystems from "@/components/OperatingSystems";
import {
  aggregateClouds,
  aggregateOs,
  describeEntry,
  similarEntries,
  TYPE_LABELS,
  aggregatePorts,
  aggregateVersions,
  Entry,
  entryHref,
  filterSearchHref,
  getHost,
  getPortInfo,
  Host,
  parseVersionEntryName,
  versionEntryName,
} from "@/lib/data";

// Tabs of an entry page. The entry's own tabs (versions, ports, similar)
// sit on the left; the tabs about its hosts (hosts, operating systems,
// clouds) on the right, when it matches more than one host.
export type Tab = "versions" | "os" | "clouds" | "ports" | "hosts" | "similar";
const TAB_ORDER: Tab[] = ["versions", "os", "clouds", "ports", "hosts", "similar"];

export function parseTab(raw: string | string[] | undefined): Tab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TAB_ORDER as string[]).includes(value ?? "") ? (value as Tab) : undefined;
}

// Left side of an entry page: the entry's own tabs. Versions only for
// software; ports unless the entry is a port or matches a single host
// (whose ports are already shown in the host view on the right).
export function leftTabs(entry: Entry): Tab[] {
  const tabs: Tab[] = [];
  if (entry.type === "software") tabs.push("versions");
  if (entry.type !== "port" && entry.hosts.length > 1) tabs.push("ports");
  tabs.push("similar");
  return tabs;
}

// Right side: the hosts, and what they run, when there are several.
export function rightTabs(entry: Entry): Tab[] {
  if (entry.hosts.length <= 1) return [];
  const tabs: Tab[] = ["hosts"];
  if (entry.type !== "os") tabs.push("os");
  if (entry.type !== "cloud") tabs.push("clouds");
  return tabs;
}

export type TabParam = "tab" | "htab";
export interface TabQuery {
  tab?: Tab;
  htab?: Tab;
}

// Link to a tab of an entry, keeping the other side's tab. The first tab
// of a side needs no query parameter.
export function tabHref(
  entry: Entry,
  tabs: Tab[],
  param: TabParam,
  query: TabQuery,
  tab: Tab,
  page = 1,
): string {
  const params = new URLSearchParams();
  const next: TabQuery = { ...query, [param]: tab };
  if (next.tab && next.tab !== leftTabs(entry)[0]) params.set("tab", next.tab);
  if (next.htab && next.htab !== rightTabs(entry)[0]) params.set("htab", next.htab);
  if (page > 1) params.set("page", String(page));
  const q = params.toString();
  return `${entryHref(entry)}${q ? `?${q}` : ""}`;
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

// One sentence explaining how the listed hosts relate to the entry.
function describeLinkedHosts(entry: Entry): string {
  switch (entry.type) {
    case "hostname":
      return `Hosts with the hostname ${entry.name}:`;
    case "os":
      return `Hosts running ${entry.name}:`;
    case "ip":
      return `Hosts with the IP address ${entry.name}:`;
    case "mac":
      return `Hosts with a network interface with the MAC address ${entry.name}:`;
    case "port":
      return `Hosts listening on port ${entry.name}:`;
    case "software":
      return `Hosts with ${entry.name} installed:`;
    case "user":
      return `Hosts with a local user named ${entry.name}:`;
    case "group":
      return `Hosts in the group ${entry.name}:`;
    case "class":
      return `Hosts with the class ${entry.name} set:`;
    case "cloud":
      return `Hosts running on ${entry.name}:`;
    case "version": {
      const { software, version } = parseVersionEntryName(entry.name);
      return `Hosts with ${software} version ${version} installed:`;
    }
    default:
      return `Hosts linked to ${entry.name}:`;
  }
}

function HostsPanel({
  entry,
  page,
  tabs,
  param,
  query,
}: {
  entry: Entry;
  page: number;
  tabs: Tab[];
  param: TabParam;
  query: TabQuery;
}) {
  const hosts = entry.hosts
    .map((hostkey) => getHost(hostkey))
    .filter((host): host is Host => host !== undefined);
  return (
    <>
      <p className="muted" data-testid="hosts-description">
        {describeLinkedHosts(entry)}
      </p>
      <HostList
        hosts={hosts}
        page={page}
        hrefForPage={(n) => tabHref(entry, tabs, param, query, "hosts", n)}
      />
    </>
  );
}


export default function RelatedHosts({
  entry,
  tabs,
  param,
  query,
  page,
  testId,
}: {
  entry: Entry;
  tabs: Tab[];
  param: TabParam;
  query: TabQuery;
  page: number;
  testId: string;
}) {
  const similarCount = similarEntries(entry).length;
  // Tabs with nothing to show are disabled: visible, gray, not clickable.
  const disabled = new Set<Tab>(similarCount === 0 ? ["similar"] : []);
  const requested = query[param];
  const enabled = tabs.filter((t) => !disabled.has(t));
  const current = requested && enabled.includes(requested) ? requested : enabled[0];
  const counts: Record<Tab, number> = {
    similar: similarCount,
    versions: entry.type === "software" ? aggregateVersions(entry.name, entry.hosts).length : 0,
    os: aggregateOs(entry.hosts).length,
    clouds: aggregateClouds(entry.hosts).length,
    ports: aggregatePorts(entry.hosts).length,
    hosts: entry.hosts.length,
  };
  const labels: Record<Tab, string> = {
    versions: "Versions",
    os: "Operating systems",
    clouds: "Clouds",
    ports: "Ports",
    hosts: "Hosts",
    similar: "Similar",
  };
  const testIds: Record<Tab, string> = {
    versions: "versions-heading",
    os: "os-heading",
    clouds: "clouds-heading",
    ports: "ports-heading",
    hosts: "hosts-heading",
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
              href={tabHref(entry, tabs, param, query, t)}
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
          {current === "os" && <OperatingSystems entry={entry} />}
          {current === "clouds" && <CloudProviders entry={entry} />}
          {current === "ports" && <PortsPanel entry={entry} />}
          {current === "hosts" && (
            <HostsPanel entry={entry} page={page} tabs={tabs} param={param} query={query} />
          )}
          {current === "similar" && <SimilarPanel entry={entry} />}
        </div>
      )}
    </section>
  );
}

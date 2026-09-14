import Image from "next/image";
import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import HostList from "@/components/HostList";
import OperatingSystems from "@/components/OperatingSystems";
import {
  aggregateOs,
  aggregatePorts,
  aggregateVersions,
  describeEntry,
  Entry,
  entryHref,
  filterSearchHref,
  getHost,
  getPortInfo,
  Host,
  parseVersionEntryName,
  versionEntryName,
} from "@/lib/data";

// The hosts related to an entry, in three tabs: the operating systems they
// run (pie chart), the ports they listen on, and the paginated host list.
// The operating systems tab is hidden on OS pages and the ports tab on
// port pages, where it would only repeat the entry itself.
export type Tab = "versions" | "os" | "ports" | "hosts";
const TAB_ORDER: Tab[] = ["versions", "os", "ports", "hosts"];

export function parseTab(raw: string | string[] | undefined): Tab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TAB_ORDER as string[]).includes(value ?? "") ? (value as Tab) : undefined;
}

// The versions tab exists only for software; the operating systems tab is
// hidden on OS pages and the ports tab on port pages.
export function visibleTabs(entry: Entry): Tab[] {
  return TAB_ORDER.filter(
    (tab) =>
      !(tab === "versions" && entry.type !== "software") &&
      !(tab === "os" && entry.type === "os") &&
      !(tab === "ports" && entry.type === "port"),
  );
}

// Link to a tab of an entry; the first visible tab needs no query.
export function tabHref(entry: Entry, tab: Tab, page = 1): string {
  const params = new URLSearchParams();
  if (tab !== visibleTabs(entry)[0]) params.set("tab", tab);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `${entryHref(entry)}${query ? `?${query}` : ""}`;
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
        Versions of {entry.name} installed on the hosts:
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

// The ports the related hosts listen on, one card per port, ascending.
function PortsPanel({ entry }: { entry: Entry }) {
  const ports = aggregatePorts(entry.hosts);
  return (
    <>
      <p className="muted" data-testid="ports-description">
        The hosts are listening to these ports:
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
      return `Hosts with the hostname ${entry.name}.`;
    case "os":
      return `Hosts running ${entry.name}.`;
    case "ip":
      return `Hosts with the IP address ${entry.name}.`;
    case "mac":
      return `Hosts with a network interface with the MAC address ${entry.name}.`;
    case "port":
      return `Hosts listening on port ${entry.name}.`;
    case "software":
      return `Hosts with ${entry.name} installed.`;
    case "user":
      return `Hosts with a local user named ${entry.name}.`;
    case "group":
      return `Hosts in the group ${entry.name}.`;
    case "class":
      return `Hosts with the class ${entry.name} set.`;
    case "version": {
      const { software, version } = parseVersionEntryName(entry.name);
      return `Hosts with ${software} version ${version} installed.`;
    }
    default:
      return `Hosts linked to ${entry.name}.`;
  }
}

function HostsPanel({ entry, page }: { entry: Entry; page: number }) {
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
        hrefForPage={(n) => tabHref(entry, "hosts", n)}
      />
    </>
  );
}


export default function RelatedHosts({
  entry,
  tab,
  page,
}: {
  entry: Entry;
  tab?: Tab;
  page: number;
}) {
  const tabs = visibleTabs(entry);
  const current = tab && tabs.includes(tab) ? tab : tabs[0];
  const counts: Record<Tab, number> = {
    versions: entry.type === "software" ? aggregateVersions(entry.name, entry.hosts).length : 0,
    os: aggregateOs(entry.hosts).length,
    ports: aggregatePorts(entry.hosts).length,
    hosts: entry.hosts.length,
  };
  const labels: Record<Tab, string> = {
    versions: "Versions",
    os: "Operating systems",
    ports: "Ports",
    hosts: "Hosts",
  };
  const testIds: Record<Tab, string> = {
    versions: "versions-heading",
    os: "os-heading",
    ports: "ports-heading",
    hosts: "hosts-heading",
  };
  return (
    <section className="related-hosts" data-testid="related-hosts">
      <nav className="tabs" role="tablist" aria-label="Related hosts">
        {tabs.map((t) => (
          <Link
            key={t}
            href={tabHref(entry, t)}
            role="tab"
            aria-selected={t === current}
            className={`tab${t === current ? " tab-current" : ""}`}
            data-testid={testIds[t]}
          >
            {labels[t]} <span className="muted">({counts[t]})</span>
          </Link>
        ))}
      </nav>
      <div className="tab-panel" role="tabpanel" data-testid={`tab-${current}`}>
        {current === "versions" && <VersionsPanel entry={entry} />}
        {current === "os" && <OperatingSystems entry={entry} />}
        {current === "ports" && <PortsPanel entry={entry} />}
        {current === "hosts" && <HostsPanel entry={entry} page={page} />}
      </div>
    </section>
  );
}

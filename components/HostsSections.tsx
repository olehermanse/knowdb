import Link from "next/link";
import CloudProviders from "@/components/CloudProviders";
import HostList from "@/components/HostList";
import OperatingSystems from "@/components/OperatingSystems";
import {
  aggregateClouds,
  aggregateOs,
  Entry,
  entryHref,
  getHost,
  Host,
  parseVersionEntryName,
} from "@/lib/data";

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
      return `Hosts running in ${entry.name}:`;
    case "version": {
      const { software, version } = parseVersionEntryName(entry.name);
      return `Hosts with ${software} version ${version} installed:`;
    }
    default:
      return `Hosts linked to ${entry.name}:`;
  }
}


export type HostsTab = "charts" | "list";

// Cookie remembering the last chosen tab, so the choice follows the user
// from entry to entry. Set by the small script in the layout when a tab is
// clicked; read by the entry page when the URL does not say otherwise.
export const HOSTS_TAB_COOKIE = "hosts-tab";

export function parseHostsTab(raw: string | string[] | undefined): HostsTab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "charts" || value === "list" ? value : undefined;
}

// The right side of an entry page when it matches several hosts: a
// "Hosts" heading and two tabs. "Charts" (the default) holds the operating
// systems and cloud provider pie charts, each skipped when there is only
// one option; "List" holds the paginated list of the hosts. With nothing
// to chart, Charts is disabled and List is shown.
export default function HostsSections({
  entry,
  page,
  tab,
  keep = {},
}: {
  entry: Entry;
  page: number;
  tab?: HostsTab;
  // The left side's query parameters (tab, tpage), kept when switching here.
  keep?: Record<string, string | undefined>;
}) {
  const hosts = entry.hosts
    .map((hostkey) => getHost(hostkey))
    .filter((host): host is Host => host !== undefined);
  const osCount = aggregateOs(entry.hosts).length;
  const cloudCount = aggregateClouds(entry.hosts).length;
  const charts = (osCount > 1 ? 1 : 0) + (cloudCount > 1 ? 1 : 0);
  const current: HostsTab = charts === 0 ? "list" : tab ?? "charts";
  const href = (t: HostsTab, n = 1) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
    if (t !== "charts") params.set("htab", t);
    if (n > 1) params.set("page", String(n));
    const q = params.toString();
    return `${entryHref(entry)}${q ? `?${q}` : ""}`;
  };
  const tabClass = (t: HostsTab) => `tab${t === current ? " tab-current" : ""}`;
  return (
    <section className="hosts-sections" data-testid="hosts-sections">
      <h2 data-testid="hosts-heading">
        Hosts <span className="muted">({entry.hosts.length})</span>
      </h2>
      <nav className="tabs" role="tablist" aria-label="Hosts">
        {charts === 0 ? (
          <span
            role="tab"
            aria-selected={false}
            aria-disabled="true"
            className="tab tab-disabled"
            data-testid="charts-tab"
          >
            Charts <span className="muted">(0)</span>
          </span>
        ) : (
          <Link
            href={href("charts")}
            role="tab"
            aria-selected={current === "charts"}
            className={tabClass("charts")}
            data-hosts-tab="charts"
            data-testid="charts-tab"
          >
            Charts <span className="muted">({charts})</span>
          </Link>
        )}
        <Link
          href={href("list")}
          role="tab"
          aria-selected={current === "list"}
          className={tabClass("list")}
          data-hosts-tab="list"
          data-testid="list-tab"
        >
          List <span className="muted">({entry.hosts.length})</span>
        </Link>
      </nav>
      {current === "charts" && (
        <div className="tab-panel" role="tabpanel" data-testid="tab-charts">
          {osCount > 1 && (
            <section data-testid="section-os">
              <h3 data-testid="os-heading">
                Operating systems <span className="muted">({osCount})</span>
              </h3>
              <OperatingSystems entry={entry} />
            </section>
          )}
          {cloudCount > 1 && (
            <section data-testid="section-clouds">
              <h3 data-testid="clouds-heading">
                Clouds <span className="muted">({cloudCount})</span>
              </h3>
              <CloudProviders entry={entry} />
            </section>
          )}
        </div>
      )}
      {current === "list" && (
        <div className="tab-panel" role="tabpanel" data-testid="section-list">
          <p className="muted" data-testid="hosts-description">
            {describeLinkedHosts(entry)}
          </p>
          <HostList hosts={hosts} page={page} hrefForPage={(n) => href("list", n)} />
        </div>
      )}
    </section>
  );
}

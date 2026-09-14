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
      return `Hosts running on ${entry.name}:`;
    case "version": {
      const { software, version } = parseVersionEntryName(entry.name);
      return `Hosts with ${software} version ${version} installed:`;
    }
    default:
      return `Hosts linked to ${entry.name}:`;
  }
}


// The right side of an entry page when it matches several hosts: a
// "Hosts" heading with sections for the operating systems and cloud
// providers they run (skipped when there is only one option) and the
// paginated list of the hosts.
export default function HostsSections({ entry, page }: { entry: Entry; page: number }) {
  const hosts = entry.hosts
    .map((hostkey) => getHost(hostkey))
    .filter((host): host is Host => host !== undefined);
  const osCount = aggregateOs(entry.hosts).length;
  const cloudCount = aggregateClouds(entry.hosts).length;
  return (
    <section className="hosts-sections" data-testid="hosts-sections">
      <h2 data-testid="hosts-heading">
        Hosts <span className="muted">({entry.hosts.length})</span>
      </h2>
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
      <section data-testid="section-list">
        <h3 data-testid="list-heading">List</h3>
        <p className="muted" data-testid="hosts-description">
          {describeLinkedHosts(entry)}
        </p>
        <HostList
          hosts={hosts}
          page={page}
          hrefForPage={(n) => `${entryHref(entry)}${n > 1 ? `?page=${n}` : ""}`}
        />
      </section>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import Pagination, { paginate } from "@/components/Pagination";
import {
  aggregatePorts,
  Entry,
  filterSearchHref,
  getPortInfo,
  parseValueEntryName,
} from "@/lib/data";

export function hostsLabel(n: number): string {
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

function portsDescription(entry: Entry): string {
  switch (entry.type) {
    case "software":
      return `The ${entry.name} hosts are listening to these ports:`;
    case "service":
      return `The hosts running ${entry.name} are listening to these ports:`;
    case "user":
      return `The hosts with the ${entry.name} user are listening to these ports:`;
    case "version":
      return `The hosts with ${entry.name} are listening to these ports:`;
    case "os":
    case "class":
      return `The ${entry.name} hosts are listening to these ports:`;
    case "cloud":
      return `The hosts in ${entry.name} are listening to these ports:`;
    case "role":
      return `The CFEngine ${entry.name.toLowerCase()}s are listening to these ports:`;
    case "variable":
      return `The hosts defining ${entry.name} are listening to these ports:`;
    case "value": {
      const { variable, value } = parseValueEntryName(entry.name);
      return `The hosts where ${variable} is ${value} are listening to these ports:`;
    }
    default:
      return "The hosts are listening to these ports:";
  }
}

// "Ports" tab on the right of an entry page: the ports the entry's hosts
// listen on, one card per port, ascending, paginated.
export default function PortsSection({
  entry,
  page,
  hrefForPage,
}: {
  entry: Entry;
  page: number;
  hrefForPage: (page: number) => string;
}) {
  const ports = aggregatePorts(entry.hosts);
  const paged = paginate(ports, page);
  return (
    <>
      <p className="muted" data-testid="ports-description">
        {portsDescription(entry)}
      </p>
      <ul className="entry-list" data-testid="aggregated-ports">
        {paged.shown.map(({ port, hosts }) => (
          <AggregatedPort key={port} entry={entry} port={port} hosts={hosts} />
        ))}
      </ul>
      <Pagination
        total={ports.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="ports"
        hrefForPage={hrefForPage}
      />
    </>
  );
}

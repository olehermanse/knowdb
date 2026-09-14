import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import EntryLink from "@/components/EntryLink";
import OsPieChart from "@/components/OsPieChart";
import {
  AGGREGATING_TYPES,
  aggregateOs,
  aggregatePorts,
  describeEntry,
  Entry,
  entryHref,
  getEntry,
  getGroup,
  getHost,
  getHostGroups,
  getPortInfo,
  Group,
  Host,
  isEntryType,
  uniqueHostForHostname,
} from "@/lib/data";

// "22 (ssh)" for well-known ports, just the number otherwise.
function portLabel(port: number): string {
  const info = getPortInfo(port);
  return info ? `${port} (${info.name})` : String(port);
}

function HostDetails({ host }: { host: Host }) {
  const groups = getHostGroups(host.id);
  return (
    <dl className="host-details" data-testid="host-details">
      <dt>Hostname</dt>
      <dd>
        <EntryLink type="hostname" name={host.hostname} />
      </dd>
      <dt>Operating system</dt>
      <dd>
        <EntryLink type="os" name={host.os} />
      </dd>
      <dt>IP addresses</dt>
      <dd className="inline-links">
        {host.ips.map((ip) => (
          <EntryLink key={ip} type="ip" name={ip} />
        ))}
      </dd>
      <dt>Listening ports</dt>
      <dd className="inline-links">
        {host["ports-listening"].map((port) => (
          <EntryLink
            key={port}
            type="port"
            name={String(port)}
            label={portLabel(port)}
          />
        ))}
      </dd>
      <dt>Software</dt>
      <dd className="inline-links">
        {host.software.map((sw) => (
          <EntryLink key={sw} type="software" name={sw} />
        ))}
      </dd>
      <dt>Local users</dt>
      <dd className="inline-links">
        {host["local-users"].map((user) => (
          <EntryLink key={user} type="user" name={user} />
        ))}
      </dd>
      <dt>Groups</dt>
      <dd className="inline-links" data-testid="host-groups">
        {groups.length === 0 && <span className="muted">None</span>}
        {groups.map((group) => (
          <EntryLink key={group} type="group" name={group} />
        ))}
      </dd>
    </dl>
  );
}

// The matching rules of a group, so a user can see why hosts are in it.
function GroupRules({ group }: { group: Group }) {
  const rules: { field: string; substrings: string[] }[] = [];
  if (group.match.os) rules.push({ field: "OS", substrings: group.match.os });
  if (group.match.hostname)
    rules.push({ field: "Hostname", substrings: group.match.hostname });
  return (
    <dl className="host-details" data-testid="group-rules">
      {rules.map(({ field, substrings }) => (
        <Fragment key={field}>
          <dt>{field} contains</dt>
          <dd className="inline-links">
            {substrings.map((s) => (
              <code key={s}>{s}</code>
            ))}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function OperatingSystems({ entry }: { entry: Entry }) {
  const counts = aggregateOs(entry.hosts);
  return (
    <>
      <h2 data-testid="os-heading">
        Operating systems <span className="muted">({counts.length})</span>
      </h2>
      <p className="muted">
        Operating systems of the hosts in this group, most hosts first.
      </p>
      <OsPieChart counts={counts} subject="This group" />
    </>
  );
}

// "22 (ssh, 50 hosts)", or "8080 (50 hosts)" for ports without a known name.
function aggregatedPortLabel(port: number, hosts: number): string {
  const info = getPortInfo(port);
  const count = `${hosts} ${hosts === 1 ? "host" : "hosts"}`;
  return info ? `${port} (${info.name}, ${count})` : `${port} (${count})`;
}

function AggregatedPorts({ entry }: { entry: Entry }) {
  const ports = aggregatePorts(entry.hosts);
  return (
    <>
      <h2 data-testid="ports-heading">
        Ports <span className="muted">({ports.length})</span>
      </h2>
      <p className="muted">
        Ports the hosts below are listening on, with the number of hosts
        listening on each.
      </p>
      <div className="inline-links" data-testid="aggregated-ports">
        {ports.length === 0 && <span className="muted">None</span>}
        {ports.map(({ port, hosts }) => (
          <EntryLink
            key={port}
            type="port"
            name={String(port)}
            label={aggregatedPortLabel(port, hosts)}
          />
        ))}
      </div>
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
    case "port":
      return `Hosts listening on port ${entry.name}.`;
    case "software":
      return `Hosts with ${entry.name} installed.`;
    case "user":
      return `Hosts with a local user named ${entry.name}.`;
    case "group":
      return `Hosts in the group ${entry.name}.`;
    default:
      return `Hosts linked to ${entry.name}.`;
  }
}

function LinkedHosts({ entry }: { entry: Entry }) {
  return (
    <>
      <h2 data-testid="hosts-heading">
        Hosts <span className="muted">({entry.hosts.length})</span>
      </h2>
      <p className="muted" data-testid="hosts-description">
        {describeLinkedHosts(entry)}
      </p>
      <ul className="entry-list" data-testid="linked-hosts">
        {entry.hosts.map((hostkey) => {
          const host = getHost(hostkey);
          return (
            <li key={hostkey}>
              <span className="type-badge">host</span>
              <span>
                {host && <>{host.hostname} — </>}
                <EntryLink type="host" name={hostkey} />
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default async function EntryPage({
  params,
}: PageProps<"/entry/[type]/[name]">) {
  const { type, name: encodedName } = await params;
  const name = decodeURIComponent(encodedName);
  if (!isEntryType(type)) notFound();
  const entry = getEntry(type, name);
  if (!entry) notFound();

  // A hostname with exactly one host is the same thing as that host.
  if (type === "hostname") {
    const hostkey = uniqueHostForHostname(name);
    if (hostkey) redirect(entryHref({ type: "host", name: hostkey }));
  }

  const host = type === "host" ? getHost(name) : undefined;
  const group = type === "group" ? getGroup(name) : undefined;

  return (
    <>
      <p>
        <span className="type-badge">{entry.type}</span>
      </p>
      <h1 data-testid="entry-name">
        {host ? (
          <>
            {host.hostname}{" "}
            <span className="muted host-id">({host.id})</span>
          </>
        ) : (
          entry.name
        )}
      </h1>
      <p className="muted" data-testid="entry-description">
        {describeEntry(entry)}
      </p>
      {group && <GroupRules group={group} />}
      {group && <OperatingSystems entry={entry} />}
      {AGGREGATING_TYPES.includes(type) && <AggregatedPorts entry={entry} />}
      {host ? <HostDetails host={host} /> : <LinkedHosts entry={entry} />}
    </>
  );
}

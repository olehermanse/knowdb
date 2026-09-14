import { notFound } from "next/navigation";
import EntryLink from "@/components/EntryLink";
import {
  describeEntry,
  Entry,
  getEntry,
  getHost,
  Host,
  isEntryType,
} from "@/lib/data";

function HostDetails({ host }: { host: Host }) {
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
          <EntryLink key={port} type="port" name={String(port)} />
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
    </dl>
  );
}

function LinkedHosts({ entry }: { entry: Entry }) {
  return (
    <>
      <h2>
        Linked hosts <span className="muted">({entry.hosts.length})</span>
      </h2>
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

  const host = type === "host" ? getHost(name) : undefined;

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
      {host ? <HostDetails host={host} /> : <LinkedHosts entry={entry} />}
    </>
  );
}

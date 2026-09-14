import { Fragment } from "react";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import EntryLink from "@/components/EntryLink";
import HostAvatar from "@/components/HostAvatar";
import { parsePage } from "@/components/HostList";
import RelatedHosts, { parseTab } from "@/components/RelatedHosts";
import {
  describeEntry,
  Entry,
  entryHref,
  externalLinkLabel,
  getEntry,
  getEntryLinks,
  getEntryLogo,
  getGroup,
  getHost,
  getHostGroups,
  getPortInfo,
  getSeeAlso,
  Group,
  Host,
  isEntryType,
  seeAlsoLabel,
  summarizeEntry,
  uniqueHostForHostname,
  versionEntryName,
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
      <dt>MAC addresses</dt>
      <dd className="inline-links">
        {host.macs.map((mac) => (
          <EntryLink key={mac} type="mac" name={mac} />
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
      <dd className="inline-links" data-testid="host-software">
        {host.software.map((sw) => {
          const version = host["software-versions"]?.[sw];
          return (
            <span key={sw} className="software-with-version">
              <EntryLink type="software" name={sw} />
              {version && (
                <>
                  {" "}
                  <EntryLink
                    type="version"
                    name={versionEntryName(sw, version)}
                    label={version}
                  />
                </>
              )}
            </span>
          );
        })}
      </dd>
      <dt>Local users</dt>
      <dd className="inline-links">
        {host["local-users"].map((user) => (
          <EntryLink key={user} type="user" name={user} />
        ))}
      </dd>
      <dt>Classes</dt>
      <dd className="inline-links" data-testid="host-classes">
        {host.classes.map((cls) => (
          <EntryLink key={cls} type="class" name={cls} />
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

// Related entries, e.g. the port a piece of software listens on.
function SeeAlso({ entry }: { entry: Entry }) {
  const related = getSeeAlso(entry);
  if (related.length === 0) return null;
  return (
    <p className="see-also" data-testid="see-also">
      <span className="muted">See also:</span>{" "}
      {related.map((ref, i) => (
        <span key={`${ref.type}:${ref.name}`}>
          {i > 0 && ", "}
          <EntryLink type={ref.type} name={ref.name} label={seeAlsoLabel(ref)} />
        </span>
      ))}
    </p>
  );
}

// External links (Wikipedia etc.) from info.json, if the entry has any.
function ExternalLinks({ entry }: { entry: Entry }) {
  const links = getEntryLinks(entry);
  if (links.length === 0) return null;
  return (
    <p className="external-links" data-testid="external-links">
      <span className="muted">Read more:</span>{" "}
      {links.map((link, i) => (
        <span key={link.url}>
          {i > 0 && ", "}
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {externalLinkLabel(link)}
          </a>
        </span>
      ))}
    </p>
  );
}

export default async function EntryPage({
  params,
  searchParams,
}: PageProps<"/entry/[type]/[name]">) {
  const { type, name: encodedName } = await params;
  const query = await searchParams;
  const page = parsePage(query.page);
  const tab = parseTab(query.tab);
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
  const logo = getEntryLogo(entry);
  const portName = type === "port" ? getPortInfo(name)?.name : undefined;
  const summary = summarizeEntry(entry);

  return (
    <>
      <p>
        <span className="type-badge">{entry.type}</span>
      </p>
      <div className="entry-title">
        {host && <HostAvatar host={host} size={48} />}
        {logo && (
          <Image
            className="entry-logo"
            src={logo}
            alt={`${entry.name} logo`}
            width={40}
            height={40}
            unoptimized
            data-testid="entry-logo"
          />
        )}
        <h1 data-testid="entry-name">
          {host ? (
            <>
              {host.hostname}{" "}
              <span className="muted host-id">({host.id})</span>
            </>
          ) : type === "port" && portName ? (
            <>
              {entry.name} <span className="muted">({portName})</span>
            </>
          ) : (
            entry.name
          )}
        </h1>
      </div>
      <SeeAlso entry={entry} />
      <p className="muted" data-testid="entry-description">
        {describeEntry(entry)}
      </p>
      {summary && <p data-testid="entry-summary">{summary}</p>}
      <ExternalLinks entry={entry} />
      {group && <GroupRules group={group} />}
      {host ? (
        <HostDetails host={host} />
      ) : (
        <RelatedHosts entry={entry} tab={tab} page={page} />
      )}
    </>
  );
}

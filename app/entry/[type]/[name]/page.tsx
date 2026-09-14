import { Fragment } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import EntryLink from "@/components/EntryLink";
import HostView from "@/components/HostView";
import Timestamp from "@/components/Timestamp";
import { parsePage } from "@/components/HostList";
import { cookies } from "next/headers";
import HostsSections, { HOSTS_TAB_COOKIE, parseHostsTab } from "@/components/HostsSections";
import RelatedHosts, { entryTabs, parseTab } from "@/components/RelatedHosts";
import {
  describeEntry,
  Entry,
  entrySeen,
  externalLinkLabel,
  getEntry,
  getEntryLinks,
  getEntryLogo,
  getGroup,
  getHost,
  getPortInfo,
  getSeeAlso,
  Group,
  isEntryType,
  seeAlsoLabel,
  summarizeEntry,
} from "@/lib/data";

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
  const tabPage = parsePage(query.tpage);
  const tab = parseTab(query.tab);
  // The URL wins; otherwise the tab chosen last time, remembered in a cookie.
  const htab =
    parseHostsTab(query.htab) ?? parseHostsTab((await cookies()).get(HOSTS_TAB_COOKIE)?.value);
  const name = decodeURIComponent(encodedName);
  if (!isEntryType(type)) notFound();
  const entry = getEntry(type, name);
  if (!entry) notFound();


  const host = type === "host" ? getHost(name) : undefined;
  const group = type === "group" ? getGroup(name) : undefined;
  const logo = getEntryLogo(entry);
  const portName = type === "port" ? getPortInfo(name)?.name : undefined;
  const summary = summarizeEntry(entry);
  const seen = entrySeen(entry);

  if (host) {
    return (
      <>
        <p>
          <span className="type-badge">host</span>
        </p>
        <HostView host={host} />
      </>
    );
  }

  // Everything else: the title above, then two panes. The entry's own
  // information and tabs on the left; its host(s) on the right. A single
  // matching host is shown as the host view itself; several hosts get the
  // Hosts sections.
  const singleHost = entry.hosts.length === 1 ? getHost(entry.hosts[0]) : undefined;
  return (
    <>
      <header className="entry-header" data-testid="entry-header">
        <p>
          <span className="type-badge">{entry.type}</span>
        </p>
        <div className="entry-title">
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
            {type === "port" && portName ? (
              <>
                {entry.name} <span className="muted">({portName})</span>
              </>
            ) : (
              entry.name
            )}
          </h1>
        </div>
      </header>
      <div className="entry-split">
        <div className="entry-pane entry-pane-left" data-testid="entry-pane">
          <SeeAlso entry={entry} />
          <p className="muted" data-testid="entry-description">
            {describeEntry(entry)}
          </p>
          {summary && <p data-testid="entry-summary">{summary}</p>}
          {seen && (
            <p className="muted" data-testid="entry-seen">
              First seen <Timestamp iso={seen.first} testId="entry-first-seen" />, last seen{" "}
              <Timestamp iso={seen.last} testId="entry-last-seen" />.
            </p>
          )}
          <ExternalLinks entry={entry} />
          {group && <GroupRules group={group} />}
          <RelatedHosts
            entry={entry}
            tabs={entryTabs(entry)}
            tab={tab}
            page={tabPage}
            testId="entry-tabs"
          />
        </div>
        <aside className="entry-pane entry-pane-right" data-testid="hosts-pane">
          {singleHost ? (
            <HostView host={singleHost} embedded />
          ) : entry.hosts.length > 1 ? (
            <HostsSections entry={entry} page={page} tab={htab} />
          ) : (
            <p className="muted" data-testid="no-hosts">
              No hosts in your infrastructure have this {entry.type}.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

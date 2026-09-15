import Link from "next/link";
import Comments from "@/components/Comments";
import EntryLink from "@/components/EntryLink";
import HostAvatar from "@/components/HostAvatar";
import ListModal from "@/components/ListModal";
import SeenLine from "@/components/SeenLine";
import {
  clientsSearchHref,
  conditionHref,
  describeHost,
  entryHref,
  filterSearchHref,
  freePercent,
  getClientsOfHub,
  getEntry,
  getHostGroups,
  getHubOf,
  getPortInfo,
  Host,
  ROLE_HUB,
  valueEntryName,
  versionEntryName,
} from "@/lib/data";

// "22 (ssh)" for well-known ports, just the number otherwise.
function portLabel(port: number): string {
  const info = getPortInfo(port);
  return info ? `${port} (${info.name})` : String(port);
}

// "1.5 TB", "42 GB"; "3.1 GB", "512 MB".
function formatGb(gb: number): string {
  return gb >= 1000 ? `${trim(gb / 1000)} TB` : `${trim(gb)} GB`;
}
function formatMb(mb: number): string {
  return mb >= 1024 ? `${trim(mb / 1024)} GB` : `${trim(mb)} MB`;
}
function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

// "Role: Hub" or "Role: Client"; "Hub: <ip> (hostname)", the hub's own
// address for a hub; and for hubs, "Clients: N hosts" linking to a search
// for the clients reporting to it.
function RoleDetails({ host }: { host: Host }) {
  const hub = getHubOf(host);
  const isHub = host.role === ROLE_HUB;
  const clients = isHub ? getClientsOfHub(host) : [];
  return (
    <>
      <dt>Role</dt>
      <dd className="inline-links" data-testid="host-role">
        <EntryLink type="role" name={host.role} />
      </dd>
      <dt>Hub</dt>
      <dd className="inline-links" data-testid="host-hub">
        <EntryLink type="ip" name={host.hub} />
        {isHub ? (
          <span className="muted">(this host)</span>
        ) : hub ? (
          <Link href={entryHref({ type: "host", name: hub.id })} className="muted" data-testid="host-hub-name">
            ({hub.hostname})
          </Link>
        ) : null}
      </dd>
      {isHub && (
        <>
          <dt>Clients</dt>
          <dd data-testid="host-clients">
            <Link
              href={clientsSearchHref(host.hub)}
              className="entry-link"
              title="Find the clients reporting to this hub"
              data-testid="host-clients-link"
            >
              {clients.length} {clients.length === 1 ? "host" : "hosts"}
            </Link>
          </dd>
        </>
      )}
    </>
  );
}

// Shown while nothing is pinned. The same text is in listModalScript.ts.
const PINNED_EMPTY =
  '<li class="muted pinned-empty" data-pinned-empty>Nothing pinned. Pin software, classes or variables with 📌 in the lists below.</li>';

function HostDetails({ host }: { host: Host }) {
  const groups = getHostGroups(host.id);
  return (
    <div data-testid="host-details">
      <div className="host-columns">
        <dl className="host-details" data-testid="host-details-left">
          <dt>Hostname</dt>
          <dd>
            <EntryLink type="hostname" name={host.hostname} />
          </dd>
          <dt>Operating system</dt>
          <dd>
            <EntryLink type="os" name={host.os} />
          </dd>
          <dt>Cloud provider</dt>
          <dd className="inline-links" data-testid="host-cloud">
            {host["cloud-provider"] ? (
              <EntryLink type="cloud" name={host["cloud-provider"]} />
            ) : (
              <span className="muted">None</span>
            )}
          </dd>
          <RoleDetails host={host} />
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
        <dl className="host-details" data-testid="host-details-right">
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
          <dt>Disk space</dt>
        <dd data-testid="host-disk">
          <Link
            href={conditionHref("disk", freePercent(host, "disk"))}
            className="entry-link"
            title="Find hosts with a smaller share of free disk space"
            data-testid="host-disk-link"
          >
            {formatGb(host.disk["free-gb"])} free of {formatGb(host.disk["total-gb"])} (
            {freePercent(host, "disk")}%)
          </Link>
        </dd>
        <dt>Memory</dt>
        <dd data-testid="host-memory">
          <Link
            href={conditionHref("memory", freePercent(host, "memory"))}
            className="entry-link"
            title="Find hosts with a smaller share of free memory"
            data-testid="host-memory-link"
          >
            {formatMb(host.memory["free-mb"])} free of {formatMb(host.memory["total-mb"])} (
            {freePercent(host, "memory")}%)
          </Link>
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
        </dl>
      </div>
      {/* Software, classes and variables pinned from the lists below, kept
          in local storage and filled in by the layout's inline script (see
          components/listModalScript.ts), so the server renders the hint. */}
      <dl className="host-details host-pinned" data-testid="host-pinned">
        <dt>Pinned</dt>
        <dd>
          <ul
            className="entry-list pinned-list"
            data-pinned
            data-testid="pinned-list"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: PINNED_EMPTY }}
          />
        </dd>
      </dl>
      <dl className="host-details host-details-wide" data-testid="host-details-wide">
          <dt>Software</dt>
        <dd data-testid="host-software">
          <ListModal
            title={`Software on ${host.hostname}`}
            singular="software package"
            plural="software packages"
            verb="installed"
            testId="software-modal"
            pinnable
            rows={host.software.map((sw) => {
              const version = host["software-versions"]?.[sw];
              return {
                key: sw,
                type: "software",
                label: sw,
                href: entryHref({ type: "software", name: sw }),
                extra: version
                  ? {
                      label: version,
                      href: entryHref({ type: "version", name: versionEntryName(sw, version) }),
                    }
                  : undefined,
              };
            })}
          />
        </dd>
        <dt>Services</dt>
        <dd data-testid="host-services">
          {host.services.length === 0 ? (
            <span className="muted">None (no systemd)</span>
          ) : (
            <ListModal
              title={`Services running on ${host.hostname}`}
              singular="service"
              plural="services"
              verb="running"
              testId="services-modal"
              rows={host.services.map((svc) => ({
                key: svc,
                type: "service",
                label: svc,
                href: entryHref({ type: "service", name: svc }),
              }))}
            />
          )}
        </dd>
        <dt>Classes</dt>
        <dd data-testid="host-classes">
          <ListModal
            title={`Classes of ${host.hostname}`}
            singular="class"
            plural="classes"
            verb="defined"
            testId="classes-modal"
            pinnable
            rows={host.classes.map((cls) => ({
              key: cls,
              type: "class",
              label: cls,
              href: entryHref({ type: "class", name: cls }),
            }))}
          />
        </dd>
        <dt>Variables</dt>
        <dd data-testid="host-variables">
          <ListModal
            title={`Variables on ${host.hostname}`}
            singular="variable"
            plural="variables"
            verb="defined"
            testId="variables-modal"
            pinnable
            rows={Object.entries(host.variables ?? {}).map(([variable, value]) => {
              // "sys.arch=x86_64 (87 hosts)": the count of hosts sharing the
              // value links to a search for them.
              const name = valueEntryName(variable, value);
              const shared = getEntry("value", name)?.hosts.length ?? 1;
              return {
                key: variable,
                type: "variable",
                label: variable,
                href: entryHref({ type: "variable", name: variable }),
                separator: "=",
                extra: { label: value, href: entryHref({ type: "value", name }) },
                note: {
                  label: `(${shared} ${shared === 1 ? "host" : "hosts"})`,
                  href: filterSearchHref([{ type: "value", name }]),
                },
              };
            })}
          />
        </dd>
      </dl>
    </div>
  );
}


// The host view: title with avatar, the plain-language summary and the
// details. Used for the host page itself and, embedded, in the right pane
// of an entry that matches exactly one host (with prefixed test ids so
// they do not clash with the entry's own).
export default function HostView({ host, embedded = false }: { host: Host; embedded?: boolean }) {
  const tid = (id: string) => (embedded ? `pane-${id}` : id);
  return (
    <div className="host-view" data-testid={tid("host-view")}>
      <div className="entry-topline">
        <span className="type-badge">host</span>
        <SeenLine seen={{ first: host["first-seen"], last: host["last-seen"] }} testId={tid("host")} />
      </div>
      <div className="entry-title">
        <HostAvatar host={host} size={48} />
        <h1 data-testid={tid("entry-name")}>
          {host.hostname} <span className="muted host-id">({host.id})</span>
        </h1>
      </div>
      <p data-testid={tid("entry-summary")}>{describeHost(host)}</p>
      <HostDetails host={host} />
      {!embedded && <Comments entry={{ type: "host", name: host.id }} heading />}
      {embedded && (
        <Link
          href={entryHref({ type: "host", name: host.id })}
          className="host-card-open"
          title={`Open ${host.hostname}`}
          aria-label={`Open ${host.hostname}`}
          data-testid="pane-open-host"
        >
          →
        </Link>
      )}
    </div>
  );
}

import EntryLink from "@/components/EntryLink";
import HostAvatar from "@/components/HostAvatar";
import ListModal from "@/components/ListModal";
import SeenLine from "@/components/SeenLine";
import {
  describeHost,
  entryHref,
  getHostGroups,
  getPortInfo,
  Host,
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
      <dl className="host-details host-details-wide" data-testid="host-details-wide">
          <dt>Software</dt>
        <dd data-testid="host-software">
          <ListModal
            title={`Software on ${host.hostname}`}
            singular="software package"
            plural="software packages"
            verb="installed"
            testId="software-modal"
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
        <dt>Classes</dt>
        <dd data-testid="host-classes">
          <ListModal
            title={`Classes of ${host.hostname}`}
            singular="class"
            plural="classes"
            verb="defined"
            testId="classes-modal"
            rows={host.classes.map((cls) => ({
              key: cls,
              type: "class",
              label: cls,
              href: entryHref({ type: "class", name: cls }),
            }))}
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
      {embedded && (
        <p>
          <span className="type-badge">host</span>
        </p>
      )}
      <div className="entry-title">
        <HostAvatar host={host} size={48} />
        <h1 data-testid={tid("entry-name")}>
          {host.hostname} <span className="muted host-id">({host.id})</span>
        </h1>
      </div>
      <SeenLine seen={{ first: host["first-seen"], last: host["last-seen"] }} testId={tid("host")} />
      <p data-testid={tid("entry-summary")}>{describeHost(host)}</p>
      <HostDetails host={host} />
    </div>
  );
}

import EntryLink from "@/components/EntryLink";
import Timestamp from "@/components/Timestamp";
import { Entry, getHost, summarizeUser } from "@/lib/data";

// Details of a local user across the hosts that have it, laid out in two
// columns like the details of a host.
export default function UserDetailsSection({ entry }: { entry: Entry }) {
  const user = summarizeUser(entry);
  const none = <span className="muted">None</span>;
  const list = (values: string[]) =>
    values.length === 0 ? none : values.map((v) => <code key={v}>{v}</code>);
  const login = (value: { time: string; hostkey: string } | undefined, testId: string) => {
    if (!value) return <span data-testid={testId}>Never</span>;
    const host = getHost(value.hostkey);
    return (
      <span data-testid={testId}>
        <Timestamp iso={value.time} />
        {host && (
          <>
            {" "}
            <span className="muted">on</span> <EntryLink type="host" name={host.id} label={host.hostname} />
          </>
        )}
      </span>
    );
  };
  return (
    <div className="user-details" data-testid="user-details">
      <dl className="host-details" data-testid="user-details-left">
        <dt>Home directory</dt>
        <dd className="inline-links" data-testid="user-home">
          {list(user.homes)}
        </dd>
        <dt>Shell</dt>
        <dd className="inline-links" data-testid="user-shell">
          {list(user.shells)}
        </dd>
        <dt>Groups</dt>
        <dd className="inline-links" data-testid="user-groups">
          {list(user.groups)}
        </dd>
      </dl>
      <dl className="host-details" data-testid="user-details-right">
        <dt>Last login</dt>
        <dd>{login(user.lastLogin, "user-last-login")}</dd>
        <dt>Last failed login</dt>
        <dd>{login(user.lastFailedLogin, "user-last-failed-login")}</dd>
      </dl>
    </div>
  );
}

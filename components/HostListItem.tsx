import EntryLink from "@/components/EntryLink";
import { abbreviateHostId, Host } from "@/lib/data";

// One host in a list: hostname (linked), abbreviated key, OS and IPs.
export default function HostListItem({ host }: { host: Host }) {
  return (
    <li className="host-item" data-testid="host-item">
      <span className="type-badge">host</span>
      <div className="host-summary">
        <div>
          <EntryLink type="host" name={host.id} label={host.hostname} />{" "}
          <span className="muted host-id" title={host.id}>
            ({abbreviateHostId(host.id)})
          </span>
        </div>
        <div className="muted host-facts">
          <span>
            OS: <EntryLink type="os" name={host.os} />
          </span>
          <span>
            IPs:{" "}
            {host.ips.map((ip, i) => (
              <span key={ip}>
                {i > 0 && ", "}
                <EntryLink type="ip" name={ip} />
              </span>
            ))}
          </span>
        </div>
      </div>
    </li>
  );
}

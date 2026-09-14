import HostListItem from "@/components/HostListItem";
import Pagination, { paginate } from "@/components/Pagination";
import { Host } from "@/lib/data";

export { PAGE_SIZE as HOSTS_PER_PAGE, parsePage } from "@/components/Pagination";

// A list of hosts, a page at a time (see PAGE_SIZE) with pagination links below.
export default function HostList({
  hosts,
  page,
  hrefForPage,
  testId = "linked-hosts",
}: {
  hosts: Host[];
  page: number;
  hrefForPage: (page: number) => string;
  testId?: string;
}) {
  const { shown, current, totalPages, start } = paginate(hosts, page);
  return (
    <>
      <ul className="entry-list" data-testid={testId}>
        {shown.map((host) => (
          <HostListItem key={host.id} host={host} />
        ))}
      </ul>
      <Pagination
        total={hosts.length}
        shown={shown.length}
        start={start}
        current={current}
        totalPages={totalPages}
        noun="hosts"
        hrefForPage={hrefForPage}
      />
    </>
  );
}

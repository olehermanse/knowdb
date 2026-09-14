import PieChart from "@/components/PieChart";
import { OsCount } from "@/lib/data";

// Pie chart of operating systems, each linking to its OS page.
export default function OsPieChart({
  counts,
  subject,
}: {
  counts: OsCount[];
  subject: string;
}) {
  return (
    <PieChart
      items={counts.map((c) => ({ label: c.os, hosts: c.hosts, link: { type: "os", name: c.os } }))}
      subject={subject}
      noun="operating system"
      testId="os"
      ariaLabel="Operating systems"
    />
  );
}

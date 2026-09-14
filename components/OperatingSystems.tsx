import EntryLink from "@/components/EntryLink";
import OsPieChart from "@/components/OsPieChart";
import { aggregateOs, Entry, EntryType } from "@/lib/data";

// Entry types whose pages show the operating systems of their hosts, and
// how to refer to the entry in the section text.
export const OS_SECTION_SUBJECTS: Partial<Record<EntryType, string>> = {
  group: "group",
  class: "class",
  software: "software",
  version: "software version",
  port: "port",
  user: "local user",
  hostname: "hostname",
  ip: "IP address",
  mac: "MAC address",
  cloud: "cloud provider",
};

// Text under the heading, per entry type.
function sectionText(type: EntryType, subject: string, name: string): string {
  if (type === "port") {
    return "Operating systems of the hosts listening to this port:";
  }
  if (type === "software") {
    return `The hosts with ${name} installed run these operating systems:`;
  }
  if (type === "cloud") {
    return `The hosts on ${name} run these operating systems:`;
  }
  if (type === "version") {
    return `The ${name} software version is installed on these operating systems:`;
  }
  return `Operating systems of the hosts with this ${subject}, most hosts first.`;
}

// "Operating systems" section: a pie chart and a ranked list of the
// operating systems of the hosts linked to an entry.
export default function OperatingSystems({ entry }: { entry: Entry }) {
  const counts = aggregateOs(entry.hosts);
  const subject = OS_SECTION_SUBJECTS[entry.type] ?? "entry";
  // A version on a single OS gets one sentence instead of intro + chart.
  if (entry.type === "version" && counts.length === 1) {
    const only = counts[0];
    return (
      <section data-testid="os-section">
        <p data-testid="os-summary">
          The {entry.name} software version is only installed on{" "}
          <EntryLink type="os" name={only.os} /> ({only.hosts} {only.hosts === 1 ? "host" : "hosts"}).
        </p>
      </section>
    );
  }
  return (
    <section data-testid="os-section">
      <p className="muted">{sectionText(entry.type, subject, entry.name)}</p>
      <OsPieChart counts={counts} subject={`This ${subject}`} />
    </section>
  );
}

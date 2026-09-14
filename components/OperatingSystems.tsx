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
};

// Text under the heading, per entry type.
function sectionText(type: EntryType, subject: string, name: string): string {
  if (type === "port") {
    return "Operating systems of the hosts listening to this port:";
  }
  if (type === "software") {
    return `The hosts with ${name} installed run these operating systems:`;
  }
  return `Operating systems of the hosts with this ${subject}, most hosts first.`;
}

// "Operating systems" section: a pie chart and a ranked list of the
// operating systems of the hosts linked to an entry.
export default function OperatingSystems({ entry }: { entry: Entry }) {
  const counts = aggregateOs(entry.hosts);
  const subject = OS_SECTION_SUBJECTS[entry.type] ?? "entry";
  return (
    <section data-testid="os-section">
      <p className="muted">{sectionText(entry.type, subject, entry.name)}</p>
      <OsPieChart counts={counts} subject={`This ${subject}`} />
    </section>
  );
}

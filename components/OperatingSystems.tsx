import OsPieChart from "@/components/OsPieChart";
import { aggregateOs, Entry, EntryType } from "@/lib/data";

// Entry types whose pages show the operating systems of their hosts, and
// how to refer to the entry in the section text.
export const OS_SECTION_SUBJECTS: Partial<Record<EntryType, string>> = {
  group: "group",
  software: "software",
  port: "port",
  user: "local user",
};

export function hasOsSection(type: EntryType): boolean {
  return type in OS_SECTION_SUBJECTS;
}

// "Operating systems" section: a pie chart and a ranked list of the
// operating systems of the hosts linked to an entry.
export default function OperatingSystems({ entry }: { entry: Entry }) {
  const counts = aggregateOs(entry.hosts);
  const subject = OS_SECTION_SUBJECTS[entry.type] ?? "entry";
  return (
    <section data-testid="os-section">
      <h2 data-testid="os-heading">
        Operating systems <span className="muted">({counts.length})</span>
      </h2>
      <p className="muted">
        Operating systems of the hosts with this {subject}, most hosts first.
      </p>
      <OsPieChart counts={counts} subject={`This ${subject}`} />
    </section>
  );
}

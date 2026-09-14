import EntryLink from "@/components/EntryLink";
import PieChart, { PieItem } from "@/components/PieChart";
import { aggregateClouds, Entry, hostsSubject } from "@/lib/data";

export const NO_CLOUD_LABEL = "None";

function sectionText(entry: Entry): string {
  switch (entry.type) {
    case "software":
      return `The hosts with ${entry.name} installed run on these cloud providers:`;
    case "version":
      return `The hosts with ${entry.name} run on these cloud providers:`;
    case "os":
      return `The ${entry.name} hosts run on these cloud providers:`;
    case "port":
      return "The hosts listening to this port run on these cloud providers:";
    default:
      return "The hosts run on these cloud providers:";
  }
}

// "Clouds" tab: a pie chart and ranked list of the cloud providers the
// related hosts run on. Hosts without a provider get their own slice.
export default function CloudProviders({ entry }: { entry: Entry }) {
  const counts = aggregateClouds(entry.hosts);
  const items: PieItem[] = counts.map((c) => ({
    label: c.cloud || NO_CLOUD_LABEL,
    hosts: c.hosts,
    link: c.cloud ? { type: "cloud", name: c.cloud } : undefined,
  }));
  // A single provider (or none at all) gets one short sentence.
  if (counts.length === 1) {
    const only = counts[0];
    return (
      <section data-testid="cloud-section">
        <p data-testid="cloud-summary">
          {only.cloud ? (
            <>
              {hostsSubject(entry, only.hosts, "run")} on{" "}
              <EntryLink type="cloud" name={only.cloud} />.
            </>
          ) : (
            <>{hostsSubject(entry, only.hosts, "run")} in your own data center.</>
          )}
        </p>
      </section>
    );
  }
  return (
    <section data-testid="cloud-section">
      <p className="muted">{sectionText(entry)}</p>
      <PieChart
        items={items}
        subject="These hosts"
        noun="cloud provider"
        testId="cloud"
        ariaLabel="Cloud providers"
      />
    </section>
  );
}

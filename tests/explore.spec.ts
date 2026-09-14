import { test, expect } from "@playwright/test";
import hosts from "../data/hosts.json";
import info from "../data/info.json";
import groupsJson from "../data/groups.json";

type Host = (typeof hosts)[number];
type Group = (typeof groupsJson.groups)[number] & {
  match: { os?: string[]; hostname?: string[] };
};
const groups = groupsJson.groups as Group[];

// Mirrors the matching rules documented in groups.json.
function contains(value: string, substrings?: string[]) {
  if (!substrings) return true;
  return substrings.some((s) => value.toLowerCase().includes(s.toLowerCase()));
}
function inGroup(host: Host, group: Group) {
  return (
    contains(host.os, group.match.os) &&
    contains(host.hostname, group.match.hostname)
  );
}
const groupHref = (name: string) => `/entry/group/${encodeURIComponent(name)}`;

// Expected "22 (ssh, 50 hosts)" labels for a set of hosts, ascending by port.
function expectedPortLabels(selected: Host[]): string[] {
  const counts = new Map<number, number>();
  for (const host of selected) {
    for (const port of new Set(host["ports-listening"])) {
      counts.set(port, (counts.get(port) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([port, n]) => {
      const known = info.ports[String(port) as keyof typeof info.ports];
      const count = `${n} ${n === 1 ? "host" : "hosts"}`;
      return known ? `${port} (${known.name}, ${count})` : `${port} (${count})`;
    });
}

async function expectAggregatedPorts(
  page: import("@playwright/test").Page,
  selected: Host[],
) {
  const labels = expectedPortLabels(selected);
  expect(labels.length).toBeGreaterThan(1);
  const links = page.getByTestId("aggregated-ports").locator("a");
  await expect(links).toHaveText(labels);
  // Every host listens on 22, so the first entry counts all selected hosts.
  await expect(links.first()).toHaveText(
    `22 (ssh, ${selected.length} hosts)`,
  );
  await expect(links.first()).toHaveAttribute("href", "/entry/port/22");
}

// Every generated host listens on ports 22 and 5308, so these entries are
// guaranteed to exist and be linked to all hosts.
const someHost = hosts[0];

test("front page shows 10 random entries", async ({ page }) => {
  await page.goto("/");
  const items = page.getByTestId("entry-list").locator("li");
  await expect(items).toHaveCount(10);
  await expect(items.locator("a.entry-link")).toHaveCount(10);
});

test("front page always shows at least one entry of each type", async ({
  page,
}) => {
  const allTypes = ["host", "hostname", "os", "ip", "port", "software", "user", "group"];
  // The sample is random, so check several page loads.
  for (let i = 0; i < 5; i++) {
    await page.goto("/");
    const badges = page.getByTestId("entry-list").locator(".type-badge");
    await expect(badges).toHaveCount(10);
    const shown = (await badges.allTextContents()).map((t) => t.toLowerCase());
    for (const type of allTypes) {
      expect(shown, `load ${i + 1} is missing type ${type}`).toContain(type);
    }
  }
});

test("clicking a front page entry navigates to its page", async ({ page }) => {
  await page.goto("/");
  const firstLink = page
    .getByTestId("entry-list")
    .locator("a.entry-link")
    .first();
  const name = await firstLink.textContent();
  await firstLink.click();
  await expect(page).toHaveURL(/\/entry\//);
  await expect(page.getByTestId("entry-name")).toContainText(name!);
});

test("host page title is the hostname with the ID in parenthesis", async ({
  page,
}) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("entry-name")).toHaveText(
    `${someHost.hostname} (${someHost.id})`,
  );
  await expect(page.getByTestId("entry-name")).toHaveText(
    `${someHost.hostname} (${someHost.id})`,
  );
});

test("host page shows clickable details", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("entry-name")).toContainText(someHost.hostname);
  const details = page.getByTestId("host-details");
  await expect(
    details.getByRole("link", { name: someHost.hostname, exact: true }),
  ).toBeVisible();
  await expect(
    details.getByRole("link", { name: someHost.os, exact: true }),
  ).toBeVisible();
  await expect(
    details.getByRole("link", { name: "22 (ssh)", exact: true }),
  ).toBeVisible();
});

test("host page shows common port names in parenthesis", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const details = page.getByTestId("host-details");
  for (const port of someHost["ports-listening"]) {
    const known = info.ports[String(port) as keyof typeof info.ports];
    const label = known ? `${port} (${known.name})` : String(port);
    const link = details.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/entry/port/${port}`);
  }
});

test("clicking a unique hostname goes directly to the host", async ({
  page,
}) => {
  // Hostnames in the generated data are unique, so every hostname link
  // should resolve straight to its host instead of an intermediate page.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const hostnameLink = page
    .getByTestId("host-details")
    .getByRole("link", { name: someHost.hostname, exact: true });
  await expect(hostnameLink).toHaveAttribute(
    "href",
    `/entry/host/${encodeURIComponent(someHost.id)}`,
  );

  // Visiting the hostname entry directly redirects to the host as well.
  await page.goto(`/entry/hostname/${encodeURIComponent(someHost.hostname)}`);
  await expect(page).toHaveURL(
    `/entry/host/${encodeURIComponent(someHost.id)}`,
  );
  await expect(page.getByTestId("entry-name")).toContainText(someHost.id);
});

test("entries are two-way linked: host -> port -> host", async ({ page }) => {
  // From a host, click port 22.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await page
    .getByTestId("host-details")
    .getByRole("link", { name: "22 (ssh)", exact: true })
    .click();
  await expect(page).toHaveURL("/entry/port/22");
  await expect(page.getByTestId("entry-description")).toContainText("SSH");

  // Port 22 links back to every host, including the one we came from.
  const linkedHosts = page.getByTestId("linked-hosts").locator("li");
  await expect(linkedHosts).toHaveCount(hosts.length);
  await page
    .getByTestId("linked-hosts")
    .getByRole("link", { name: someHost.id, exact: true })
    .click();
  await expect(page.getByTestId("entry-name")).toContainText(someHost.id);
});

test("port and software descriptions come from info.json", async ({
  page,
}) => {
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("entry-description")).toContainText(
    info.ports["22"].description,
  );
  await expect(page.getByTestId("entry-description")).toContainText("(ssh)");

  await page.goto("/entry/software/dpkg");
  await expect(page.getByTestId("entry-description")).toHaveText(
    info.software["dpkg"].description,
  );
});

test("host page lists the groups the host is in", async ({ page }) => {
  const windowsHost = hosts.find((h) => h.os.startsWith("Windows"))!;
  await page.goto(`/entry/host/${encodeURIComponent(windowsHost.id)}`);
  const hostGroups = page.getByTestId("host-groups");
  const expected = groups.filter((g) => inGroup(windowsHost, g));
  expect(expected.map((g) => g.name)).toContain("Windows");
  await expect(hostGroups.locator("a")).toHaveCount(expected.length);
  for (const group of expected) {
    await expect(
      hostGroups.getByRole("link", { name: group.name, exact: true }),
    ).toHaveAttribute("href", groupHref(group.name));
  }
  await expect(
    hostGroups.getByRole("link", { name: "Linux", exact: true }),
  ).toHaveCount(0);
});

test("group page lists matching hosts and its rules", async ({ page }) => {
  const group = groups.find((g) => g.name === "production Linux")!;
  await page.goto(groupHref(group.name));
  await expect(page.getByTestId("entry-name")).toHaveText(group.name);
  await expect(page.getByTestId("entry-description")).toHaveText(
    group.description,
  );

  const rules = page.getByTestId("group-rules");
  await expect(rules).toContainText("OS contains");
  await expect(rules).toContainText("Hostname contains");
  await expect(rules.locator("code", { hasText: "production" })).toBeVisible();

  const expected = hosts.filter((h) => inGroup(h, group));
  expect(expected.length).toBeGreaterThan(0);
  const linked = page.getByTestId("linked-hosts").locator("li");
  await expect(linked).toHaveCount(expected.length);
  for (const host of expected.slice(0, 3)) {
    await expect(
      page.getByTestId("linked-hosts").getByRole("link", {
        name: host.id,
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("groups are two-way linked: host -> group -> host", async ({ page }) => {
  const ubuntuHost = hosts.find((h) => h.os.startsWith("Ubuntu"))!;
  await page.goto(`/entry/host/${encodeURIComponent(ubuntuHost.id)}`);
  await page
    .getByTestId("host-groups")
    .getByRole("link", { name: "Ubuntu", exact: true })
    .click();
  await expect(page).toHaveURL(groupHref("Ubuntu"));
  await page
    .getByTestId("linked-hosts")
    .getByRole("link", { name: ubuntuHost.id, exact: true })
    .click();
  await expect(page.getByTestId("entry-name")).toContainText(ubuntuHost.id);
});

test("every group in groups.json has an entry page", async ({ page }) => {
  for (const group of groups) {
    const response = await page.goto(groupHref(group.name));
    expect(response!.status(), group.name).toBe(200);
    await expect(page.getByTestId("entry-name")).toHaveText(group.name);
  }
});

function osCounts(selected: Host[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const h of selected) counts.set(h.os, (counts.get(h.os) ?? 0) + 1);
  return [...counts.entries()].sort(
    ([aOs, a], [bOs, b]) => b - a || aOs.localeCompare(bOs),
  );
}

function hostsInGroup(name: string): Host[] {
  const group = groups.find((g) => g.name === name)!;
  return hosts.filter((h) => inGroup(h, group));
}

test("group page shows an operating system pie chart and ranked list", async ({
  page,
}) => {
  const expected = osCounts(hostsInGroup("Windows"));
  expect(expected.length).toBe(3);
  await page.goto(groupHref("Windows"));

  await expect(page.getByTestId("os-heading")).toHaveText(
    "Operating systems (3)",
  );
  // One slice per operating system, each with a hover title.
  const slices = page.getByTestId("os-pie").locator("path");
  await expect(slices).toHaveCount(3);
  await expect(slices.first()).toHaveAttribute("data-os", expected[0][0]);
  await expect(slices.first().locator("title")).toHaveText(
    `${expected[0][0]}: ${expected[0][1]} hosts (${Math.round(
      (expected[0][1] / hostsInGroup("Windows").length) * 100,
    )}%)`,
  );

  // The list is ranked by most hosts first, and links to each OS.
  const items = page.getByTestId("os-list").locator("li");
  await expect(items).toHaveCount(3);
  for (const [i, [os, n]] of expected.entries()) {
    await expect(items.nth(i).getByRole("link")).toHaveText(os);
    await expect(items.nth(i).getByRole("link")).toHaveAttribute(
      "href",
      `/entry/os/${encodeURIComponent(os)}`,
    );
    await expect(items.nth(i)).toContainText(`${n} hosts`);
  }

  // The operating systems section comes before the ports section.
  const osBox = await page.getByTestId("os-heading").boundingBox();
  const portsBox = await page.getByTestId("ports-heading").boundingBox();
  expect(osBox!.y).toBeLessThan(portsBox!.y);
});

test("operating systems beyond the palette fold into an Other slice", async ({
  page,
}) => {
  const expected = osCounts(hostsInGroup("Linux"));
  expect(expected.length).toBeGreaterThan(8);
  await page.goto(groupHref("Linux"));

  const slices = page.getByTestId("os-pie").locator("path");
  await expect(slices).toHaveCount(8);
  await expect(slices.last()).toHaveAttribute("data-os", "Other");
  const otherHosts = expected.slice(7).reduce((sum, [, n]) => sum + n, 0);
  await expect(slices.last().locator("title")).toContainText(
    `Other: ${otherHosts} hosts`,
  );

  // The list still names every operating system, in ranked order.
  const items = page.getByTestId("os-list").locator("li");
  await expect(items).toHaveCount(expected.length);
  await expect(items.getByRole("link")).toHaveText(expected.map(([os]) => os));
  await expect(items.last()).toContainText("(in Other)");
  await expect(items.first()).not.toContainText("(in Other)");
});

test("group with a single operating system shows a sentence instead", async ({
  page,
}) => {
  const selected = hostsInGroup("SUSE");
  const expected = osCounts(selected);
  expect(expected.length).toBe(1);
  await page.goto(groupHref("SUSE"));
  await expect(page.getByTestId("os-pie")).toHaveCount(0);
  await expect(page.getByTestId("os-list")).toHaveCount(0);
  await expect(page.getByTestId("os-summary")).toHaveText(
    `This group has only 1 operating system: ${expected[0][0]} (${expected[0][1]} hosts).`,
  );
  await expect(
    page.getByTestId("os-summary").getByRole("link", { name: expected[0][0] }),
  ).toHaveAttribute("href", `/entry/os/${encodeURIComponent(expected[0][0])}`);
});

test("operating systems section only appears on group pages", async ({
  page,
}) => {
  await page.goto("/entry/software/dpkg");
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await page.goto(`/entry/os/${encodeURIComponent(someHost.os)}`);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
});

test("group page aggregates listening ports of its hosts", async ({
  page,
}) => {
  const group = groups.find((g) => g.name === "Windows")!;
  await page.goto(groupHref(group.name));
  await expectAggregatedPorts(
    page,
    hosts.filter((h) => inGroup(h, group)),
  );
});

test("software page aggregates listening ports of its hosts", async ({
  page,
}) => {
  await page.goto("/entry/software/dpkg");
  await expectAggregatedPorts(
    page,
    hosts.filter((h) => h.software.includes("dpkg")),
  );
});

test("os page aggregates listening ports of its hosts", async ({ page }) => {
  const os = someHost.os;
  await page.goto(`/entry/os/${encodeURIComponent(os)}`);
  await expectAggregatedPorts(
    page,
    hosts.filter((h) => h.os === os),
  );
});

test("hosts and ports sections have short headings and descriptions", async ({
  page,
}) => {
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("hosts-heading")).toHaveText(
    `Hosts (${hosts.length})`,
  );
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts listening on port 22.",
  );
  await expect(page.getByText("Linked hosts")).toHaveCount(0);

  await page.goto("/entry/software/dpkg");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts with dpkg installed.",
  );
  await expect(page.getByTestId("ports-heading")).toHaveText(/^Ports \(\d+\)$/);
  await expect(page.getByText("Listening ports")).toHaveCount(0);
});

test("port and host pages do not aggregate ports", async ({ page }) => {
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("aggregated-ports")).toHaveCount(0);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("aggregated-ports")).toHaveCount(0);
});

test("entry types are distinct namespaces", async ({ page }) => {
  // "dpkg" exists as software, but there is no *host* named dpkg.
  const response = await page.goto("/entry/host/dpkg");
  expect(response!.status()).toBe(404);

  const softwareResponse = await page.goto("/entry/software/dpkg");
  expect(softwareResponse!.status()).toBe(200);
  await expect(page.getByTestId("entry-name")).toHaveText("dpkg");
});

test("unknown entry type returns 404", async ({ page }) => {
  const response = await page.goto("/entry/banana/22");
  expect(response!.status()).toBe(404);
});

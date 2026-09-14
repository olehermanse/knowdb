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

// Related hosts are shown in tabs; open one by clicking its tab.
async function openTab(
  page: import("@playwright/test").Page,
  tab: "os" | "ports" | "hosts",
) {
  await page.getByTestId(`${tab}-heading`).click();
  await expect(page.getByTestId(`tab-${tab}`)).toBeVisible();
}

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
  const items = page.getByTestId("aggregated-port");
  await expect(items).toHaveText(labels, { useInnerText: true });
  // Every host listens on 22, so the first entry counts all selected hosts.
  const first = items.first();
  await expect(first).toHaveText(`22 (ssh, ${selected.length} hosts)`, {
    useInnerText: true,
  });
  await expect(first.getByRole("link", { name: "22", exact: true })).toHaveAttribute(
    "href",
    "/entry/port/22",
  );
  await expect(first.getByTestId("port-hosts-link")).toHaveAttribute(
    "href",
    /\/search\?q=port%3A22/,
  );
}

// Every generated host listens on ports 22 and 5308, so these entries are
// guaranteed to exist and be linked to all hosts.
const someHost = hosts[0];

test("front page shows 12 random entries", async ({ page }) => {
  await page.goto("/");
  const items = page.getByTestId("entry-list").locator("li");
  await expect(items).toHaveCount(12);
  await expect(items.locator("a.entry-link")).toHaveCount(12);
});

test("front page always shows at least one entry of each type", async ({
  page,
}) => {
  const allTypes = [
    "host",
    "hostname",
    "os",
    "ip",
    "mac",
    "port",
    "software",
    "user",
    "group",
    "class",
    "version",
  ];
  // The sample is random, so check several page loads.
  for (let i = 0; i < 5; i++) {
    await page.goto("/");
    const badges = page.getByTestId("entry-list").locator(".type-badge");
    await expect(badges).toHaveCount(12);
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

  // Port 22 links back to every host, 50 per page, including the one we
  // came from (hosts are listed in host key order).
  await openTab(page, "hosts");
  const linkedHosts = page.getByTestId("linked-hosts").locator("li");
  await expect(linkedHosts).toHaveCount(Math.min(50, hosts.length));
  const sortedIds = hosts.map((h) => h.id).sort();
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / 50) + 1;
  if (ourPage > 1) {
    await page.getByTestId("pagination").getByRole("link", { name: String(ourPage) }).click();
  }
  await page
    .getByTestId("linked-hosts")
    .getByRole("link", { name: someHost.hostname, exact: true })
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
  await openTab(page, "hosts");
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
        name: host.hostname,
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
  await openTab(page, "hosts");
  await page
    .getByTestId("linked-hosts")
    .getByRole("link", { name: ubuntuHost.hostname, exact: true })
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

// Name of the first group whose number of distinct operating systems
// satisfies `predicate`, so the tests do not depend on the generated data.
function groupWithOsCount(predicate: (n: number) => boolean): string {
  const group = groups.find((g) =>
    predicate(osCounts(hostsInGroup(g.name)).length),
  );
  expect(group, "no group with the wanted number of operating systems").toBeTruthy();
  return group!.name;
}

const hostsLabel = (n: number) => `${n} ${n === 1 ? "host" : "hosts"}`;

test("group page shows an operating system pie chart and ranked list", async ({
  page,
}) => {
  // A group with a few operating systems, so nothing folds into "Other".
  const name = groupWithOsCount((n) => n >= 2 && n <= 7);
  const selected = hostsInGroup(name);
  const expected = osCounts(selected);
  await page.goto(groupHref(name));

  await expect(page.getByTestId("os-heading")).toHaveText(
    `Operating systems (${expected.length})`,
  );
  // One slice per operating system, each with a hover title.
  const slices = page.getByTestId("os-pie").locator("path");
  await expect(slices).toHaveCount(expected.length);
  await expect(slices.first()).toHaveAttribute("data-os", expected[0][0]);
  await expect(slices.first().locator("title")).toHaveText(
    `${expected[0][0]}: ${hostsLabel(expected[0][1])} (${Math.round(
      (expected[0][1] / selected.length) * 100,
    )}%)`,
  );

  // The list is ranked by most hosts first, and links to each OS.
  const items = page.getByTestId("os-list").locator("li");
  await expect(items).toHaveCount(expected.length);
  for (const [i, [os, n]] of expected.entries()) {
    await expect(items.nth(i).getByRole("link")).toHaveText(os);
    await expect(items.nth(i).getByRole("link")).toHaveAttribute(
      "href",
      `/entry/os/${encodeURIComponent(os)}`,
    );
    await expect(items.nth(i)).toContainText(hostsLabel(n));
  }

  // The operating systems tab comes before the ports tab.
  const osBox = await page.getByTestId("os-heading").boundingBox();
  const portsBox = await page.getByTestId("ports-heading").boundingBox();
  expect(osBox!.x).toBeLessThan(portsBox!.x);
});

test("operating systems beyond the palette fold into an Other slice", async ({
  page,
}) => {
  const name = groupWithOsCount((n) => n > 8);
  const expected = osCounts(hostsInGroup(name));
  await page.goto(groupHref(name));

  const slices = page.getByTestId("os-pie").locator("path");
  await expect(slices).toHaveCount(8);
  await expect(slices.last()).toHaveAttribute("data-os", "Other");
  const otherHosts = expected.slice(7).reduce((sum, [, n]) => sum + n, 0);
  await expect(slices.last().locator("title")).toContainText(
    `Other: ${hostsLabel(otherHosts)}`,
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
  // Prefer a group; fall back to a class (they work the same way), since
  // e.g. the "ubuntu_24" class always has exactly one operating system.
  const group = groups.find((g) => osCounts(hostsInGroup(g.name)).length === 1);
  const cls = [...new Set(hosts.flatMap((h) => h.classes))].find(
    (c) => osCounts(hosts.filter((h) => h.classes.includes(c))).length === 1,
  );
  const subject = group ? "group" : "class";
  const name = group?.name ?? cls!;
  expect(name).toBeTruthy();
  const selected = group
    ? hostsInGroup(group.name)
    : hosts.filter((h) => h.classes.includes(name));
  const expected = osCounts(selected);
  await page.goto(group ? groupHref(name) : `/entry/class/${encodeURIComponent(name)}`);
  await expect(page.getByTestId("os-pie")).toHaveCount(0);
  await expect(page.getByTestId("os-list")).toHaveCount(0);
  await expect(page.getByTestId("os-summary")).toHaveText(
    `This ${subject} has only 1 operating system: ${expected[0][0]} (${hostsLabel(expected[0][1])}).`,
  );
  await expect(
    page.getByTestId("os-summary").getByRole("link", { name: expected[0][0] }),
  ).toHaveAttribute("href", `/entry/os/${encodeURIComponent(expected[0][0])}`);
});

test("operating systems section is reused on software, port and user pages", async ({
  page,
}) => {
  const cases: [string, (h: Host) => boolean, string][] = [
    [
      "/entry/software/dpkg",
      (h) => h.software.includes("dpkg"),
      "Operating systems of the hosts with this software, most hosts first.",
    ],
    [
      "/entry/port/22",
      (h) => h["ports-listening"].includes(22),
      "Operating systems of the hosts listening to this port:",
    ],
    [
      "/entry/user/root",
      (h) => h["local-users"].includes("root"),
      "Operating systems of the hosts with this local user, most hosts first.",
    ],
  ];
  for (const [url, selects, text] of cases) {
    const expected = osCounts(hosts.filter(selects));
    expect(expected.length, url).toBeGreaterThan(1);
    await page.goto(url);
    await expect(page.getByTestId("os-heading")).toHaveText(
      `Operating systems (${expected.length})`,
    );
    await expect(page.getByTestId("os-section")).toContainText(text);
    const items = page.getByTestId("os-list").locator("li");
    await expect(items.getByRole("link")).toHaveText(expected.map(([os]) => os));
    await expect(items.first()).toContainText(hostsLabel(expected[0][1]));
  }
});

test("operating systems tab is hidden on OS and host pages", async ({
  page,
}) => {
  await page.goto(`/entry/os/${encodeURIComponent(someHost.os)}`);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await expect(page.getByTestId("ports-heading")).toBeVisible();
  await expect(page.getByTestId("hosts-heading")).toBeVisible();
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await expect(page.getByTestId("related-hosts")).toHaveCount(0);
  // Ports tab is hidden on port pages, but the other two remain.
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("ports-heading")).toHaveCount(0);
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await expect(page.getByTestId("hosts-heading")).toBeVisible();
  // IP addresses get all three tabs like any other non-host entry.
  await page.goto(`/entry/ip/${encodeURIComponent(someHost.ips[0])}`);
  await expect(page.getByTestId("os-heading")).toBeVisible();
});

test("group page aggregates listening ports of its hosts", async ({
  page,
}) => {
  const group = groups.find((g) => g.name === "Windows")!;
  await page.goto(`${groupHref(group.name)}?tab=ports`);
  await expectAggregatedPorts(
    page,
    hosts.filter((h) => inGroup(h, group)),
  );
});

test("software page aggregates listening ports of its hosts", async ({
  page,
}) => {
  await page.goto("/entry/software/dpkg?tab=ports");
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
  await page.goto("/entry/port/22?tab=hosts");
  await expect(page.getByTestId("hosts-heading")).toHaveText(
    `Hosts (${hosts.length})`,
  );
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts listening on port 22.",
  );
  await expect(page.getByText("Linked hosts")).toHaveCount(0);

  await page.goto("/entry/software/dpkg?tab=hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts with dpkg installed.",
  );
  await expect(page.getByTestId("ports-heading")).toHaveText(/^Ports \(\d+\)$/);
  await openTab(page, "ports");
  await expect(page.getByTestId("ports-description")).toHaveText(
    "The hosts are listening to these ports:",
  );
  await expect(page.getByText("Listening ports")).toHaveCount(0);
});

test("the number of hosts on a port links to a search of those hosts", async ({
  page,
}) => {
  const group = groups.find((g) => g.name === "Windows")!;
  const selected = hosts.filter((h) => inGroup(h, group));
  // Pick a port that not every Windows host listens on, if there is one.
  const counts = new Map<number, number>();
  for (const h of selected)
    for (const p of h["ports-listening"]) counts.set(p, (counts.get(p) ?? 0) + 1);
  const [port, n] =
    [...counts.entries()].find(([, c]) => c < selected.length) ??
    [...counts.entries()][0];
  const expected = selected.filter((h) => h["ports-listening"].includes(port));
  expect(expected.length).toBe(n);

  await page.goto(`${groupHref(group.name)}?tab=ports`);
  const item = page
    .getByTestId("aggregated-port")
    .filter({ has: page.getByRole("link", { name: String(port), exact: true }) });
  await item.getByTestId("port-hosts-link").click();

  await expect(page).toHaveURL(/\/search\?q=port%3A/);
  await expect(page.getByTestId("search-input").nth(1)).toHaveValue(
    `port:${port} group:Windows`,
  );
  await expect(page.getByTestId("search-summary")).toHaveText(
    `${n} ${n === 1 ? "host" : "hosts"} matching port ${port}, group Windows.`,
  );
  const items = page.getByTestId("host-item");
  await expect(items).toHaveCount(expected.length);
  for (const h of expected) {
    await expect(
      items.getByRole("link", { name: h.hostname, exact: true }),
    ).toBeVisible();
  }
});

test("search filters with quoted values and free text", async ({ page }) => {
  const os = someHost.os;
  const expected = hosts.filter(
    (h) => h.os === os && h["ports-listening"].includes(22),
  );
  await page.goto(`/search?q=${encodeURIComponent(`os:"${os}" port:22`)}`);
  await expect(page.getByTestId("host-item")).toHaveCount(expected.length);

  // Free text narrows by hostname.
  const word = someHost.hostname.split("-")[0];
  await page.goto(`/search?q=${encodeURIComponent(`os:"${os}" ${word}`)}`);
  await expect(page.getByTestId("search-summary")).toContainText(
    `with “${word}” in the hostname`,
  );
  await expect(page.getByTestId("host-item")).toHaveCount(
    hosts.filter((h) => h.os === os && h.hostname.includes(word)).length,
  );

  // Unknown filter values match nothing.
  await page.goto("/search?q=port:1");
  await expect(page.getByTestId("search-summary")).toHaveText(
    "0 hosts matching port 1.",
  );
});

test("port and host pages do not aggregate ports", async ({ page }) => {
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("aggregated-ports")).toHaveCount(0);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("aggregated-ports")).toHaveCount(0);
});

test("host lists show abbreviated ID, OS and IP addresses", async ({
  page,
}) => {
  // Hosts are listed 50 per page in host key order; go to our host's page.
  const sortedIds = hosts.map((h) => h.id).sort();
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / 50) + 1;
  await page.goto(`/entry/port/22?tab=hosts${ourPage > 1 ? `&page=${ourPage}` : ""}`);
  const item = page
    .getByTestId("linked-hosts")
    .locator("li", { hasText: someHost.hostname })
    .first();
  // Hostname links to the host, the ID is abbreviated with the full ID on hover.
  await expect(
    item.getByRole("link", { name: someHost.hostname, exact: true }),
  ).toHaveAttribute("href", `/entry/host/${encodeURIComponent(someHost.id)}`);
  const shortId = item.locator(".host-id");
  await expect(shortId).toHaveText(`(${someHost.id.slice(0, 12)}…)`);
  await expect(shortId).toHaveAttribute("title", someHost.id);
  await expect(item).not.toContainText(someHost.id);
  // OS and every IP address are shown and clickable.
  await expect(
    item.getByRole("link", { name: someHost.os, exact: true }),
  ).toHaveAttribute("href", `/entry/os/${encodeURIComponent(someHost.os)}`);
  for (const ip of someHost.ips) {
    await expect(item.getByRole("link", { name: ip, exact: true })).toHaveAttribute(
      "href",
      `/entry/ip/${encodeURIComponent(ip)}`,
    );
  }
});

test("MAC addresses are linked both ways", async ({ page }) => {
  expect(someHost.macs.length).toBeGreaterThan(0);
  const mac = someHost.macs[0];
  expect(mac).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);

  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const details = page.getByTestId("host-details");
  await expect(details).toContainText("MAC addresses");
  for (const m of someHost.macs) {
    await expect(details.getByRole("link", { name: m, exact: true })).toHaveAttribute(
      "href",
      `/entry/mac/${encodeURIComponent(m)}`,
    );
  }

  await details.getByRole("link", { name: mac, exact: true }).click();
  await expect(page).toHaveURL(`/entry/mac/${encodeURIComponent(mac)}`);
  await expect(page.getByTestId("entry-name")).toHaveText(mac);
  await expect(page.getByTestId("entry-description")).toContainText(
    "MAC address",
  );
  await openTab(page, "hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    `Hosts with a network interface with the MAC address ${mac}.`,
  );
  const owners = hosts.filter((h) => h.macs.includes(mac));
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(
    owners.length,
  );
  await expect(
    page
      .getByTestId("linked-hosts")
      .getByRole("link", { name: someHost.hostname, exact: true }),
  ).toBeVisible();
});

test("user and OS pages show info.json descriptions or a fallback", async ({
  page,
}) => {
  const users = info.users as Record<string, { description: string }>;
  const oses = info.os as Record<string, { description: string }>;

  await page.goto("/entry/user/root");
  await expect(page.getByTestId("entry-description")).toHaveText(
    users["root"].description,
  );
  await page.goto(`/entry/os/${encodeURIComponent("Ubuntu 24")}`);
  await expect(page.getByTestId("entry-description")).toHaveText(
    oses["Ubuntu 24"].description,
  );

  // Every user and OS in the data is either described or gets the fallback.
  const allUsers = [...new Set(hosts.flatMap((h) => h["local-users"]))];
  for (const user of allUsers) {
    await page.goto(`/entry/user/${encodeURIComponent(user)}`);
    await expect(page.getByTestId("entry-description")).toHaveText(
      users[user]?.description ?? "No information available about this user.",
    );
  }
  const allOs = [...new Set(hosts.map((h) => h.os))];
  for (const os of allOs) {
    await page.goto(`/entry/os/${encodeURIComponent(os)}`);
    await expect(page.getByTestId("entry-description")).toHaveText(
      oses[os]?.description ??
        "No information available about this operating system.",
    );
  }
});

test("missing OS information shows the fallback sentence", async ({ page }) => {
  const oses = info.os as Record<string, { description: string }>;
  const missing = [...new Set(hosts.map((h) => h.os))].find((os) => !oses[os]);
  test.skip(!missing, "every operating system in the data is described");
  await page.goto(`/entry/os/${encodeURIComponent(missing!)}`);
  await expect(page.getByTestId("entry-description")).toHaveText(
    "No information available about this operating system.",
  );
});

test("entries with links in info.json show them as external links", async ({
  page,
}) => {
  const port22 = info.ports["22"] as {
    links?: { title: string; source?: string; url: string }[];
  };
  expect(port22.links!.length).toBeGreaterThan(0);
  await page.goto("/entry/port/22");
  const links = page.getByTestId("external-links");
  await expect(links).toContainText("Read more:");
  // Links name the article and the site, e.g. "Secure Shell" on Wikipedia.
  await expect(
    links.getByRole("link", { name: '"Secure Shell" on Wikipedia', exact: true }),
  ).toBeVisible();
  for (const link of port22.links!) {
    const label =
      link.source === "Wikipedia"
        ? `"${link.title}" on ${link.source}`
        : link.url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    const a = links.getByRole("link", { name: label, exact: true });
    await expect(a).toHaveAttribute("href", link.url);
    await expect(a).toHaveAttribute("target", "_blank");
    await expect(a).toHaveAttribute("rel", /noopener/);
  }

  // Entries can have several links; every host listens on port 5308.
  const port5308 = info.ports["5308"] as { links: unknown[] };
  expect(port5308.links.length).toBeGreaterThan(1);
  await page.goto("/entry/port/5308");
  await expect(page.getByTestId("external-links").getByRole("link")).toHaveCount(
    port5308.links.length,
  );
});

test("well-known entries show a logo and official links", async ({ page }) => {
  await page.goto("/entry/software/nginx");
  const logo = page.getByTestId("entry-logo");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /cdn\.simpleicons\.org\/nginx/);
  await expect(logo).toHaveAttribute("alt", "nginx logo");
  const links = page.getByTestId("external-links");
  // Non-Wikipedia links are shown as their bare address.
  await expect(links.getByRole("link", { name: "nginx.org", exact: true })).toHaveAttribute(
    "href",
    "https://nginx.org/",
  );
  await expect(
    links.getByRole("link", { name: "github.com/nginx/nginx", exact: true }),
  ).toHaveAttribute("href", "https://github.com/nginx/nginx");
  await expect(
    links.getByRole("link", { name: '"Nginx" on Wikipedia', exact: true }),
  ).toBeVisible();

  // Ports and operating systems can have logos too.
  await page.goto("/entry/port/3306");
  await expect(page.getByTestId("entry-logo")).toHaveAttribute(
    "src",
    /cdn\.simpleicons\.org\/mysql/,
  );
  await page.goto(`/entry/os/${encodeURIComponent("Ubuntu 24")}`);
  await expect(page.getByTestId("entry-logo")).toHaveAttribute(
    "src",
    /cdn\.simpleicons\.org\/ubuntu/,
  );

  // Entries without a logo show none.
  await page.goto("/entry/user/root");
  await expect(page.getByTestId("entry-logo")).toHaveCount(0);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("entry-logo")).toHaveCount(0);
});

test("special IP addresses are described exactly or by range", async ({
  page,
}) => {
  // Every host has the loopback address.
  await page.goto("/entry/ip/127.0.0.1");
  await expect(page.getByTestId("entry-description")).toHaveText(
    (info.ips as Record<string, { description: string }>)["127.0.0.1"].description,
  );
  await expect(
    page
      .getByTestId("external-links")
      .getByRole("link", { name: '"Localhost" on Wikipedia', exact: true }),
  ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Localhost");

  // Private addresses are described by their range.
  const privateIp = hosts.flatMap((h) => h.ips).find((ip) => ip.startsWith("10."));
  test.skip(!privateIp, "no 10.x.x.x address in the generated data");
  await page.goto(`/entry/ip/${encodeURIComponent(privateIp!)}`);
  await expect(page.getByTestId("entry-description")).toContainText(
    "Private network address (RFC 1918)",
  );
  await expect(
    page
      .getByTestId("external-links")
      .getByRole("link", { name: '"Private network" on Wikipedia', exact: true }),
  ).toBeVisible();

  // Public addresses keep the generic description and have no links.
  const publicIp = hosts
    .flatMap((h) => h.ips)
    .find((ip) => /^(3|13|18|34|52|54)\./.test(ip));
  test.skip(!publicIp, "no public IPv4 address in the generated data");
  await page.goto(`/entry/ip/${encodeURIComponent(publicIp!)}`);
  await expect(page.getByTestId("entry-description")).toHaveText(
    "An IP address (IPv4 or IPv6).",
  );
  await expect(page.getByTestId("external-links")).toHaveCount(0);
});

test("entries without links show no links section", async ({ page }) => {
  // Hosts and MAC addresses have no hard coded information at all.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("external-links")).toHaveCount(0);
  await page.goto(`/entry/mac/${encodeURIComponent(someHost.macs[0])}`);
  await expect(page.getByTestId("external-links")).toHaveCount(0);

  // A described entry without links has none either.
  const users = info.users as Record<string, { links?: unknown[] }>;
  const plain = [...new Set(hosts.flatMap((h) => h["local-users"]))].find(
    (u) => users[u] && !users[u].links,
  );
  test.skip(!plain, "every user in the data has links");
  await page.goto(`/entry/user/${encodeURIComponent(plain!)}`);
  await expect(page.getByTestId("external-links")).toHaveCount(0);
});

test("search bar on any page finds entries by name", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await page.getByTestId("search-input").first().fill("ssh");
  await page.getByTestId("search-input").first().press("Enter");
  await expect(page).toHaveURL(/\/search\?q=ssh$/);

  const results = page.getByTestId("search-results").locator("li");
  await expect(results.first()).toBeVisible();
  // Port 22 is found by its common name, with type and description shown.
  const port22 = results.filter({ has: page.getByRole("link", { name: "22", exact: true }) });
  await expect(port22.locator(".type-badge")).toHaveText("port");
  await expect(port22).toContainText(info.ports["22"].description);
  // Software matching "ssh" is found too, typed as software.
  const openssh = results.filter({
    has: page.getByRole("link", { name: "openssh", exact: true }),
  });
  await expect(openssh.locator(".type-badge")).toHaveText("software");
  await expect(openssh).toContainText(info.software["openssh"].description);
});

test("search finds hosts by hostname and shows host details", async ({
  page,
}) => {
  await page.goto(`/search?q=${encodeURIComponent(someHost.hostname)}`);
  await expect(page.getByTestId("search-summary")).toContainText(
    `for “${someHost.hostname}”`,
  );
  const item = page.getByTestId("host-item").filter({
    has: page.getByRole("link", { name: someHost.hostname, exact: true }),
  });
  await expect(item.locator(".type-badge")).toHaveText("host");
  await expect(item).toContainText(`(${someHost.id.slice(0, 12)}…)`);
  await expect(item.getByRole("link", { name: someHost.os, exact: true })).toBeVisible();
  await expect(item.getByRole("link", { name: someHost.ips[0], exact: true })).toBeVisible();
  // No separate hostname entry duplicates the host.
  await expect(
    page.getByTestId("search-results").locator(".type-badge", { hasText: "hostname" }),
  ).toHaveCount(0);
});

test("search matches many types and descriptions", async ({ page }) => {
  await page.goto("/search?q=ubuntu");
  const results = page.getByTestId("search-results");
  const badges = await results.locator(".type-badge").allTextContents();
  expect(badges).toContain("os");
  expect(badges).toContain("group");
  expect(badges).toContain("software"); // apt, dpkg mention Ubuntu/Debian
  // Exact name matches come first.
  await expect(results.locator("li").first().getByRole("link").first()).toHaveText(
    "Ubuntu",
  );

  // A phrase that only appears in descriptions.
  await page.goto(`/search?q=${encodeURIComponent("remote login")}`);
  await expect(
    page.getByTestId("search-results").getByRole("link", { name: "22", exact: true }),
  ).toBeVisible();

  // Searching a port number finds the port.
  await page.goto("/search?q=5308");
  await expect(
    page.getByTestId("search-results").getByRole("link", { name: "5308", exact: true }),
  ).toBeVisible();
});

test("search handles empty queries and no results", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByTestId("search-hint")).toBeVisible();
  await expect(page.getByTestId("search-results")).toHaveCount(0);

  await page.goto("/search?q=zzzzqqqq");
  await expect(page.getByTestId("search-summary")).toHaveText(
    "No results for “zzzzqqqq”.",
  );
  await expect(page.getByTestId("search-results")).toHaveCount(0);
});

const pluralize = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const distinctOs = (selected: Host[]) => new Set(selected.map((h) => h.os)).size;
const distinctPorts = (selected: Host[]) =>
  new Set(selected.flatMap((h) => h["ports-listening"])).size;

test("entries show a sentence with numbers from the infrastructure", async ({
  page,
}) => {
  // Software: hosts and operating systems.
  const cronHosts = hosts.filter((h) => h.software.includes("cron"));
  const cronVersions = new Set(
    cronHosts.map((h) => (h["software-versions"] as unknown as Record<string, string>)["cron"]),
  ).size;
  await page.goto("/entry/software/cron");
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `cron is installed on ${pluralize(cronHosts.length, "host")} in your infrastructure, across ${pluralize(distinctOs(cronHosts), "operating system")}, in ${pluralize(cronVersions, "different version")}.`,
  );

  // OS: hosts and different ports.
  const os = someHost.os;
  const osHosts = hosts.filter((h) => h.os === os);
  await page.goto(`/entry/os/${encodeURIComponent(os)}`);
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `In your infrastructure, you have ${os} installed on ${pluralize(osHosts.length, "host")}, and these hosts are listening to ${pluralize(distinctPorts(osHosts), "different port")}.`,
  );

  // Port 22 is on every host.
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `Port 22 is open on ${hosts.length} hosts in your infrastructure, across ${pluralize(distinctOs(hosts), "operating system")}.`,
  );

  // Group: hosts, operating systems and ports.
  const windows = hostsInGroup("Windows");
  await page.goto(groupHref("Windows"));
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `This group has ${pluralize(windows.length, "host")} in your infrastructure, running ${pluralize(distinctOs(windows), "operating system")} and listening to ${pluralize(distinctPorts(windows), "different port")}.`,
  );
});

test("the summary sentence sits between description and read more links", async ({
  page,
}) => {
  await page.goto("/entry/port/22");
  const description = await page.getByTestId("entry-description").boundingBox();
  const summary = await page.getByTestId("entry-summary").boundingBox();
  const links = await page.getByTestId("external-links").boundingBox();
  expect(description!.y).toBeLessThan(summary!.y);
  expect(summary!.y).toBeLessThan(links!.y);

  // Hosts get a plain-language summary: OS, environment and likely role.
  const envWords: Record<string, string> = {
    production: "production",
    staging: "staging",
    testing: "testing",
    dev: "development",
  };
  const roleWords: Record<string, string> = {
    mail: "a mail server",
    webserver: "a web server",
    db: "a database server",
    dns: "a DNS server",
    ntp: "an NTP server",
    lb: "a load balancer",
    proxy: "a proxy server",
    firewall: "a firewall",
    hub: "a CFEngine hub",
    monitor: "a monitoring server",
    backup: "a backup server",
    client: "a client machine",
  };
  const described = hosts
    .map((h) => {
      const [prefix, ...rest] = h.hostname.split("-");
      const env = envWords[prefix.replace(/\d+$/, "")];
      const role = rest.map((w) => roleWords[w]).find(Boolean);
      return env && role ? { host: h, env, role } : undefined;
    })
    .find(Boolean)!;
  expect(described).toBeTruthy();
  await page.goto(`/entry/host/${encodeURIComponent(described.host.id)}`);
  const article = /^[aeiou]/i.test(described.host.os) ? "an" : "a";
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `This is ${article} ${described.host.os} host in the ${described.env} environment. It looks like ${described.role}.`,
  );
});

test("host summary covers environments and roles from hostnames", async ({
  page,
}) => {
  const envs: Record<string, string> = {
    production: "production",
    staging: "staging",
    testing: "testing",
    dev: "development",
  };
  const roles: Record<string, string> = {
    webserver: "a web server",
    lb: "a load balancer",
    db: "a database server",
    dns: "a DNS server",
    ntp: "an NTP server",
    hub: "a CFEngine hub",
    client: "a client machine",
  };
  const picked = new Set<string>();
  for (const host of hosts) {
    const [prefix, ...rest] = host.hostname.split("-");
    const env = envs[prefix.replace(/\d+$/, "")];
    const roleWord = rest.find((w) => roles[w]);
    if (!env || !roleWord || picked.has(roleWord)) continue;
    picked.add(roleWord);
    await page.goto(`/entry/host/${encodeURIComponent(host.id)}`);
    await expect(page.getByTestId("entry-summary")).toContainText(
      `host in the ${env} environment. It looks like ${roles[roleWord]}.`,
    );
    if (picked.size >= 3) break;
  }
  expect(picked.size).toBeGreaterThan(0);
});

test("every page has a prototype and AI disclaimer at the bottom", async ({
  page,
}) => {
  for (const url of ["/", "/entry/port/22", "/search?q=ssh"]) {
    await page.goto(url);
    const disclaimer = page.getByTestId("disclaimer");
    await expect(disclaimer).toContainText("prototype");
    await expect(disclaimer).toContainText("AI generated");
    await expect(disclaimer).toContainText("may contain mistakes");
    // It sits below the main content.
    const main = await page.locator("main").boundingBox();
    const footer = await disclaimer.boundingBox();
    expect(footer!.y).toBeGreaterThanOrEqual(main!.y + main!.height);
  }
});

test("host lists are paginated 50 at a time", async ({ page }) => {
  // Every host listens on port 22, and there are more than 50 hosts.
  expect(hosts.length).toBeGreaterThan(50);
  const total = hosts.length;
  const lastPage = Math.ceil(total / 50);
  await page.goto("/entry/port/22?tab=hosts");
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${total})`);
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(50);
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing 1–50 of ${total} hosts`,
  );
  const pagination = page.getByTestId("pagination");
  await expect(pagination.getByRole("link", { name: "← Previous" })).toHaveCount(0);

  await pagination.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/\/entry\/port\/22\?tab=hosts&page=2$/);
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(
    Math.min(50, total - 50),
  );
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing 51–${Math.min(100, total)} of ${total} hosts`,
  );
  await expect(pagination.getByRole("link", { name: "← Previous" })).toHaveAttribute(
    "href",
    "/entry/port/22?tab=hosts",
  );
  // The two pages show different hosts.
  const firstOnPage2 = await page
    .getByTestId("linked-hosts")
    .locator("li")
    .first()
    .textContent();
  await page.goto("/entry/port/22?tab=hosts");
  await expect(page.getByTestId("linked-hosts").locator("li").first()).not.toHaveText(
    firstOnPage2!,
  );

  // Out-of-range pages are clamped to the last page.
  await page.goto("/entry/port/22?tab=hosts&page=999");
  await expect(page.getByTestId("pagination").locator("[aria-current=page]")).toHaveText(
    String(lastPage),
  );

  // Short lists have no pagination.
  await page.goto(`${groupHref("Windows")}?tab=hosts`);
  await expect(page.getByTestId("pagination")).toHaveCount(0);
});

test("filtered host search results are paginated", async ({ page }) => {
  await page.goto("/search?q=port:22");
  await expect(page.getByTestId("host-item")).toHaveCount(50);
  await expect(page.getByTestId("search-summary")).toContainText(
    `${hosts.length} hosts matching port 22`,
  );
  await page.getByTestId("pagination").getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/\/search\?q=port%3A22&page=2$/);
  await expect(page.getByTestId("host-item")).toHaveCount(
    Math.min(50, hosts.length - 50),
  );
});

test("software and ports link to each other with See also", async ({
  page,
}) => {
  await page.goto("/entry/software/postgresql");
  const seeAlso = page.getByTestId("see-also");
  await expect(seeAlso).toContainText("See also:");
  await expect(
    seeAlso.getByRole("link", { name: "port 5432 (postgresql)", exact: true }),
  ).toHaveAttribute("href", "/entry/port/5432");
  // It sits between the title and the description.
  const title = await page.getByTestId("entry-name").boundingBox();
  const seeAlsoBox = await seeAlso.boundingBox();
  const description = await page.getByTestId("entry-description").boundingBox();
  expect(title!.y).toBeLessThan(seeAlsoBox!.y);
  expect(seeAlsoBox!.y).toBeLessThan(description!.y);

  await seeAlso.getByRole("link", { name: "port 5432 (postgresql)" }).click();
  await expect(page).toHaveURL("/entry/port/5432");
  await expect(
    page.getByTestId("see-also").getByRole("link", {
      name: "software postgresql",
      exact: true,
    }),
  ).toHaveAttribute("href", "/entry/software/postgresql");

  // Software with several ports lists them all; a port used by several
  // programs lists them all (apache and nginx both serve port 80).
  await page.goto("/entry/software/apache");
  await expect(page.getByTestId("see-also").getByRole("link")).toHaveText([
    "port 80 (http)",
    "port 443 (https)",
  ]);
  await page.goto("/entry/port/80");
  const port80 = page.getByTestId("see-also");
  await expect(port80).toContainText("software apache");
  await expect(port80).toContainText("software nginx");

  // Entries with nothing related have no See also line.
  await page.goto("/entry/software/curl");
  await expect(page.getByTestId("see-also")).toHaveCount(0);
  await page.goto("/entry/user/root");
  await expect(page.getByTestId("see-also")).toHaveCount(0);
});

test("hosts have pixel avatars coloured by operating system", async ({
  page,
}) => {
  const osColors = info.os as Record<string, { color?: string }>;
  const cellsOf = async (avatar: import("@playwright/test").Locator) =>
    avatar.locator("rect[fill]").evaluateAll((rects) =>
      rects.map((r) => `${r.getAttribute("x")},${r.getAttribute("y")}`),
    );

  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const avatar = page.getByTestId("host-avatar");
  await expect(avatar).toBeVisible();
  const expectedColor = osColors[someHost.os]?.color;
  if (expectedColor) await expect(avatar).toHaveAttribute("data-color", expectedColor);
  const cells = await cellsOf(avatar);
  expect(cells.length).toBeGreaterThan(0);
  // Horizontally symmetric 5x5 pattern.
  for (const cell of cells) {
    const [x, y] = cell.split(",").map(Number);
    expect(cells).toContain(`${4 - x},${y}`);
  }
  // Stable: the same host gets the same pattern in a list.
  const sortedIds = hosts.map((h) => h.id).sort();
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / 50) + 1;
  await page.goto(`/entry/port/22?tab=hosts${ourPage > 1 ? `&page=${ourPage}` : ""}`);
  const item = page.getByTestId("host-item").filter({
    has: page.getByRole("link", { name: someHost.hostname, exact: true }),
  });
  expect(await cellsOf(item.getByTestId("host-avatar"))).toEqual(cells);

  // Same OS, same colour; different OS family, different colour.
  const sameOs = hosts.find((h) => h.os === someHost.os && h.id !== someHost.id);
  const otherOs = hosts.find((h) => h.os.split(" ")[0] !== someHost.os.split(" ")[0]);
  const colorOf = async (h: Host) => {
    await page.goto(`/entry/host/${encodeURIComponent(h.id)}`);
    return page.getByTestId("host-avatar").getAttribute("data-color");
  };
  const ours = await colorOf(someHost);
  if (sameOs) expect(await colorOf(sameOs)).toBe(ours);
  expect(await colorOf(otherOs!)).not.toBe(ours);
  // Two different hosts get different patterns (with overwhelming odds).
  const otherCells = await cellsOf(page.getByTestId("host-avatar"));
  expect(otherCells).not.toEqual(cells);
});

test("hosts have classes which work like groups", async ({ page }) => {
  expect(someHost.classes.length).toBeGreaterThan(0);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const classes = page.getByTestId("host-classes");
  await expect(classes.getByRole("link")).toHaveText(someHost.classes);
  await expect(classes.getByRole("link", { name: "any", exact: true })).toHaveAttribute(
    "href",
    "/entry/class/any",
  );

  // "any" is set on every host; the class page looks like a group page.
  await classes.getByRole("link", { name: "any", exact: true }).click();
  await expect(page).toHaveURL("/entry/class/any");
  await expect(page.getByTestId("entry-description")).toHaveText(
    (info.classes as Record<string, { description: string }>)["any"].description,
  );
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `This class is set on ${hosts.length} hosts in your infrastructure, running ${pluralize(distinctOs(hosts), "operating system")} and listening to ${pluralize(distinctPorts(hosts), "different port")}.`,
  );
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await expect(page.getByTestId("ports-heading")).toBeVisible();
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${hosts.length})`);
  await openTab(page, "hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts with the class any set.",
  );

  // A distribution class only lists hosts of that distribution.
  const ubuntuHosts = hosts.filter((h) => h.classes.includes("ubuntu"));
  expect(ubuntuHosts.length).toBeGreaterThan(0);
  expect(ubuntuHosts.every((h) => h.os.startsWith("Ubuntu"))).toBe(true);
  await page.goto("/entry/class/ubuntu");
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${ubuntuHosts.length})`);

  // Classes can be used as search filters like any other type.
  await page.goto(`/search?q=${encodeURIComponent("class:ubuntu port:22")}`);
  await expect(page.getByTestId("search-summary")).toContainText(
    `${ubuntuHosts.length} hosts matching class ubuntu, port 22`,
  );

  // Hubs get policy server classes; unknown classes get a fallback text.
  const hub = hosts.find((h) => h.hostname.includes("-hub-"));
  if (hub) expect(hub.classes).toContain("policy_server");
  const undocumented = [...new Set(hosts.flatMap((h) => h.classes))].find(
    (c) => !(info.classes as Record<string, unknown>)[c],
  );
  test.skip(!undocumented, "every class in the data is described");
  await page.goto(`/entry/class/${encodeURIComponent(undocumented!)}`);
  await expect(page.getByTestId("entry-description")).toHaveText(
    "No information available about this class.",
  );
});

test("software has versions which are entries of their own", async ({
  page,
}) => {
  // cfengine is on every host, with a handful of shared versions.
  expect(hosts.every((h) => h.software.includes("cfengine"))).toBe(true);
  const versions = new Map<string, number>();
  for (const h of hosts) {
    const v = (h["software-versions"] as unknown as Record<string, string>)["cfengine"];
    expect(v).toBeTruthy();
    versions.set(v, (versions.get(v) ?? 0) + 1);
  }
  expect(versions.size).toBeGreaterThan(1);
  expect(versions.size).toBeLessThan(10);

  await page.goto("/entry/software/cfengine");
  await expect(page.getByTestId("versions-heading")).toHaveText(
    `Versions (${versions.size})`,
  );
  const items = page.getByTestId("version-item");
  await expect(items).toHaveCount(versions.size);
  // Most hosts first, each version linking to its own entry.
  const ranked = [...versions.entries()].sort((a, b) => b[1] - a[1]);
  const [topVersion, topCount] = ranked[0];
  await expect(items.first()).toContainText(topVersion);
  await expect(items.first()).toContainText(`${topCount} hosts`);
  await expect(items.first().getByRole("link")).toHaveAttribute(
    "href",
    `/entry/version/${encodeURIComponent(`cfengine ${topVersion}`)}`,
  );
  await expect(page.getByTestId("entry-summary")).toContainText(
    `in ${versions.size} different versions`,
  );

  // The version page links back to the software and lists its hosts.
  await items.first().getByRole("link").click();
  await expect(page.getByTestId("entry-name")).toHaveText(`cfengine ${topVersion}`);
  await expect(page.getByTestId("entry-description")).toContainText(
    `Version ${topVersion} of cfengine.`,
  );
  await expect(
    page.getByTestId("see-also").getByRole("link", { name: "software cfengine", exact: true }),
  ).toHaveAttribute("href", "/entry/software/cfengine");
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${topCount})`);
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await openTab(page, "hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    `Hosts with cfengine version ${topVersion} installed.`,
  );
});

test("host pages show software versions as links", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const software = page.getByTestId("host-software");
  const versionsOf = someHost["software-versions"] as unknown as Record<string, string>;
  for (const sw of someHost.software) {
    await expect(software.getByRole("link", { name: sw, exact: true })).toHaveAttribute(
      "href",
      `/entry/software/${encodeURIComponent(sw)}`,
    );
    const version = versionsOf[sw];
    if (!version) continue;
    const item = software.locator(".software-with-version", {
      has: page.getByRole("link", { name: sw, exact: true }),
    });
    await expect(item.getByRole("link", { name: version, exact: true })).toHaveAttribute(
      "href",
      `/entry/version/${encodeURIComponent(`${sw} ${version}`)}`,
    );
  }
});

test("avatars show an online/offline dot and about 70% of hosts are online", async ({
  page,
}) => {
  const online = hosts.filter((h) => h.online).length;
  expect(online / hosts.length).toBeGreaterThan(0.55);
  expect(online / hosts.length).toBeLessThan(0.85);

  const onlineHost = hosts.find((h) => h.online)!;
  const offlineHost = hosts.find((h) => !h.online)!;
  for (const host of [onlineHost, offlineHost]) {
    await page.goto(`/entry/host/${encodeURIComponent(host.id)}`);
    const wrap = page.getByTestId("host-avatar-wrap");
    const dot = wrap.getByTestId("host-status");
    await expect(dot).toHaveAttribute("data-online", String(host.online));
    await expect(wrap).toHaveAttribute("title", host.online ? "Online" : "Offline");
    await expect(dot).toHaveCSS(
      "background-color",
      host.online ? "rgb(34, 197, 94)" : "rgb(156, 163, 175)",
    );
    // The dot sits in the bottom right corner of the avatar.
    const a = (await wrap.boundingBox())!;
    const d = (await dot.boundingBox())!;
    expect(d.x + d.width / 2).toBeGreaterThan(a.x + a.width * 0.7);
    expect(d.y + d.height / 2).toBeGreaterThan(a.y + a.height * 0.7);
  }

  // Dots appear in host lists too, and the avatar is vertically centred
  // with the badge and the text next to it.
  await page.goto("/entry/port/22?tab=hosts");
  const item = page.getByTestId("host-item").first();
  await expect(item.getByTestId("host-status")).toHaveCount(1);
  const avatar = (await item.getByTestId("host-avatar-wrap").boundingBox())!;
  const summary = (await item.locator(".host-summary").boundingBox())!;
  const badge = (await item.locator(".type-badge").boundingBox())!;
  const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(Math.abs(centre(avatar) - centre(summary))).toBeLessThan(2);
  expect(Math.abs(centre(avatar) - centre(badge))).toBeLessThan(2);
});

test("See also links entries of different types with matching names", async ({
  page,
}) => {
  const seeAlsoLink = (name: string) =>
    page.getByTestId("see-also").getByRole("link", { name, exact: true });

  // Group "Linux" <-> class "linux".
  await page.goto(groupHref("Linux"));
  await expect(seeAlsoLink("linux (class)")).toHaveAttribute("href", "/entry/class/linux");
  await seeAlsoLink("linux (class)").click();
  await expect(page).toHaveURL("/entry/class/linux");
  await expect(seeAlsoLink("Linux (group)")).toHaveAttribute(
    "href",
    `/entry/group/${encodeURIComponent("Linux")}`,
  );

  // Class "cfengine" <-> software "cfengine", and the port named cfengine.
  await page.goto("/entry/class/cfengine");
  await expect(seeAlsoLink("software cfengine")).toHaveAttribute(
    "href",
    "/entry/software/cfengine",
  );
  await expect(seeAlsoLink("port 5308 (cfengine)")).toHaveAttribute(
    "href",
    "/entry/port/5308",
  );
  await page.goto("/entry/software/cfengine");
  await expect(seeAlsoLink("cfengine (class)")).toHaveAttribute(
    "href",
    "/entry/class/cfengine",
  );

  // Class "ubuntu_24" <-> OS "Ubuntu 24" (case and punctuation ignored).
  const ubuntu24 = hosts.find((h) => h.os === "Ubuntu 24");
  test.skip(!ubuntu24, "no Ubuntu 24 host in the generated data");
  await page.goto("/entry/class/ubuntu_24");
  await expect(seeAlsoLink("Ubuntu 24 (OS)")).toHaveAttribute(
    "href",
    `/entry/os/${encodeURIComponent("Ubuntu 24")}`,
  );
  await page.goto(`/entry/os/${encodeURIComponent("Ubuntu 24")}`);
  await expect(seeAlsoLink("ubuntu_24 (class)")).toHaveAttribute(
    "href",
    "/entry/class/ubuntu_24",
  );
  // Group "Ubuntu" <-> class "ubuntu".
  await page.goto(groupHref("Ubuntu"));
  await expect(seeAlsoLink("ubuntu (class)")).toBeVisible();
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

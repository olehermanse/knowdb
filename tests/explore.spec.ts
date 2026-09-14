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
// Lists are paginated this many items at a time (components/Pagination.tsx).
const PAGE_SIZE = 10;

// Related hosts are shown in tabs; open one by clicking its tab.
// The right side has sections, not tabs: "opening" one just checks it is there.
const SECTIONS: Record<string, string> = {
  os: "section-os",
  clouds: "section-clouds",
  hosts: "section-list",
};
async function openTab(
  page: import("@playwright/test").Page,
  tab: "os" | "clouds" | "ports" | "hosts" | "similar" | "resources" | "comments",
) {
  if (tab === "hosts") {
    // The host list is the "List" tab on the right.
    await page.getByTestId("list-tab").click();
    await expect(page.getByTestId("section-list")).toBeVisible();
    return;
  }
  if (SECTIONS[tab]) {
    // Charts is the default tab on the right.
    await expect(page.getByTestId(SECTIONS[tab])).toBeVisible();
    return;
  }
  await page.getByTestId(`${tab}-heading`).click();
  await expect(page.getByTestId(`tab-${tab}`)).toBeVisible();
}

// Expected ports of a set of hosts, ascending by port number, with the
// number of hosts listening on each.
function expectedPorts(selected: Host[]) {
  const counts = new Map<number, number>();
  for (const host of selected) {
    for (const port of new Set(host["ports-listening"])) {
      counts.set(port, (counts.get(port) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([port, n]) => ({
      port,
      name: (info.ports[String(port) as keyof typeof info.ports] as { name?: string } | undefined)
        ?.name,
      hosts: `${n} ${n === 1 ? "host" : "hosts"}`,
    }));
}

async function expectAggregatedPorts(
  page: import("@playwright/test").Page,
  selected: Host[],
) {
  const expected = expectedPorts(selected);
  expect(expected.length).toBeGreaterThan(1);
  const items = page.getByTestId("aggregated-port");
  await expect(items).toHaveCount(Math.min(PAGE_SIZE, expected.length));
  await expect(page.getByTestId("pagination")).toHaveCount(expected.length > PAGE_SIZE ? 1 : 0);
  // One card per port: badge, port link, common name and host count link.
  for (const [i, { port, name, hosts }] of expected.slice(0, PAGE_SIZE).entries()) {
    const item = items.nth(i);
    await expect(item.locator(".type-badge")).toHaveText("port");
    await expect(item.getByRole("link", { name: String(port), exact: true })).toHaveAttribute(
      "href",
      `/entry/port/${port}`,
    );
    if (name) await expect(item).toContainText(`(${name})`);
    await expect(item.getByTestId("port-hosts-link")).toHaveText(hosts);
  }
  // Every host listens on 22, so the first card counts all selected hosts.
  const first = items.first();
  await expect(first.getByTestId("port-hosts-link")).toHaveText(`${selected.length} hosts`);
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
  await expect(page.getByText("Or pick one of the randomly selected entries below:")).toBeVisible();
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
    "cloud",
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
  // Host pages have no generic type description, only the summary sentence.
  await expect(page.getByTestId("entry-description")).toHaveCount(0);
  await expect(page.getByTestId("entry-summary")).toContainText("This is");
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

test("single-host hostnames, IPs and MACs show the host view and only entry tabs", async ({
  page,
}) => {
  // The hostname link on a host page leads to the hostname's own page.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const hostnameLink = page
    .getByTestId("host-details")
    .getByRole("link", { name: someHost.hostname, exact: true });
  await expect(hostnameLink).toHaveAttribute(
    "href",
    `/entry/hostname/${encodeURIComponent(someHost.hostname)}`,
  );
  await hostnameLink.click();
  await expect(page).toHaveURL(`/entry/hostname/${encodeURIComponent(someHost.hostname)}`);
  await expect(page.getByTestId("entry-name")).toHaveText(someHost.hostname);

  const onlyHostsAndSimilar = async () => {
    // Left: just the Similar and Resources tabs. Right: the host view itself.
    const leftTabs = page.getByTestId("entry-tabs").getByRole("tab");
    await expect(leftTabs).toHaveCount(3);
    await expect(leftTabs.nth(0)).toContainText("Similar");
    await expect(leftTabs.nth(1)).toContainText("Resources");
    await expect(leftTabs.nth(2)).toContainText("Comments");
    // The host preview has no comments; the host's own page does.
    await expect(page.getByTestId("hosts-pane").getByTestId("comments")).toHaveCount(0);
    await expect(page.getByTestId("hosts-sections")).toHaveCount(0);
    await expect(page.getByTestId("os-heading")).toHaveCount(0);
    await expect(page.getByTestId("clouds-heading")).toHaveCount(0);
    await expect(page.getByTestId("ports-heading")).toHaveCount(0);
    await expect(page.getByTestId("hosts-heading")).toHaveCount(0);
    const pane = page.getByTestId("hosts-pane");
    // The host sits in a bordered card.
    const card = pane.getByTestId("pane-host-view");
    await expect(card).toHaveCSS("border-top-width", "1px");
    await expect(card).toHaveCSS("border-top-style", "solid");
    expect(parseFloat(await card.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(0);
    await expect(pane.getByTestId("pane-entry-name")).toContainText(someHost.hostname);
    await expect(pane.getByTestId("pane-entry-summary")).toContainText("This is");
    // An arrow in the card's bottom right corner opens the host's own page.
    const open = pane.getByTestId("pane-open-host");
    await expect(open).toHaveAttribute("href", `/entry/host/${encodeURIComponent(someHost.id)}`);
    const cardBox = (await card.boundingBox())!;
    const openBox = (await open.boundingBox())!;
    expect(openBox.x + openBox.width).toBeGreaterThan(cardBox.x + cardBox.width * 0.9);
    expect(openBox.y + openBox.height).toBeGreaterThan(cardBox.y + cardBox.height * 0.9);
    expect(openBox.y + openBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
    await expect(pane.getByTestId("host-details")).toBeVisible();
    await expect(
      pane.getByTestId("host-details").getByRole("link", { name: someHost.os, exact: true }),
    ).toBeVisible();
  };
  await onlyHostsAndSimilar();
  await page.getByTestId("pane-open-host").click();
  await expect(page).toHaveURL(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("entry-name")).toContainText(someHost.hostname);
  await expect(page.getByTestId("pane-open-host")).toHaveCount(0);

  // Same for an IP address only this host has, and for its MAC address.
  const ipCounts = new Map<string, number>();
  for (const h of hosts) for (const ip of h.ips) ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
  const ownIp = someHost.ips.find((ip) => ipCounts.get(ip) === 1);
  if (ownIp) {
    await page.goto(`/entry/ip/${encodeURIComponent(ownIp)}`);
    await onlyHostsAndSimilar();
  }
  await page.goto(`/entry/mac/${encodeURIComponent(someHost.macs[0])}`);
  await onlyHostsAndSimilar();

  // Shared addresses keep all their tabs.
  await page.goto("/entry/ip/127.0.0.1");
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await expect(page.getByTestId("ports-heading")).toBeVisible();
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

  // Port 22 links back to every host, a page at a time, including the one we
  // came from (hosts are listed in host key order).
  await openTab(page, "hosts");
  const linkedHosts = page.getByTestId("linked-hosts").locator("li");
  await expect(linkedHosts).toHaveCount(Math.min(PAGE_SIZE, hosts.length));
  const sortedIds = hosts.map((h) => h.id).sort();
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / PAGE_SIZE) + 1;
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
  // The title already says "22 (ssh)", so the description is just the text.
  await expect(page.getByTestId("entry-description")).toHaveText(info.ports["22"].description);
  await expect(page.getByTestId("entry-description")).not.toContainText("Port 22");

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
  await expect(linked).toHaveCount(Math.min(PAGE_SIZE, expected.length));
  // Everything on the first page is a member of the group.
  const shown = await linked.locator(".host-summary > div:first-child > a").allTextContents();
  expect(shown.length).toBeGreaterThan(0);
  for (const hostname of shown) {
    expect(expected.map((h) => h.hostname)).toContain(hostname);
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
  // Hosts are listed a page at a time in host key order; go to our host's page.
  const ubuntuIds = hostsInGroup("Ubuntu").map((h) => h.id).sort();
  const ubuntuPage = Math.floor(ubuntuIds.indexOf(ubuntuHost.id) / PAGE_SIZE) + 1;
  if (ubuntuPage > 1) {
    await page.getByTestId("pagination").getByRole("link", { name: String(ubuntuPage) }).click();
  }
  await page
    .getByTestId("linked-hosts")
    .getByRole("link", { name: ubuntuHost.hostname, exact: true })
    .click();
  await expect(page.getByTestId("entry-name")).toContainText(ubuntuHost.id);
});

test("every group in groups.json has an entry page", async ({ page }) => {
  test.slow();
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
  await page.goto(`${groupHref(name)}?htab=os`);

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

  // On the right, the Hosts heading sits above the operating systems
  // section; the ports tab lives on the left side, below the title.
  const osBox = (await page.getByTestId("os-heading").boundingBox())!;
  const hostsBox = (await page.getByTestId("hosts-heading").boundingBox())!;
  const portsBox = (await page.getByTestId("ports-heading").boundingBox())!;
  const titleBox = (await page.getByTestId("entry-header").boundingBox())!;
  expect(hostsBox.y).toBeLessThan(osBox.y);
  expect(portsBox.x).toBeLessThan(hostsBox.x);
  expect(hostsBox.y).toBeGreaterThan(titleBox.y + titleBox.height - 1);
  expect(titleBox.x).toBeLessThan(hostsBox.x);
});

test("operating systems beyond the palette fold into an Other slice", async ({
  page,
}) => {
  const name = groupWithOsCount((n) => n > 8);
  const expected = osCounts(hostsInGroup(name));
  await page.goto(`${groupHref(name)}?htab=os`);

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

test("the operating systems section is skipped with a single operating system", async ({
  page,
}) => {
  const group = groups.find(
    (g) => hostsInGroup(g.name).length > 1 && osCounts(hostsInGroup(g.name)).length === 1,
  );
  const cls = [...new Set(hosts.flatMap((h) => h.classes))].find((c) => {
    const hs = hosts.filter((h) => h.classes.includes(c));
    return hs.length > 1 && osCounts(hs).length === 1;
  });
  const name = group?.name ?? cls!;
  expect(name).toBeTruthy();
  await page.goto(group ? groupHref(name) : `/entry/class/${encodeURIComponent(name)}`);
  await expect(page.getByTestId("hosts-heading")).toBeVisible();
  await expect(page.getByTestId("section-os")).toHaveCount(0);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await expect(page.getByTestId("os-pie")).toHaveCount(0);
});

test("operating systems section is reused on software, port and user pages", async ({
  page,
}) => {
  const cases: [string, (h: Host) => boolean, string][] = [
    [
      "/entry/software/dpkg?htab=os",
      (h) => h.software.includes("dpkg"),
      "The hosts with dpkg installed run these operating systems:",
    ],
    [
      "/entry/port/22?htab=os",
      (h) => h["ports-listening"].includes(22),
      "Operating systems of the hosts listening to this port:",
    ],
    [
      "/entry/user/root?htab=os",
      (h) => h["local-users"].includes("root"),
      "Operating systems of the hosts with this local user:",
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
  await expect(page.getByTestId("entry-tabs")).toHaveCount(0);
  await expect(page.getByTestId("hosts-sections")).toHaveCount(0);
  // Ports tab is hidden on port pages, but the other two remain.
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("ports-heading")).toHaveCount(0);
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await expect(page.getByTestId("hosts-heading")).toBeVisible();
  // Shared IP addresses get all the tabs like any other non-host entry.
  await page.goto("/entry/ip/127.0.0.1");
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
  await page.goto(`/entry/os/${encodeURIComponent(os)}?tab=ports`);
  await expectAggregatedPorts(
    page,
    hosts.filter((h) => h.os === os),
  );
});

test("hosts and ports sections have short headings and descriptions", async ({
  page,
}) => {
  await page.goto("/entry/port/22?htab=list");
  await expect(page.getByTestId("hosts-heading")).toHaveText(
    `Hosts (${hosts.length})`,
  );
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts listening on port 22:",
  );
  await expect(page.getByText("Linked hosts")).toHaveCount(0);

  await page.goto("/entry/software/dpkg?htab=list");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    "Hosts with dpkg installed:",
  );
  await expect(page.getByTestId("ports-heading")).toHaveText(/^Ports \(\d+\)$/);
  await openTab(page, "ports");
  await expect(page.getByTestId("ports-description")).toHaveText(
    "The dpkg hosts are listening to these ports:",
  );
  await page.goto(`${groupHref("Windows")}?tab=ports`);
  await expect(page.getByTestId("ports-description")).toHaveText(
    "The hosts are listening to these ports:",
  );
  await page.goto(`/entry/os/${encodeURIComponent(someHost.os)}?tab=ports`);
  await expect(page.getByTestId("ports-description")).toHaveText(
    `The ${someHost.os} hosts are listening to these ports:`,
  );
  await page.goto("/entry/class/any?tab=ports");
  await expect(page.getByTestId("ports-description")).toHaveText(
    "The any hosts are listening to these ports:",
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

  const sortedPorts = [...counts.keys()].sort((a, b) => a - b);
  const portPage = Math.floor(sortedPorts.indexOf(port) / PAGE_SIZE) + 1;
  await page.goto(`${groupHref(group.name)}?tab=ports${portPage > 1 ? `&tpage=${portPage}` : ""}`);
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
  await expect(page.getByTestId("host-item")).toHaveCount(Math.min(PAGE_SIZE, expected.length));
  await expect(page.getByTestId("search-summary")).toContainText(
    `${expected.length} ${expected.length === 1 ? "host" : "hosts"} matching`,
  );

  // Free text narrows by hostname.
  const word = someHost.hostname.split("-")[0];
  await page.goto(`/search?q=${encodeURIComponent(`os:"${os}" ${word}`)}`);
  await expect(page.getByTestId("search-summary")).toContainText(
    `with “${word}” in the hostname`,
  );
  await expect(page.getByTestId("host-item")).toHaveCount(
    Math.min(PAGE_SIZE, hosts.filter((h) => h.os === os && h.hostname.includes(word)).length),
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
  // Hosts are listed a page at a time in host key order; go to our host's page.
  const sortedIds = hosts.map((h) => h.id).sort();
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / PAGE_SIZE) + 1;
  await page.goto(`/entry/port/22?htab=list${ourPage > 1 ? `&page=${ourPage}` : ""}`);
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
  // MAC addresses are unique, so the right pane is the host view itself.
  const owners = hosts.filter((h) => h.macs.includes(mac));
  expect(owners).toHaveLength(1);
  const pane = page.getByTestId("hosts-pane");
  await expect(pane.getByTestId("pane-entry-name")).toContainText(someHost.hostname);
  await expect(
    pane.getByTestId("host-details").getByRole("link", { name: mac, exact: true }),
  ).toHaveAttribute("href", `/entry/mac/${encodeURIComponent(mac)}`);
});

test("user and OS pages show info.json descriptions or a fallback", async ({
  page,
}) => {
  test.slow();
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
  // Links live in a Resources tab next to Similar.
  await expect(page.getByTestId("resources-heading")).toHaveText(
    `Resources (${port22.links!.length})`,
  );
  const similarBox = (await page.getByTestId("similar-heading").boundingBox())!;
  const resourcesBox = (await page.getByTestId("resources-heading").boundingBox())!;
  expect(resourcesBox.x).toBeGreaterThan(similarBox.x + similarBox.width - 1);
  await openTab(page, "resources");
  await expect(page.getByTestId("resources-description")).toHaveText("Read more about 22:");
  const links = page.getByTestId("external-links");
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
  await page.goto("/entry/port/5308?tab=resources");
  await expect(page.getByTestId("external-links").getByRole("link")).toHaveCount(
    port5308.links.length,
  );
});

test("well-known entries show a logo and official links", async ({ page }) => {
  await page.goto("/entry/software/nginx?tab=resources");
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

  const windows = hosts.find((h) => h.os.startsWith("Windows"));
  if (windows) {
    await page.goto(`/entry/os/${encodeURIComponent(windows.os)}`);
    await expect(page.getByTestId("entry-logo")).toHaveAttribute(
      "src",
      /upload\.wikimedia\.org\/.*Windows_logo/,
    );
  }

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
  await openTab(page, "resources");
  await expect(
    page
      .getByTestId("external-links")
      .getByRole("link", { name: '"Localhost" on Wikipedia', exact: true }),
  ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Localhost");

  // Private addresses are described by their range.
  const privateIp = hosts.flatMap((h) => h.ips).find((ip) => ip.startsWith("10."));
  test.skip(!privateIp, "no 10.x.x.x address in the generated data");
  await page.goto(`/entry/ip/${encodeURIComponent(privateIp!)}?tab=resources`);
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
  await expect(page.getByTestId("resources-heading")).toHaveText("Resources (0)");
  await expect(page.getByTestId("resources-heading")).toHaveAttribute("aria-disabled", "true");
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
  await page.goto(`/entry/user/${encodeURIComponent(plain!)}?tab=resources`);
  await expect(page.getByTestId("resources-heading")).toHaveAttribute("aria-disabled", "true");
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

test("search finds entries by their external resources", async ({ page }) => {
  // cloud.google.com is one of GCP's links, not part of its name or description.
  const gcp = hosts.some((h) => (h as unknown as { "cloud-provider": string })["cloud-provider"] === "GCP");
  test.skip(!gcp, "no GCP host in the generated data");
  await page.goto("/search?q=cloud.google.com");
  const results = page.getByTestId("search-results").locator("li");
  const gcpResult = results.filter({ has: page.getByRole("link", { name: "GCP", exact: true }) });
  await expect(gcpResult).toHaveCount(1);
  await expect(gcpResult.locator(".type-badge")).toHaveText("cloud");

  // A Wikipedia article title works too.
  await page.goto(`/search?q=${encodeURIComponent("Secure Shell")}`);
  await expect(
    page.getByTestId("search-results").getByRole("link", { name: "22", exact: true }),
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

test("description and summary form one paragraph", async ({
  page,
}) => {
  await page.goto("/entry/port/22");
  const paragraph = page.getByTestId("entry-text");
  expect(await paragraph.evaluate((el) => el.tagName)).toBe("P");
  // All three live inside it, in this order.
  const description = await page.getByTestId("entry-description").textContent();
  const summary = await page.getByTestId("entry-summary").textContent();
  const text = (await paragraph.textContent())!;
  expect(text.indexOf(description!)).toBe(0);
  expect(text.indexOf(summary!)).toBeGreaterThan(text.indexOf(description!));
  expect(text).not.toContain("Read more");
  // The parts share one style (same faded colour, same size).
  const style = (id: string) =>
    page.getByTestId(id).evaluate((el) => {
      const cs = getComputedStyle(el);
      return `${cs.color} ${cs.fontSize} ${cs.fontStyle}`;
    });
  expect(await style("entry-summary")).toBe(await style("entry-description"));
  // See also stays a separate line above it.
  const seeAlso = (await page.getByTestId("see-also").boundingBox())!;
  const box = (await paragraph.boundingBox())!;
  expect(seeAlso.y + seeAlso.height).toBeLessThanOrEqual(box.y + 1);

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
  const provider = (described.host as unknown as { "cloud-provider": string })["cloud-provider"];
  const where = provider ? `running in ${provider}` : "running in your own data center";
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `This is ${article} ${described.host.os} host in the ${described.env} environment, ${where}. It looks like ${described.role}.`,
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
      `host in the ${env} environment, running `,
    );
    await expect(page.getByTestId("entry-summary")).toContainText(
      `It looks like ${roles[roleWord]}.`,
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

test("host lists are paginated 10 at a time", async ({ page }) => {
  // Every host listens on port 22, and there are more than a page of hosts.
  expect(hosts.length).toBeGreaterThan(PAGE_SIZE);
  const total = hosts.length;
  const lastPage = Math.ceil(total / PAGE_SIZE);
  await page.goto("/entry/port/22?htab=list");
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${total})`);
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing 1–${PAGE_SIZE} of ${total} hosts`,
  );
  const pagination = page.getByTestId("pagination");
  await expect(pagination.getByRole("link", { name: "← Previous" })).toHaveCount(0);

  await pagination.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/\/entry\/port\/22\?htab=list&page=2$/);
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(
    Math.min(PAGE_SIZE, total - PAGE_SIZE),
  );
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing ${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, total)} of ${total} hosts`,
  );
  await expect(pagination.getByRole("link", { name: "← Previous" })).toHaveAttribute(
    "href",
    "/entry/port/22?htab=list",
  );
  // The two pages show different hosts.
  const firstOnPage2 = await page
    .getByTestId("linked-hosts")
    .locator("li")
    .first()
    .textContent();
  await page.goto("/entry/port/22?htab=list");
  await expect(page.getByTestId("linked-hosts").locator("li").first()).not.toHaveText(
    firstOnPage2!,
  );

  // Out-of-range pages are clamped to the last page.
  await page.goto("/entry/port/22?htab=list&page=999");
  await expect(page.getByTestId("pagination").locator("[aria-current=page]")).toHaveText(
    String(lastPage),
  );

  // Short lists have no pagination.
  await page.goto(`${groupHref("Windows")}?htab=list`);
  await expect(page.getByTestId("pagination")).toHaveCount(0);
});

test("filtered host search results are paginated", async ({ page }) => {
  await page.goto("/search?q=port:22");
  await expect(page.getByTestId("host-item")).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId("search-summary")).toContainText(
    `${hosts.length} hosts matching port 22`,
  );
  await page.getByTestId("pagination").getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/\/search\?q=port%3A22&page=2$/);
  await expect(page.getByTestId("host-item")).toHaveCount(
    Math.min(PAGE_SIZE, hosts.length - PAGE_SIZE),
  );
});

test("software and ports link to each other with See also", async ({
  page,
}) => {
  await page.goto("/entry/software/postgresql");
  const seeAlso = page.getByTestId("see-also");
  await expect(seeAlso).toContainText("See also:");
  await expect(seeAlso).toHaveCSS("font-style", "italic");
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
      name: "postgresql (software)",
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
  await expect(port80).toContainText("apache (software)");
  await expect(port80).toContainText("nginx (software)");

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
  const ourPage = Math.floor(sortedIds.indexOf(someHost.id) / PAGE_SIZE) + 1;
  await page.goto(`/entry/port/22?htab=list${ourPage > 1 ? `&page=${ourPage}` : ""}`);
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
  await expect(page.getByTestId("classes-modal-open")).toHaveText(
    `${someHost.classes.length} defined`,
  );
  await page.getByTestId("classes-modal-open").click();
  const classes = page.getByTestId("classes-modal-list");
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
    "Hosts with the class any set:",
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
  // The versions tab is the first tab on software pages, and only there.
  await expect(page.getByTestId("tab-versions")).toBeVisible();
  await expect(page.getByTestId("versions-description")).toHaveText(
    "Versions of cfengine in your infrastructure:",
  );
  const items = page.getByTestId("version-item");
  await expect(items).toHaveCount(versions.size);
  // Most hosts first, one card per version linking to its own entry, with
  // the host count linking to a search for those hosts.
  const ranked = [...versions.entries()].sort((a, b) => b[1] - a[1]);
  const [topVersion, topCount] = ranked[0];
  const first = items.first();
  await expect(first.locator(".type-badge")).toHaveText("version");
  // Named like in search results: "cfengine 3.27.0", with the description.
  await expect(
    first.getByRole("link", { name: `cfengine ${topVersion}`, exact: true }),
  ).toHaveAttribute("href", `/entry/version/${encodeURIComponent(`cfengine ${topVersion}`)}`);
  await expect(first).toContainText(`Version ${topVersion} of cfengine.`);
  await expect(first.getByTestId("version-hosts-link")).toHaveText(`${topCount} hosts`);
  await expect(first.getByTestId("version-hosts-link")).toHaveAttribute(
    "href",
    `/search?q=${encodeURIComponent(`version:"cfengine ${topVersion}"`)}`,
  );
  await expect(page.getByTestId("entry-summary")).toContainText(
    `in ${versions.size} different versions`,
  );
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("versions-heading")).toHaveCount(0);
  await page.goto(groupHref("Windows"));
  await expect(page.getByTestId("versions-heading")).toHaveCount(0);

  // The version page links back to the software and lists its hosts.
  await page.goto("/entry/software/cfengine");
  await items.first().getByRole("link", { name: `cfengine ${topVersion}`, exact: true }).click();
  await expect(page.getByTestId("entry-name")).toHaveText(`cfengine ${topVersion}`);
  await expect(page.getByTestId("entry-description")).toContainText(
    `Version ${topVersion} of cfengine.`,
  );
  await expect(
    page.getByTestId("see-also").getByRole("link", { name: "cfengine (software)", exact: true }),
  ).toHaveAttribute("href", "/entry/software/cfengine");
  // Version pages are kept short: only the See also line and one sentence.
  await expect(page.getByTestId("entry-description")).toHaveText(
    `Version ${topVersion} of cfengine.`,
  );
  await expect(page.getByTestId("entry-summary")).toHaveCount(0);
  await expect(page.getByTestId("external-links")).toHaveCount(0);
  await openTab(page, "os");
  await expect(page.getByTestId("os-section")).toContainText(
    `The cfengine ${topVersion} software version is installed on these operating systems:`,
  );
  await openTab(page, "ports");
  await expect(page.getByTestId("ports-description")).toHaveText(
    `The hosts with cfengine ${topVersion} are listening to these ports:`,
  );
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${topCount})`);
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await openTab(page, "hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText(
    `Hosts with cfengine version ${topVersion} installed:`,
  );
});

test("host pages show software versions as links", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await page.getByTestId("software-modal-open").click();
  const list = page.getByTestId("software-modal-list");
  const versionsOf = someHost["software-versions"] as unknown as Record<string, string>;
  for (const sw of someHost.software) {
    await expect(list.getByRole("link", { name: sw, exact: true })).toHaveAttribute(
      "href",
      `/entry/software/${encodeURIComponent(sw)}`,
    );
    const version = versionsOf[sw];
    if (!version) continue;
    const item = list.locator("li", { has: page.getByRole("link", { name: sw, exact: true }) });
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
  await page.goto("/entry/port/22?htab=list");
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
  await expect(seeAlsoLink("cfengine (software)")).toHaveAttribute(
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

test("port cards show a logo when the port has one", async ({ page }) => {
  // Port 3306 (mysql) has a logo; port 22 has none.
  const mysqlHost = hosts.find((h) => h["ports-listening"].includes(3306));
  test.skip(!mysqlHost, "no host listening on 3306 in the generated data");
  const anyPorts = [...new Set(hosts.flatMap((h) => h["ports-listening"]))].sort((a, b) => a - b);
  const mysqlPage = Math.floor(anyPorts.indexOf(3306) / PAGE_SIZE) + 1;
  await page.goto(`/entry/class/any?tab=ports${mysqlPage > 1 ? `&tpage=${mysqlPage}` : ""}`);
  const mysql = page
    .getByTestId("aggregated-port")
    .filter({ has: page.getByRole("link", { name: "3306", exact: true }) });
  await expect(mysql.getByTestId("port-logo")).toHaveAttribute(
    "src",
    /cdn\.simpleicons\.org\/mysql/,
  );
  await page.goto("/entry/class/any?tab=ports");
  const ssh = page
    .getByTestId("aggregated-port")
    .filter({ has: page.getByRole("link", { name: "22", exact: true }) });
  await expect(ssh.getByTestId("port-logo")).toHaveCount(0);
});

test("port page title includes the common name in parenthesis", async ({
  page,
}) => {
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("entry-name")).toHaveText("22 (ssh)");
  await page.goto("/entry/port/5308");
  await expect(page.getByTestId("entry-name")).toHaveText("5308 (cfengine)");
  // Ports without a known name show just the number.
  const unnamed = [...new Set(hosts.flatMap((h) => h["ports-listening"]))].find(
    (p) => !(info.ports as Record<string, unknown>)[String(p)],
  );
  if (unnamed) {
    await page.goto(`/entry/port/${unnamed}`);
    await expect(page.getByTestId("entry-name")).toHaveText(String(unnamed));
  }
});

test("hosts have a cloud provider, or none for their own data center", async ({
  page,
}) => {
  const providerOf = (h: Host) => (h as unknown as { "cloud-provider": string })["cloud-provider"];
  const withProvider = hosts.filter((h) => providerOf(h));
  const without = hosts.filter((h) => !providerOf(h));
  expect(withProvider.length).toBeGreaterThan(0);
  expect(without.length).toBeGreaterThan(0);
  const providers = new Set(withProvider.map(providerOf));
  expect(providers.has("AWS")).toBe(true);

  // A host on a provider links to it; a host without shows "None".
  const aws = withProvider.find((h) => providerOf(h) === "AWS")!;
  await page.goto(`/entry/host/${encodeURIComponent(aws.id)}`);
  await expect(page.getByTestId("host-cloud").getByRole("link", { name: "AWS" })).toHaveAttribute(
    "href",
    "/entry/cloud/AWS",
  );
  await expect(page.getByTestId("entry-summary")).toContainText("running in AWS.");
  await page.goto(`/entry/host/${encodeURIComponent(without[0].id)}`);
  await expect(page.getByTestId("host-cloud")).toHaveText("None");
  await expect(page.getByTestId("host-cloud").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("entry-summary")).toContainText(
    "running in your own data center.",
  );

  // The provider page: description, logo, summary and tabs with its hosts.
  const awsHosts = withProvider.filter((h) => providerOf(h) === "AWS");
  await page.goto("/entry/cloud/AWS");
  await expect(page.getByTestId("entry-description")).toHaveText(
    (info["cloud-providers"] as Record<string, { description: string }>)["AWS"].description,
  );
  await expect(page.getByTestId("entry-logo")).toHaveAttribute("src", /Amazon_Web_Services/);
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `${awsHosts.length} hosts in your infrastructure run in AWS, across ${pluralize(distinctOs(awsHosts), "operating system")}.`,
  );
  await openTab(page, "os");
  await expect(page.getByTestId("os-section")).toContainText(
    "The hosts in AWS run these operating systems:",
  );
  await openTab(page, "ports");
  await expect(page.getByTestId("ports-description")).toHaveText(
    "The hosts in AWS are listening to these ports:",
  );
  await openTab(page, "hosts");
  await expect(page.getByTestId("hosts-description")).toHaveText("Hosts running in AWS:");
  await expect(page.getByTestId("hosts-heading")).toHaveText(`Hosts (${awsHosts.length})`);

  // Cloud providers work as search filters.
  await page.goto(`/search?q=${encodeURIComponent("cloud:AWS port:22")}`);
  await expect(page.getByTestId("search-summary")).toContainText(
    `${awsHosts.length} hosts matching cloud AWS, port 22`,
  );
});

test("clouds tab shows a pie chart of cloud providers", async ({ page }) => {
  const providerOf = (h: Host) => (h as unknown as { "cloud-provider": string })["cloud-provider"];
  const counts = new Map<string, number>();
  for (const h of hosts) counts.set(providerOf(h), (counts.get(providerOf(h)) ?? 0) + 1);
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  expect(ranked.length).toBeGreaterThan(1);
  expect(counts.has("")).toBe(true);

  // Port 22 is on every host, so its clouds tab covers the whole fleet.
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("clouds-heading")).toHaveText(`Clouds (${ranked.length})`);
  await openTab(page, "clouds");
  await expect(page.getByTestId("cloud-section")).toContainText(
    "The hosts listening to this port run in these clouds:",
  );
  await expect(page.getByTestId("cloud-pie").locator("path")).toHaveCount(
    Math.min(ranked.length, 8),
  );
  const items = page.getByTestId("cloud-list").locator("li");
  await expect(items).toHaveCount(ranked.length);
  for (const [i, [cloud, n]] of ranked.entries()) {
    const item = items.nth(i);
    await expect(item).toContainText(`${n} ${n === 1 ? "host" : "hosts"}`);
    if (cloud) {
      await expect(item.getByRole("link", { name: cloud, exact: true })).toHaveAttribute(
        "href",
        `/entry/cloud/${encodeURIComponent(cloud)}`,
      );
    } else {
      // Hosts outside any cloud are a slice of their own, without a link.
      await expect(item).toContainText("None");
      await expect(item.getByRole("link")).toHaveCount(0);
    }
  }

  // Shown on group and OS pages (with several providers), hidden on cloud
  // pages and host pages.
  const winProviders = new Set(hostsInGroup("Windows").map(providerOf)).size;
  await page.goto(groupHref("Windows"));
  await expect(page.getByTestId("clouds-heading")).toHaveCount(winProviders > 1 ? 1 : 0);
  const osProviders = new Set(hosts.filter((h) => h.os === someHost.os).map(providerOf)).size;
  await page.goto(`/entry/os/${encodeURIComponent(someHost.os)}`);
  await expect(page.getByTestId("clouds-heading")).toHaveCount(osProviders > 1 ? 1 : 0);
  await page.goto("/entry/cloud/AWS");
  await expect(page.getByTestId("clouds-heading")).toHaveCount(0);
  await expect(page.getByTestId("os-heading")).toBeVisible();
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("clouds-heading")).toHaveCount(0);

  // A class whose hosts all share one provider (or none) gets one sentence.
  const byClass = new Map<string, Host[]>();
  for (const h of hosts) for (const c of h.classes) byClass.set(c, [...(byClass.get(c) ?? []), h]);
  const uniform = [...byClass.entries()].find(
    ([, hs]) => hs.length > 1 && new Set(hs.map(providerOf)).size === 1,
  );
  if (uniform) {
    const [cls] = uniform;
    await page.goto(`/entry/class/${encodeURIComponent(cls)}`);
    await expect(page.getByTestId("hosts-heading")).toBeVisible();
    await expect(page.getByTestId("section-clouds")).toHaveCount(0);
    await expect(page.getByTestId("clouds-heading")).toHaveCount(0);
  }
});

test("front page buttons list everything of a type", async ({ page }) => {
  await page.goto("/");
  const buttons = page.getByTestId("type-buttons").getByRole("link");
  await expect(buttons).toHaveCount(12);
  // Buttons come before the random list and sit side by side.
  await expect(page.getByTestId("entry-list")).toBeVisible();
  const buttonsBox = (await page.getByTestId("type-buttons").boundingBox())!;
  const listBox = (await page.getByTestId("entry-list").boundingBox())!;
  expect(buttonsBox.y).toBeLessThan(listBox.y);
  const first = (await buttons.nth(0).boundingBox())!;
  const second = (await buttons.nth(1).boundingBox())!;
  expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  expect(second.x).toBeGreaterThan(first.x);

  // Ports: all distinct ports, with count, ascending.
  const allPorts = [...new Set(hosts.flatMap((h) => h["ports-listening"]))].sort((a, b) => a - b);
  await expect(page.getByTestId("type-button-port")).toHaveText(`Ports (${allPorts.length})`);
  await page.getByTestId("type-button-port").click();
  await expect(page).toHaveURL("/search?type=port");
  await expect(page.getByTestId("search-summary")).toHaveText(
    `${allPorts.length} ports in your infrastructure.`,
  );
  const items = page.getByTestId("search-results").locator("li");
  await expect(items).toHaveCount(Math.min(PAGE_SIZE, allPorts.length));
  await expect(items.first().getByRole("link")).toHaveText(String(allPorts[0]));
  await expect(items.first().locator(".type-badge")).toHaveText("port");
  await expect(page.getByTestId("pagination")).toHaveCount(allPorts.length > PAGE_SIZE ? 1 : 0);

  // Hosts: paginated a page at a time, sorted by hostname.
  await page.goto("/");
  await expect(page.getByTestId("type-button-host")).toHaveText(`Hosts (${hosts.length})`);
  await page.getByTestId("type-button-host").click();
  await expect(page).toHaveURL("/search?type=host");
  await expect(page.getByTestId("host-item")).toHaveCount(Math.min(PAGE_SIZE, hosts.length));
  const byName = [...hosts].sort((a, b) => a.hostname.localeCompare(b.hostname));
  await expect(
    page.getByTestId("host-item").first().getByRole("link", { name: byName[0].hostname }),
  ).toBeVisible();
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing 1–${PAGE_SIZE} of ${hosts.length} hosts`,
  );
  await page.getByTestId("pagination").getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL("/search?type=host&page=2");
  await expect(page.getByTestId("host-item")).toHaveCount(
    Math.min(PAGE_SIZE, hosts.length - PAGE_SIZE),
  );

  // Unknown types fall back to the plain search page.
  await page.goto("/search?type=banana");
  await expect(page.getByTestId("search-hint")).toBeVisible();
});

test("a version on a single operating system has no operating systems section", async ({
  page,
}) => {
  const byVersion = new Map<string, Host[]>();
  for (const h of hosts) {
    const versions = h["software-versions"] as unknown as Record<string, string>;
    for (const [sw, v] of Object.entries(versions)) {
      const key = `${sw} ${v}`;
      byVersion.set(key, [...(byVersion.get(key) ?? []), h]);
    }
  }
  const single = [...byVersion.entries()].find(
    ([, hs]) => hs.length > 1 && new Set(hs.map((h) => h.os)).size === 1,
  );
  test.skip(!single, "every multi-host software version spans several operating systems");
  const [name] = single!;
  await page.goto(`/entry/version/${encodeURIComponent(name)}`);
  await expect(page.getByTestId("hosts-heading")).toBeVisible();
  await expect(page.getByTestId("section-os")).toHaveCount(0);
  await expect(page.getByTestId("os-pie")).toHaveCount(0);
});

test("similar tab lists same-type entries sharing a name prefix", async ({
  page,
}) => {
  const prefixLen = (a: string, b: string) => {
    const x = a.toLowerCase(), y = b.toLowerCase();
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return i;
  };
  const allClasses = [...new Set(hosts.flatMap((h) => h.classes))];
  const me = "ubuntu_22";
  test.skip(!allClasses.includes(me), "no ubuntu_22 class in the generated data");
  const expected = allClasses
    .filter((c) => c !== me && prefixLen(c, me) >= 3)
    .map((c) => ({ name: c, common: prefixLen(c, me) }))
    .sort((a, b) => b.common - a.common || a.name.localeCompare(b.name));
  expect(expected.length).toBeGreaterThan(1);

  await page.goto(`/entry/class/${me}`);
  const tab = page.getByTestId("similar-heading");
  await expect(tab).toHaveText(`Similar (${expected.length})`);
  await openTab(page, "similar");
  await expect(page.getByTestId("similar-description")).toContainText(
    "Other classes with similar names:",
  );
  const items = page.getByTestId("similar-item");
  await expect(items).toHaveCount(expected.length);
  await expect(items.getByRole("link")).toHaveText(expected.map((e) => e.name));
  await expect(items.first().locator(".type-badge")).toHaveText("class");
  await expect(items.first().getByRole("link")).toHaveAttribute(
    "href",
    `/entry/class/${encodeURIComponent(expected[0].name)}`,
  );

  // Software: apt and apt-get are similar; so are postfix and postgresql.
  await page.goto("/entry/software/apt?tab=similar");
  await expect(page.getByTestId("similar-description")).toHaveText(
    "Other software with similar names:",
  );
  await expect(page.getByTestId("similar-item").getByRole("link")).toContainText(["apt-get"]);
  await page.goto("/entry/software/postfix?tab=similar");
  await expect(
    page.getByTestId("similar-item").getByRole("link", { name: "postgresql", exact: true }),
  ).toBeVisible();
});

test("similar sentence keeps IP and MAC capitalised", async ({ page }) => {
  // MAC addresses share vendor prefixes, so there is always something similar.
  const mac = someHost.macs[0];
  const macSimilar = hosts.flatMap((h) => h.macs).filter((m) => m !== mac && m.slice(0, 3) === mac.slice(0, 3));
  if (macSimilar.length > 0) {
    await page.goto(`/entry/mac/${encodeURIComponent(mac)}?tab=similar`);
    await expect(page.getByTestId("similar-description")).toHaveText("Other similar MAC addresses:");
  }
  const ip = hosts.flatMap((h) => h.ips).find((a) => a.startsWith("10."));
  if (ip) {
    await page.goto(`/entry/ip/${encodeURIComponent(ip)}?tab=similar`);
    await expect(page.getByTestId("similar-description")).toHaveText("Other similar IP addresses:");
  }
});

test("similar tab is disabled when nothing is similar", async ({ page }) => {
  // No other port starts with "22".
  const ports = [...new Set(hosts.flatMap((h) => h["ports-listening"]))].map(String);
  expect(ports.filter((p) => p !== "22" && p.startsWith("22")).length).toBe(0);
  await page.goto("/entry/port/22");
  const tab = page.getByTestId("similar-heading");
  await expect(tab).toHaveText("Similar (0)");
  await expect(tab).toHaveAttribute("aria-disabled", "true");
  await expect(tab).toHaveClass(/tab-disabled/);
  expect(await tab.evaluate((el) => el.tagName)).toBe("SPAN");
  await expect(tab.getByRole("link")).toHaveCount(0);
  // Asking for the disabled tab falls back to the first tab.
  await page.goto("/entry/port/22?tab=similar");
  await expect(page.getByTestId("tab-charts")).toBeVisible();
  await expect(page.getByTestId("similar")).toHaveCount(0);
});

test("host page has two columns with software and classes below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const left = page.getByTestId("host-details-left");
  const right = page.getByTestId("host-details-right");
  const wide = page.getByTestId("host-details-wide");
  await expect(left.locator("dt")).toHaveText([
    "Hostname",
    "Operating system",
    "Cloud provider",
    "Local users",
    "Groups",
  ]);
  await expect(right.locator("dt")).toHaveText([
    "IP addresses",
    "MAC addresses",
    "Listening ports",
  ]);
  await expect(wide.locator("dt")).toHaveText(["Software", "Classes"]);

  const l = (await left.boundingBox())!;
  const r = (await right.boundingBox())!;
  const w = (await wide.boundingBox())!;
  // Side by side at the same height; the wide section below both.
  expect(r.x).toBeGreaterThan(l.x + l.width - 1);
  expect(Math.abs(r.y - l.y)).toBeLessThan(2);
  expect(w.y).toBeGreaterThanOrEqual(Math.max(l.y + l.height, r.y + r.height) - 1);
  expect(w.width).toBeGreaterThan(l.width * 1.5);
});

test("software and classes open in a filterable modal", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  // A single button carrying the count instead of inline lists.
  await expect(page.getByTestId("software-modal-open")).toHaveText(
    `${someHost.software.length} installed`,
  );
  await expect(page.getByTestId("host-software").getByRole("button")).toHaveCount(1);
  await expect(page.getByTestId("host-software").getByRole("link")).toHaveCount(0);
  const dialog = page.getByTestId("classes-modal-dialog");
  await expect(dialog).toBeHidden();

  await page.getByTestId("classes-modal-open").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(`Classes of ${someHost.hostname}`);
  const items = page.getByTestId("classes-modal-list").locator("li:visible");
  await expect(items).toHaveCount(someHost.classes.length);
  // Items are stacked vertically.
  const first = (await items.nth(0).boundingBox())!;
  const second = (await items.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThan(first.y + first.height - 1);

  // Filtering as you type. The dialog keeps its top edge; only its height
  // changes, so it does not jump around.
  const before = (await dialog.boundingBox())!;
  const filter = page.getByTestId("classes-modal-filter");
  await expect(filter).toBeFocused();
  await filter.fill("cfengine");
  await expect(items).toHaveCount(someHost.classes.filter((c) => c.includes("cfengine")).length);
  const after = (await dialog.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(after.height).toBeLessThan(before.height);
  const matching = someHost.classes.filter((c) => c.includes("cfengine"));
  await expect(items).toHaveCount(matching.length);
  await expect(items.getByRole("link")).toHaveText(matching);
  await expect(page.getByTestId("classes-modal-shown")).toHaveText(
    `${matching.length} of ${someHost.classes.length} classes match`,
  );
  await filter.fill("zzzz-nothing");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveText("Nothing matches.");
  await filter.fill("");
  await expect(items).toHaveCount(someHost.classes.length);

  // Escape closes it; reopening starts unfiltered.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByTestId("classes-modal-open").click();
  await expect(items).toHaveCount(someHost.classes.length);
});

const fullTime = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(iso))} UTC`;
type Seen = { "first-seen": string; "last-seen": string };
const seenOf = (h: Host) => h as unknown as Seen;

test("hosts show first and last seen as relative times with full tooltips", async ({
  page,
}) => {
  const { "first-seen": first, "last-seen": last } = seenOf(someHost);
  expect(first < last).toBe(true);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const firstSeen = page.getByTestId("host-first-seen");
  const lastSeen = page.getByTestId("host-last-seen");
  await expect(firstSeen).toHaveAttribute("datetime", first);
  await expect(firstSeen).toHaveAttribute("title", fullTime(first));
  await expect(firstSeen).toHaveText(/^(\d+ (year|month|week|day|hour|minute)s? ago|just now|less than a minute ago)$/);
  await expect(lastSeen).toHaveAttribute("datetime", last);
  await expect(lastSeen).toHaveAttribute("title", fullTime(last));
  await expect(lastSeen).toHaveText(/ago$|just now/);
  // Top right: level with the type badge, above the title, italic and faded.
  const seenLine = page.getByTestId("host-seen");
  await expect(seenLine).toHaveText(/^First seen .*, last seen .*\.$/);
  await expect(seenLine).toHaveCSS("font-style", "italic");
  await expect(seenLine).toHaveClass(/muted/);
  const badge = (await page.locator(".type-badge").first().boundingBox())!;
  const seenBox = (await seenLine.boundingBox())!;
  const title = (await page.getByTestId("entry-name").boundingBox())!;
  const main = (await page.locator("main").boundingBox())!;
  expect(Math.abs(seenBox.y + seenBox.height / 2 - (badge.y + badge.height / 2))).toBeLessThan(3);
  expect(seenBox.y + seenBox.height).toBeLessThanOrEqual(title.y + 1);
  expect(seenBox.x).toBeGreaterThan(badge.x + badge.width);
  expect(main.x + main.width - (seenBox.x + seenBox.width)).toBeLessThan(40);

  // Online hosts were seen after offline ones in the generated data.
  const online = hosts.filter((h) => h.online).map((h) => seenOf(h)["last-seen"]);
  const offline = hosts.filter((h) => !h.online).map((h) => seenOf(h)["last-seen"]);
  expect(Math.min(...online.map(Date.parse))).toBeGreaterThan(Math.max(...offline.map(Date.parse)));

  // Host cards in lists show the last seen time too.
  await page.goto("/entry/port/22?htab=list");
  const firstCard = page.getByTestId("host-item").first();
  await expect(firstCard).toContainText("Last seen:");
  await expect(firstCard.locator("time")).toHaveAttribute("title", /UTC$/);
});

test("other entries derive first and last seen from their hosts", async ({
  page,
}) => {
  // Port 22 is on every host.
  const firsts = hosts.map((h) => seenOf(h)["first-seen"]).sort();
  const lasts = hosts.map((h) => seenOf(h)["last-seen"]).sort();
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("entry-seen")).toHaveText(/^First seen .*, last seen .*\.$/);
  // Top right, level with the type badge and above the title.
  const badge = (await page.locator(".type-badge").first().boundingBox())!;
  const seenBox = (await page.getByTestId("entry-seen").boundingBox())!;
  const title = (await page.getByTestId("entry-name").boundingBox())!;
  expect(Math.abs(seenBox.y + seenBox.height / 2 - (badge.y + badge.height / 2))).toBeLessThan(3);
  expect(seenBox.y + seenBox.height).toBeLessThanOrEqual(title.y + 1);
  expect(seenBox.x).toBeGreaterThan(badge.x + badge.width);
  // In the two-column layout it lines up with the right edge of the left column.
  const pane = (await page.getByTestId("entry-pane").boundingBox())!;
  expect(Math.abs(seenBox.x + seenBox.width - (pane.x + pane.width))).toBeLessThan(4);
  await expect(page.getByTestId("entry-first-seen")).toHaveAttribute("datetime", firsts[0]);
  await expect(page.getByTestId("entry-last-seen")).toHaveAttribute(
    "datetime",
    lasts[lasts.length - 1],
  );
  await expect(page.getByTestId("entry-last-seen")).toHaveAttribute(
    "title",
    fullTime(lasts[lasts.length - 1]),
  );

  // A group derives from just its hosts.
  const windows = hostsInGroup("Windows");
  const wLast = windows.map((h) => seenOf(h)["last-seen"]).sort();
  await page.goto(groupHref("Windows"));
  await expect(page.getByTestId("entry-last-seen")).toHaveAttribute(
    "datetime",
    wLast[wLast.length - 1],
  );
});

test("right side has Charts and List tabs, Charts by default", async ({ page }) => {
  await page.goto("/entry/port/22");
  const charts = page.getByTestId("charts-tab");
  const list = page.getByTestId("list-tab");
  await expect(charts).toHaveAttribute("aria-selected", "true");
  await expect(list).toHaveText(`List (${hosts.length})`);
  await expect(page.getByTestId("tab-charts")).toBeVisible();
  await expect(page.getByTestId("section-os")).toBeVisible();
  await expect(page.getByTestId("section-list")).toHaveCount(0);
  // Both tabs sit under the Hosts heading, left of each other.
  const c = (await charts.boundingBox())!;
  const l = (await list.boundingBox())!;
  const h = (await page.getByTestId("hosts-heading").boundingBox())!;
  expect(c.x).toBeLessThan(l.x);
  expect(c.y).toBeGreaterThan(h.y);

  await list.click();
  await expect(page).toHaveURL("/entry/port/22?htab=list");
  await expect(list).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("section-list")).toBeVisible();
  await expect(page.getByTestId("section-os")).toHaveCount(0);
  await expect(page.getByTestId("linked-hosts").locator("li")).toHaveCount(PAGE_SIZE);

  // With nothing to chart, Charts is disabled and List is shown.
  const providerOf = (h: Host) => (h as unknown as { "cloud-provider": string })["cloud-provider"];
  const byClass = new Map<string, Host[]>();
  for (const h of hosts) for (const c of h.classes) byClass.set(c, [...(byClass.get(c) ?? []), h]);
  const plain = [...byClass.entries()].find(
    ([, hs]) =>
      hs.length > 1 && new Set(hs.map((h) => h.os)).size === 1 && new Set(hs.map(providerOf)).size === 1,
  );
  if (plain) {
    await page.goto(`/entry/class/${encodeURIComponent(plain[0])}`);
    await expect(page.getByTestId("charts-tab")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("charts-tab")).toHaveText("Charts (0)");
    await expect(page.getByTestId("section-list")).toBeVisible();
  }
});

test("switching a tab on one side keeps the other side's tab", async ({ page }) => {
  // dpkg is on every Debian-like host: several pages of hosts, and it has
  // Ports and Resources tabs on the left.
  const dpkgHosts = hosts.filter((h) => h.software.includes("dpkg")).length;
  test.skip(dpkgHosts <= PAGE_SIZE, "not enough dpkg hosts to paginate");
  await page.goto("/entry/software/dpkg?tab=resources");
  await expect(page.getByTestId("resources-heading")).toHaveAttribute("aria-selected", "true");

  // Switch the right side; the left must stay on Resources.
  await page.getByTestId("list-tab").click();
  await expect(page).toHaveURL(/tab=resources/);
  await expect(page).toHaveURL(/htab=list/);
  await expect(page.getByTestId("resources-heading")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("section-list")).toBeVisible();
  // Paging the host list keeps the left tab too.
  await page.getByTestId("pagination").getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/tab=resources/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId("resources-heading")).toHaveAttribute("aria-selected", "true");

  // And switching the left side keeps the right side's tab and page.
  await page.getByTestId("ports-heading").click();
  await expect(page).toHaveURL(/htab=list/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId("ports-heading")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("list-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("hosts-sections").getByTestId("pagination-summary")).toContainText(
    `Showing ${PAGE_SIZE + 1}–`,
  );
  await page.getByTestId("charts-tab").click();
  await expect(page.getByTestId("ports-heading")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tab-charts")).toBeVisible();
});

test("the Charts/List choice follows the user between entries", async ({
  page,
}) => {
  // Choose List on one entry...
  await page.goto("/entry/port/22");
  await expect(page.getByTestId("charts-tab")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("list-tab").click();
  await expect(page.getByTestId("section-list")).toBeVisible();

  // ...and it is the default on the next entries, even without the parameter.
  await page.goto("/entry/class/any");
  await expect(page).toHaveURL("/entry/class/any");
  await expect(page.getByTestId("list-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("section-list")).toBeVisible();
  await page.getByTestId("section-list").getByRole("link", { name: "127.0.0.1" }).first().click();
  await expect(page).toHaveURL("/entry/ip/127.0.0.1");
  await expect(page.getByTestId("list-tab")).toHaveAttribute("aria-selected", "true");

  // The URL still wins over the remembered choice.
  await page.goto("/entry/port/22?htab=charts");
  await expect(page.getByTestId("charts-tab")).toHaveAttribute("aria-selected", "true");

  // Choosing Charts again is remembered too.
  await page.goto("/entry/port/22");
  await page.getByTestId("charts-tab").click();
  await page.goto("/entry/class/any");
  await expect(page.getByTestId("charts-tab")).toHaveAttribute("aria-selected", "true");
});

test("tab lists are paginated like host lists", async ({ page }) => {
  // MAC addresses share vendor prefixes, so a MAC has many similar ones.
  const mac = someHost.macs[0];
  const similar = hosts
    .flatMap((h) => h.macs)
    .filter((m) => m !== mac && m.toLowerCase().slice(0, 3) === mac.toLowerCase().slice(0, 3));
  test.skip(similar.length <= PAGE_SIZE, "not enough similar MAC addresses to paginate");
  await page.goto(`/entry/mac/${encodeURIComponent(mac)}?tab=similar`);
  await expect(page.getByTestId("similar-item")).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId("pagination-summary")).toHaveText(
    `Showing 1–${PAGE_SIZE} of ${similar.length} mac addresses`,
  );
  await page.getByTestId("pagination").getByRole("link", { name: "Next →" }).click();
  // Similar is the only left tab on a single-host MAC page, so no tab= in the URL.
  await expect(page).toHaveURL(`/entry/mac/${encodeURIComponent(mac)}?tpage=2`);
  await expect(page.getByTestId("similar-item")).toHaveCount(
    Math.min(PAGE_SIZE, similar.length - PAGE_SIZE),
  );

  // Ports on a big entry paginate too, independently of the host list page.
  await page.goto("/entry/class/any?tab=ports&tpage=2&htab=list&page=3");
  await expect(page.getByTestId("aggregated-port").first()).toBeVisible();
  const left = page.getByTestId("entry-tabs").getByTestId("pagination-summary");
  await expect(left).toContainText(`Showing ${PAGE_SIZE + 1}–`);
  const right = page.getByTestId("hosts-sections").getByTestId("pagination-summary");
  await expect(right).toContainText(`Showing ${2 * PAGE_SIZE + 1}–`);
});

import commentsJson from "../data/comments.json";
const exampleComments = commentsJson as unknown as Record<
  string,
  { author: string; time: string; text: string }[] | string
>;

test("entries have a Comments tab with example comments", async ({ page }) => {
  const examples = exampleComments["port:22"] as { author: string; time: string; text: string }[];
  await page.goto("/entry/port/22");
  const tab = page.getByTestId("comments-heading");
  await expect(tab).toHaveText(`Comments (${examples.length})`);
  // Last tab, after Similar and Resources.
  const tabs = page.getByTestId("entry-tabs").getByRole("tab");
  await expect(tabs.last()).toContainText("Comments");
  await openTab(page, "comments");
  const cards = page.getByTestId("comment-card");
  await expect(cards).toHaveCount(examples.length);
  for (const [i, c] of examples.entries()) {
    await expect(cards.nth(i).getByTestId("comment-card-author")).toHaveText(c.author);
    await expect(cards.nth(i).getByTestId("comment-card-text")).toHaveText(c.text);
    await expect(cards.nth(i).locator("time")).toHaveAttribute("datetime", c.time);
    await expect(cards.nth(i).locator("time")).toHaveText(/ago$|just now/);
  }
  // Author and time sit above the text, not beside it.
  const meta = (await cards.first().locator(".comment-meta").boundingBox())!;
  const body = (await cards.first().getByTestId("comment-card-text").boundingBox())!;
  expect(body.y).toBeGreaterThanOrEqual(meta.y + meta.height - 1);
  // Entries without examples still have the tab, saying so.
  await page.goto("/entry/port/5308?tab=comments");
  await expect(page.getByTestId("comments-heading")).toHaveText("Comments (0)");
  await expect(page.getByTestId("comment-card")).toHaveCount(0);
  await expect(page.getByTestId("comments-list").locator(".comments-empty")).toBeVisible();
  await expect(page.getByTestId("comments-list")).toContainText("No comments yet.");
});

test("posting a comment stores it in the browser only", async ({ page }) => {
  await page.goto("/entry/port/5308?tab=comments");
  await page.getByTestId("comment-author").fill("Tester");
  await page.getByTestId("comment-text").fill("Should this really be open on Windows hosts?");
  await page.getByTestId("comment-submit").click();
  // Still on the same page (no navigation), the comment appears at once.
  await expect(page).toHaveURL(/\/entry\/port\/5308/);
  const card = page.getByTestId("comment-card").last();
  await expect(card.getByTestId("comment-card-author")).toHaveText("Tester");
  await expect(card.getByTestId("comment-card-text")).toHaveText(
    "Should this really be open on Windows hosts?",
  );
  await expect(card.locator("time")).toHaveText("just now");
  await expect(page.getByTestId("comments-heading")).toHaveText("Comments (1)");
  await expect(page.getByTestId("comment-text")).toHaveValue("");
  await expect(page.getByTestId("comments-list").locator(".comments-empty")).toBeHidden();

  // It survives a reload (local storage), alongside the examples elsewhere.
  await page.reload();
  await expect(page.getByTestId("comment-card").last().getByTestId("comment-card-text")).toHaveText(
    "Should this really be open on Windows hosts?",
  );
  await expect(page.getByTestId("comment-author")).toHaveValue("Tester");
  await page.goto("/entry/port/22?tab=comments");
  await expect(page.getByTestId("comment-card")).toHaveCount(
    (exampleComments["port:22"] as unknown[]).length,
  );
  // And it is only in this browser.
  const stored = await page.evaluate(() => localStorage.getItem("knowdb-comments:port:5308"));
  expect(JSON.parse(stored!)).toHaveLength(1);
});

test("host pages have a comments section, host previews do not", async ({ page }) => {
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  const section = page.getByTestId("comments");
  await expect(section.getByTestId("comments-heading")).toContainText("Comments");
  const details = (await page.getByTestId("host-details").boundingBox())!;
  const box = (await section.boundingBox())!;
  expect(box.y).toBeGreaterThan(details.y + details.height - 1);
  const examples = exampleComments[`host:${someHost.id}`];
  if (Array.isArray(examples)) {
    await expect(page.getByTestId("comment-card")).toHaveCount(examples.length);
  }
  await expect(page.getByTestId("comment-form")).toBeVisible();
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

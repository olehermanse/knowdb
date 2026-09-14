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

test("front page shows 10 random entries", async ({ page }) => {
  await page.goto("/");
  const items = page.getByTestId("entry-list").locator("li");
  await expect(items).toHaveCount(10);
  await expect(items.locator("a.entry-link")).toHaveCount(10);
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
  ];
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

  // The operating systems section comes before the ports section.
  const osBox = await page.getByTestId("os-heading").boundingBox();
  const portsBox = await page.getByTestId("ports-heading").boundingBox();
  expect(osBox!.y).toBeLessThan(portsBox!.y);
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
  const name = groupWithOsCount((n) => n === 1);
  const expected = osCounts(hostsInGroup(name));
  await page.goto(groupHref(name));
  await expect(page.getByTestId("os-pie")).toHaveCount(0);
  await expect(page.getByTestId("os-list")).toHaveCount(0);
  await expect(page.getByTestId("os-summary")).toHaveText(
    `This group has only 1 operating system: ${expected[0][0]} (${hostsLabel(expected[0][1])}).`,
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

test("operating systems section is absent where it makes no sense", async ({
  page,
}) => {
  await page.goto(`/entry/os/${encodeURIComponent(someHost.os)}`);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("os-heading")).toHaveCount(0);
  await page.goto(`/entry/ip/${encodeURIComponent(someHost.ips[0])}`);
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

  await page.goto(groupHref(group.name));
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
  await page.goto("/entry/port/22");
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
    const label = link.source ? `"${link.title}" on ${link.source}` : link.title;
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

test("entries without links show no links section", async ({ page }) => {
  // Hosts and IP addresses have no hard coded information at all.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("external-links")).toHaveCount(0);
  await page.goto(`/entry/ip/${encodeURIComponent(someHost.ips[0])}`);
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
  await page.goto("/entry/software/cron");
  await expect(page.getByTestId("entry-summary")).toHaveText(
    `cron is installed on ${pluralize(cronHosts.length, "host")} in your infrastructure, across ${pluralize(distinctOs(cronHosts), "operating system")}.`,
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

  // Hosts get a summary of their own details.
  await page.goto(`/entry/host/${encodeURIComponent(someHost.id)}`);
  await expect(page.getByTestId("entry-summary")).toContainText(
    `listens on ${pluralize(someHost["ports-listening"].length, "port")}`,
  );
  await expect(page.getByTestId("entry-summary")).toContainText(
    pluralize(someHost.ips.length, "IP address", "IP addresses"),
  );
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

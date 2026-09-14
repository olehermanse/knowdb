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

// Every generated host listens on ports 22 and 5308, so these entries are
// guaranteed to exist and be linked to all hosts.
const someHost = hosts[0];

test("front page shows 10 random entries", async ({ page }) => {
  await page.goto("/");
  const items = page.getByTestId("entry-list").locator("li");
  await expect(items).toHaveCount(10);
  await expect(items.locator("a.entry-link")).toHaveCount(10);
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

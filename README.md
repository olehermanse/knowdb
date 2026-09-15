# KnowDB

A prototype for exploring your infrastructure in a Wikipedia-like manner,
based on the data reported from your hosts.
Click on a host to see information about it, see that port 22 is open,
read what port 22 is for, see other hosts with port 22 open, and so on.

A host page shows its software and classes as counts with a "Show all"
button that opens a scrollable list which filters live as you type. The
popup uses the native HTML popover attribute and a few lines of plain
JavaScript, so it needs no framework code in the browser.

Every host has a GitHub-style pixel avatar derived from its host key, so
it stays the same everywhere the host appears. The avatar's colour comes
from the host's operating system (the `color` field of the OS entry in
`data/info.json`, falling back to a colour derived from the OS name). A
green or gray dot in the avatar's bottom right corner shows whether the
host is online.

Every entry page except a host's has its title across the top and is
split in two below it. The left side holds the entry's own information and
its Ports, Similar, Resources and (for software) Versions tabs. The right side is
about the entry's hosts: when exactly one host matches it shows that host
exactly as on the host page, and when several match it shows a "Hosts"
heading with two tabs: Charts (the default) with the Operating systems and
Clouds pie charts, each skipped when there is only one option, and List
with the paginated hosts. The chosen tab is remembered (in a cookie) while
moving between entries. In detail: the operating systems they run (a pie chart and ranked list), the
cloud providers they run on (likewise, with hosts outside any cloud as
their own slice), the ports they listen on, and the host list itself.
Software pages have a Versions tab as well, and every page has a Similar
tab listing entries of the same type whose names start with the same three
or more characters, longest match first; it is shown grayed out with (0)
when there are none. The operating systems tab is
hidden on OS pages, the clouds tab on cloud pages and the ports tab on
port pages. An IP address, MAC address or hostname belonging to a single
host shows only the Hosts and Similar tabs.

Lists show at most 10 items at a time, with pagination links below the
list: hosts, but also the ports, versions and similar entries in the tabs.

## Comments

Every entry has a Comments tab (the last tab on the left), and a host page
has a Comments section at the bottom; the host preview on the right of
other entries has none. Each comment is a small card with the author, the
time and the text. Example comments live in `data/comments.json`, keyed by
`<type>:<name>`. The form at the bottom lets you post a comment, but this
is demo only: there is no backend or login, comments are posted as Alice or
Bob at random, and they are kept in your browser's local storage and shown
together with the examples.

## Front page

The front page has a button for each entry type (hosts, ports, software,
...) with its count. A button leads to the search page listing everything
of that type, 10 at a time. Below the buttons is a random sample of
entries with at least one of every type.

## Searching

The search bar at the top of every page searches "anything": hostnames,
host keys, port numbers and names, software, users, operating systems,
groups, IP and MAC addresses, words from descriptions, and the titles and
addresses of external resources (so "cloud.google.com" finds GCP). Results show
the type of each entry, its name and description, and hosts are shown
with their OS and IP addresses.

The search page also lists everything of one type with `/search?type=port`
(this is what the front page buttons link to).

A query can also contain filters like `port:22 group:Windows` or
`os:"Ubuntu 24"` (quote values with spaces), and conditions on free disk or
memory like `disk<20%` or `memory>=50%`. Then only hosts matching all of
them are listed. The "N hosts" links next to aggregated ports on group,
software and OS pages use this to show exactly those hosts.

## Running the frontend

The frontend is a Next.js app living at the top level of this repository,
so all `npm` and `docker` commands are run from the repository root.

### With the npm dev server

```bash
npm install && npm run dev
```

Then open http://localhost:3000.

### With Docker

```bash
docker build -t knowdb . && docker run --rm -p 3000:3000 knowdb
```

Then open http://localhost:3000.

### Running the tests

The frontend has Playwright tests in `tests/` (the test runner starts the
dev server for you):

```bash
npm install && npx playwright install chromium && npm test
```

## Generating host data

`scripts/generate_hosts.py` generates 100 random hosts and writes them to
`tmp/hosts.json`. The frontend reads a committed copy of this data from
`data/hosts.json`:

```bash
python3 scripts/generate_hosts.py && cp tmp/hosts.json data/hosts.json
```

## Descriptions of ports and software

`data/info.json` is a hand-written file with descriptions of well-known
ports, software, local user accounts, operating systems and special IP
addresses. IP addresses are described either exactly (`127.0.0.1`) or by
CIDR range (`10.0.0.0/8` for private networks); the first matching range
wins. Each port has
a short common name (like `ssh` for port 22) and a description; software,
users and operating systems have a description. Entry pages show the
description when one exists, and otherwise a sentence like "No information
available about this user". Any entry can also have a `links` list of
external sources, each with the `title` of the page, the `source` site it
is on, and the `url`, shown in the Resources tab of the entry page. Wikipedia
links read like `"Secure Shell" on Wikipedia`; other links show their
address, like `openssh.com` or `github.com/openssh/openssh-portable`. Links point to Wikipedia, official project
websites, source code repositories and specifications; any source works.
Software entries can list the `ports` they typically listen on, such as
`[5432]` for postgresql; software and port pages then show a "See also"
line linking to each other. "See also" also links entries of different
types with matching names, ignoring case and punctuation: the group
`Linux` and the class `linux`, the class `ubuntu_24` and the OS
`Ubuntu 24`, the class `cfengine` and the software `cfengine`.
Well-known software, operating systems and ports can also have a `logo`,
the path of an SVG in `public/logos/` (like `/logos/nginx.svg`) shown
next to the entry's title. Logos are committed to the repository, never
linked from third party websites; most come from Simple Icons,
https://simpleicons.org/, a few (Windows, AWS, Azure) from Wikimedia
Commons, and CFEngine's is the official logo.
Keep the list short: most entries need none or one link, and more than a
handful is too many. Edit this file to improve or extend the descriptions;
the frontend reads it at build time.

## Groups of hosts

`data/groups.json` defines groups of hosts, such as `Linux`,
`Windows`, `webservers` and `production`. Groups show up as their own entry
type in the UI: a host page lists the groups it belongs to, and a group page
lists the hosts in it along with the rules that put them there, a pie chart
and ranked list of the operating systems in the group, and the ports the
hosts are listening on. The operating systems section is also shown on
software, port and local user pages.

For now a group is defined by case-insensitive substring matching on the
host's OS and hostname. A host is in the group if, for every field listed
under `match`, at least one of the substrings matches:

```json
{
  "name": "production Linux",
  "description": "Production hosts running Linux.",
  "match": {
    "os": ["Ubuntu", "Debian", "RHEL", "CentOS", "Fedora", "SUSE"],
    "hostname": ["production"]
  }
}
```

Edit the file to add or change groups; the frontend reads it at build time.

## Classes

Hosts report CFEngine classes: strings like `linux`, `ubuntu_22` or
`policy_server` describing something true about the host. Classes work
like groups in the UI (a class page lists its hosts, operating systems and
ports, and a host page lists its classes), but they come from the hosts
themselves rather than from `groups.json`. The generator reads the classes
for each operating system from `data/classes.json` and adds
`policy_server` and `am_policy_hub` on hubs. Common classes are described
in `data/info.json` under `classes`.

## Services

Linux hosts report their running systemd services in `services` (unit
names such as `sshd`, `cron`, `nginx`); Windows hosts have none. Services
are their own entry type, much like software: a service page lists the
hosts running it with their operating systems, clouds and ports, and a host
page shows its running services. Common services are described in
`data/info.json` under `services`, where a service can name the software it
belongs to (`sshd` belongs to `openssh`), which links the two in "See also".

## Software versions

Each host reports the version of every installed piece of software in
`software-versions`. Versions are their own entry type, named like
`apache 2.4.62`: a software page has a Versions tab listing its versions
with host counts, and a version page links back to the software and lists
the hosts on it.
`cfengine` is installed on every host.

## Disk space and memory

Each host reports its disk (`disk`: total and free GB) and memory
(`memory`: total and free MB). The host page shows them as "42 GB free of
100 GB (42%)". Clicking one opens a search for hosts with a smaller share
free than this host, using a condition such as `disk<42%` or
`memory<38%` in the search box, where the percentage (or the operator:
`<`, `<=`, `>`, `>=`) can be edited.

## Local users

Besides the list of local user names, each host reports details of each
user in `user-details`: home directory, shell, groups, and the last
successful and last failed login (or null for never). A user page shows
these across the hosts that have the user, in two columns like a host's
details: the distinct homes, shells and groups, and the most recent login
and failed login with the host they happened on.

## First and last seen

Every host records when it first and most recently reported in. Other
entries derive their timestamps from their hosts: first seen is the
earliest of the hosts' first-seen times and last seen the latest last-seen.
Pages show them at the top right, level with the type badge, as a faded
italic sentence in relative times ("First seen 3 years ago, last seen 34
minutes ago."), with the full date and time in UTC as a tooltip.

## Cloud providers

Each host reports the cloud provider it runs on in `cloud-provider`, or an
empty string for hosts in your own data center or similar. Cloud providers
are their own entry type: a provider page lists the hosts on it with their
operating systems and ports, and a host page links to its provider. Common
providers are described in `data/info.json` under `cloud-providers`.

## CFEngine roles and hubs

Every host has a CFEngine `role`, either `Hub` or `Client`, and a `hub`
field with the IP address of the hub it reports to. A hub is its own hub,
so its `hub` field is one of its own public IP addresses, never the
loopback address. Of the 100 generated hosts, 5 are hubs. Roles are their
own entry type: the Hub and Client pages describe what the role means
(from `data/info.json` under `roles`) and list the hosts with it. A host
page shows its Role (linking to the role page) and its Hub (the IP address,
linking to that address, with the hub's hostname linking to the hub); a hub
also shows "Clients: N hosts", linking to a search for the clients
reporting to it. In search, `hub:<ip>` filters hosts by the hub they
report to, so `role:Client hub:18.130.49.157` lists that hub's clients.

## Host data format

The relevant information from a host looks like this:

```json
{
  "os": "Ubuntu 24",
  "id": "SHA=31bcb32950d8b91ffdfca85bca71364ec8f67c93246e3617c3a49af58363c4a1",
  "hostname": "production-hub",
  "ips": ["124.56.78.77", "127.0.0.1"],
  "macs": ["00:50:56:a1:b2:c3"],
  "ports-listening": [22, 80, 443, 5308],
  "software": ["apache", "cfengine", "dpkg", "apt", "apt-get", "brew", "curl", "wget"],
  "software-versions": {"apache": "2.4.62", "cfengine": "3.27.0", "dpkg": "1.22.6"},
  "services": ["apache2", "cf-execd", "cf-serverd", "cron", "ssh", "systemd-journald"],
  "disk": {"total-gb": 100, "free-gb": 42.5},
  "memory": {"total-mb": 8192, "free-mb": 3100},
  "user-details": {
    "root": {
      "home": "/root", "shell": "/bin/bash", "groups": ["root"],
      "last-login": "2026-09-13T21:04:10Z", "last-failed-login": null
    }
  },
  "local-users": ["root", "nickanderson"],
  "classes": ["any", "linux", "ubuntu", "ubuntu_24", "x86_64", "cfengine_3", "policy_server", "am_policy_hub"],
  "role": "Hub",
  "hub": "124.56.78.77",
  "online": true,
  "cloud-provider": "AWS",
  "first-seen": "2024-03-02T09:14:55Z",
  "last-seen": "2026-09-14T17:02:11Z"
}
```

Some guidelines for generating random hosts:

- `os` Should be one of N different real operating systems in a hardcoded list (Ubuntu 24, Ubuntu 22, Debian 12, RHEL 9, Windows 2016, etc.).
  The choice is weighted, not uniform: a few platforms are very common (Ubuntu 24, RHEL 8, Debian 12), most are less common (Windows 2016, Ubuntu 26, ...), and some are rare (SUSE 15, CentOS 7).
- `id` should be a truly randomly generated SHA 256 hex ID, prefixed with `SHA=`
- `hostname` should be unique and believable, combine 2 or three words like: production-hub, testing1-webserver-alpha, testing2-webserver-alpha. Prefixes to use could be production, testing, staging, dev, optionally with numbers, role / descriptions (middle word) could be hub, webserver, client, firewall, lb, etc. Last word could be common identifier words like alpha, beta, charlie, alice, bob, mercury, saturn, jupiter, zeus, etc.
- `ips` should be valid IPv4 or IPv6 IP addresses.
  At most 4 IPv4 addresses (including `127.0.0.1`, which every host has) and at most 2 IPv6 addresses.
  Nice to not be completely random, i.e. most of them should start with he digits for AWS or similar.
- `macs` should be valid, unique MAC addresses in lowercase colon notation.
  Between 1 and 3 of them, most hosts having just one.
  Use a few believable vendor prefixes (VMware, Intel, Dell, cloud-style locally administered addresses) rather than fully random bytes.
- `ports-listening` should not be completely random - 22 and 5308 should be present on all hosts.
  Other ports for NTP, DNS, webserver etc. can be added.
  Should make sense wrt the name, so a webserver would have 443 and 80 listening, for example.
- `software` should also be based on name - all Ubuntu should have dpkg, apt and apt-get, RHEL should have yum, rpm, dnf, and so on.
- `classes` should be the CFEngine hard classes for the host's operating system, taken from `data/classes.json`, plus role-specific classes such as `policy_server` on hubs.
- `services` should be the running systemd units: a few base units on every Linux host, distribution-specific ones (`systemd-networkd` on Ubuntu, `NetworkManager` and `firewalld` on RHEL-like systems), and one per installed daemon using the distribution's unit name (`ssh` on Debian-like, `sshd` on RHEL-like). Windows hosts have none.
- `software-versions` should be believable, based on common and recent releases of each software, chosen from a short weighted list so many hosts share the same versions. `cfengine` is on every host.
- `disk` and `memory` sizes should follow the role (database and backup servers have bigger disks, databases and hubs more memory), with a random share free.
- `user-details` should give each local user a believable home directory, shell and groups (`/root`, `/bin/bash` and `root` for root; `/var/www`, a nologin shell and `www-data` for www-data; Windows accounts have no shell). Only accounts people log in as (root, Administrator) get login times: most were used within the last month, and about a third have a more recent failed login.
- `role` is `Hub` for exactly 5 hosts (hosts named "hub" first) and `Client` for the rest. `hub` is the IP address of the host's hub: for a hub one of its own public IPv4 addresses (never `127.0.0.1`, added if it has none), for a client the address of one of the hubs, spread evenly. Hubs get the `policy_server` and `am_policy_hub` classes.
- `cloud-provider` should be a well-known provider (AWS, Azure, GCP, Hetzner, DigitalOcean) or the empty string for hosts outside any cloud. AWS should be the most common, and about a quarter of hosts should have none.
- `first-seen` and `last-seen` are ISO 8601 UTC timestamps of when the host first and most recently reported in. Online hosts were last seen within the last 15 minutes of generation, offline hosts hours to weeks earlier, and every host was first seen between a day and a few years before that.
- `online` is whether the host has reported in recently. Around 70% of hosts should be online.
- `local-users` should include root on all Linux machines, and Administrator on Windows.
  Make sure to include some common system / application users for things like email software, printing, etc.

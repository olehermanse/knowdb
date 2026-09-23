The human wants you to work on one thing at a time, from the TODOS folder.
When you have finished something, delete the TODO file and commit your work.
Then look for new TODOs.

If something is really unclear, you can create a FAQ entry with a question, similar to what-is-this.md for the human operator to answer.
In most cases this should not be necessary, but it can be useful to build a knowledge base on what this project is and should be.

Add tests using playwright. `npm test` starts the dev server on port 3000
and reuses one already running there, which is wrong if it belongs to
another project; `PORT=3100 npm test` runs both on another port.

Keep the README short: how to run it, how it works and a bulleted list of
entry types. Details about the UI, the data files and the generator belong
in this file.

# How the UI works

## Entry pages

Every entry page except a host's has its title across the top and is
split in two below it. The left side holds the entry's own information and
its Similar, Resources, (for software) Versions, (for variables) Values
and Comments tabs. The right side is about the entry's hosts: when exactly
one host matches it shows that host exactly as on the host page, and when
several match it shows a "Hosts" heading with three tabs: Charts (the
default) with the Operating systems and Clouds pie charts (each with a
ranked list, and each skipped when there is only one option; hosts outside
any cloud are their own slice), List with the paginated hosts, and Ports
with the ports those hosts listen on (one card per port with the number of
hosts, linking to a search for them). The chosen tab is remembered in a
cookie while moving between entries. The operating systems chart is hidden
on OS pages, the clouds chart on cloud pages and the Ports tab on port
pages. An IP address, MAC address or hostname belonging to a single host
shows only the host and the Similar tab.

The Similar tab lists entries of the same type whose names start with the
same three or more characters, longest match first; it is shown grayed out
with (0) when there are none. For values, the whole variable name and the
equals sign have to match, and then the first three characters of the
value: `sys.flavor=ubuntu_24` is similar to `sys.flavor=ubuntu_22` but not
to `sys.flavor=debian_12` or to any `sys.class` value.

Lists show at most 10 items at a time, with pagination links below the
list: hosts, but also the ports, versions and similar entries in the tabs.

Pages show first and last seen at the top right, level with the type
badge, as a faded italic sentence in relative times ("First seen 3 years
ago, last seen 34 minutes ago."), with the full date and time in UTC as a
tooltip. Other entries derive their timestamps from their hosts: first
seen is the earliest of the hosts' first-seen times and last seen the
latest last-seen. The type badge links to the listing of that type.

"See also" links entries of different types with matching names, ignoring
case and punctuation: the group `Linux` and the class `linux`, the class
`ubuntu_24` and the OS `Ubuntu 24`, the class `cfengine` and the software
`cfengine`. It also links software and the ports it typically listens on,
services and the software they belong to, and the Hub and Client roles to
each other.

## Host pages

A host page shows its software, services, classes and variables as counts
with a "Show all" button that opens a scrollable list which filters live
as you type. The popup uses the native HTML popover attribute and a few
lines of plain JavaScript, so it needs no framework code in the browser.
Variables are listed as `sys.arch=x86_64 (87 hosts)`: the variable and the
value link to their entries, and the count of hosts sharing that value
links to a search for them.

Every host has a GitHub-style pixel avatar derived from its host key, so
it stays the same everywhere the host appears. The avatar's colour comes
from the host's operating system (the `color` field of the OS entry in
`data/info.json`, falling back to a colour derived from the OS name). A
green or gray dot in the avatar's bottom right corner shows whether the
host is online.

Disk and memory are shown as "42 GB free of 100 GB (42%)". Clicking one
opens a search for hosts with a smaller share free than this host, using a
condition such as `disk<42%` or `memory<38%` in the search box, where the
percentage (or the operator: `<`, `<=`, `>`, `>=`) can be edited.

A host page shows its Role (linking to the role page) and its Hub (the IP
address, linking to that address, with the hub's hostname linking to the
hub); a hub also shows "Clients: N hosts", linking to a search for the
clients reporting to it.

A user page shows the user's details across the hosts that have the user,
in two columns like a host's details: the distinct homes, shells and
groups, and the most recent login and failed login with the host they
happened on.

The host preview on the right of other entries shows only the basic
fields: no pinned items, no Comments section and no Software, Services,
Classes or Variables buttons.

## Pinned software, services, classes and variables

Every row in the Software, Services, Classes and Variables modals on a
host page has a pin icon (from the lucide icon library). Pinning a row
shows it on every host page as a name/value pair, styled like the host's
basic fields and laid out in four columns, below those fields and above
the modal buttons: the name is a plain label (not a link, to keep the
section quiet) and the value is the software's version, `defined` for a
class, `running` for a service, or the variable's value, linking to the
version, class, service or value entry. When the host does not have the
pinned item, the value reads `(not installed)` for software, `(not
running)` for services and `(not defined)` for classes and variables, in
gray italics. Which items are pinned is stored in the browser's local
storage, shared across all hosts. The pin next to a value is the same
toggle as in the modal, shown in its pressed state (softly coloured);
clicking either unpins: the item fades out and the remaining items slide
into their new places (no animation when the browser asks for reduced
motion).

## Comments

Every entry has a Comments tab (the last tab on the left), and a host page
has a Comments section at the bottom. Each comment is a small card with
the author, the time and the text. Example comments live in
`data/comments.json`, keyed by `<type>:<name>`. The form at the bottom
lets you post a comment, but this is demo only: there is no backend or
login, comments are posted as Alice or Bob at random, and they are kept in
your browser's local storage and shown together with the examples.

## Front page

The front page has a button for each entry type (hosts, ports, software,
...) with its count. A button leads to the search page listing everything
of that type, 10 at a time. Below the buttons is a random sample of
entries with at least one of every type.

## Searching

The search bar at the top of every page searches "anything": hostnames,
host keys, port numbers and names, software, users, operating systems,
groups, IP and MAC addresses, words from descriptions, and the titles and
addresses of external resources (so "cloud.google.com" finds GCP). Results
show the type of each entry, its name and description, and hosts are shown
with their OS and IP addresses.

The search page also lists everything of one type with `/search?type=port`
(this is what the front page buttons link to).

A query can also contain filters like `port:22 group:Windows` or
`os:"Ubuntu 24"` (quote values with spaces), `hub:<ip>` for the hub a host
reports to, and conditions on free disk or memory like `disk<20%` or
`memory>=50%`. Then only hosts matching all of them are listed; a filter
repeated with different values matches either value. `type:os` lists
everything of one type, and combined with filters (`type:cloud os:"Ubuntu
24"`) only the entries of that type with at least one matching host. The
search bar always shows the query exactly as it is in the URL. The "N hosts" links
next to aggregated ports on group, software and OS pages use this to show
exactly those hosts.

# Data files

## Descriptions of ports and software

`data/info.json` is a hand-written file with descriptions of well-known
ports, software, services, local user accounts, operating systems, cloud
providers, classes, variables, roles and special IP addresses. IP
addresses are described either exactly (`127.0.0.1`) or by CIDR range
(`10.0.0.0/8` for private networks); the first matching range wins. Each
port has a short common name (like `ssh` for port 22) and a description;
other entries have a description. Entry pages show the description when
one exists, and otherwise a sentence like "No information available about
this user".

Any entry can also have a `links` list of external sources, each with the
`title` of the page, the `source` site it is on, and the `url`, shown in
the Resources tab of the entry page. Wikipedia links read like `"Secure
Shell" on Wikipedia`; other links show their address, like `openssh.com`
or `github.com/openssh/openssh-portable`. Links point to Wikipedia,
official project websites, source code repositories and specifications;
any source works. Keep the list short: most entries need none or one link,
and more than a handful is too many.

Software entries can list the `ports` they typically listen on, such as
`[5432]` for postgresql; software and port pages then show a "See also"
line linking to each other. A service can name the software it belongs to
(`sshd` belongs to `openssh`), which links the two in "See also".

Well-known software, operating systems and ports can also have a `logo`,
the path of an SVG in `public/logos/` (like `/logos/nginx.svg`) shown
next to the entry's title. Logos are committed to the repository, never
linked from third party websites; most come from Simple Icons,
https://simpleicons.org/, a few (Windows, AWS, Azure) from Wikimedia
Commons, and CFEngine's is the official logo.

Operating systems have a `color` used for the pixel avatars of their hosts.

## Groups of hosts

`data/groups.json` defines groups of hosts, such as `Linux`, `Windows`,
`webservers` and `production`. A group page lists the hosts in it along
with the rules that put them there.

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

## Classes

`data/classes.json` lists the CFEngine hard classes for each operating
system. The generator reads them from there and adds `policy_server` and
`am_policy_hub` on hubs.

## Variables

Every host reports the same CFEngine special variables (`sys.*`, see
https://docs.cfengine.com/docs/master/reference/special-variables/sys) in
`variables`, a map from variable name to its value on that host. The
values differ between hosts: `sys.fqhost` is unique to each, `sys.class`
is `linux` or `windows`, `sys.policy_hub` is the hub's address. Variables
and values are modelled like software and versions: a value page is named
`<variable>=<value>` and is kept short like a version page.

## Roles and hubs

Every host has a CFEngine `role`, either `Hub` or `Client`, and a `hub`
field with the IP address of the hub it reports to. A hub is its own hub,
so its `hub` field is one of its own public IP addresses, never the
loopback address. Of the 100 generated hosts, 5 are hubs.

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
  "variables": {"sys.arch": "x86_64", "sys.class": "linux", "sys.fqhost": "production-hub.prod.example.com", "sys.policy_hub": "124.56.78.77"},
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
- `variables` should be the same set of `sys.*` variables on every host, with values that follow from the rest of the host: `sys.flavor` and `sys.release` from the OS, `sys.uqhost`, `sys.fqhost` and `sys.domain` from the hostname and environment, `sys.ipv4` from the addresses, `sys.policy_hub` from the hub, `sys.cf_version` from the cfengine version, `sys.cpus` from the memory size, `sys.workdir` and `sys.inputdir` per platform, and a random `sys.uptime` in minutes.
- `cloud-provider` should be a well-known provider (AWS, Azure, GCP, Hetzner, DigitalOcean) or the empty string for hosts outside any cloud. AWS should be the most common, and about a quarter of hosts should have none.
- `first-seen` and `last-seen` are ISO 8601 UTC timestamps of when the host first and most recently reported in. Online hosts were last seen within the last 15 minutes of generation, offline hosts hours to weeks earlier, and every host was first seen between a day and a few years before that.
- `online` is whether the host has reported in recently. Around 70% of hosts should be online.
- `local-users` should include root on all Linux machines, and Administrator on Windows.
  Make sure to include some common system / application users for things like email software, printing, etc.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

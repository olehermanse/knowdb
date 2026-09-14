#!/usr/bin/env python3
"""Generate random hosts based on the description in README.md.

Writes 100 hosts to tmp/hosts.json.
"""

import json
import random
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

NUM_HOSTS = 100
OUTPUT_PATH = Path(__file__).parent.parent / "tmp" / "hosts.json"
CLASSES_PATH = Path(__file__).parent.parent / "data" / "classes.json"

# CFEngine hard classes per operating system, from data/classes.json.
with open(CLASSES_PATH) as _f:
    OS_CLASSES = {k: v for k, v in json.load(_f).items() if not k.startswith("_")}

# Operating systems with relative weights, so the distribution is not
# uniform: a few platforms are very common, most are less common, and some
# are rare.
OPERATING_SYSTEM_WEIGHTS = {
    # Very common
    "Ubuntu 24": 20,
    "RHEL 8": 18,
    "Debian 12": 16,
    # Common
    "Ubuntu 22": 8,
    "RHEL 9": 8,
    "Windows 2022": 6,
    # Less common
    "Windows 2016": 4,
    "Ubuntu 26": 4,
    "Debian 11": 3,
    "Ubuntu 20": 3,
    "Windows 2019": 2,
    "Fedora 40": 2,
    # Rare
    "CentOS 7": 1,
    "SUSE 15": 1,
}
OPERATING_SYSTEMS = list(OPERATING_SYSTEM_WEIGHTS)

HOSTNAME_PREFIXES = ["production", "testing", "staging", "dev"]
HOSTNAME_ROLES = [
    "hub",
    "webserver",
    "client",
    "firewall",
    "lb",
    "db",
    "mail",
    "dns",
    "ntp",
    "proxy",
    "monitor",
    "backup",
]
HOSTNAME_IDENTIFIERS = [
    "alpha",
    "beta",
    "charlie",
    "delta",
    "echo",
    "alice",
    "bob",
    "carol",
    "mercury",
    "venus",
    "mars",
    "saturn",
    "jupiter",
    "neptune",
    "zeus",
    "hera",
    "apollo",
    "athena",
]

# Common cloud-provider-like IPv4 prefixes (AWS and similar ranges),
# so most addresses don't look completely random.
IPV4_PREFIXES = ["3.120", "13.48", "18.130", "34.240", "52.28", "54.93", "10.0", "172.31"]
IPV6_PREFIX = "2a05:d014"

# MAC address prefixes (OUIs) so addresses look like real hardware and
# cloud NICs: VMware, Xen/AWS-style locally administered, Intel, Dell.
MAC_PREFIXES = ["00:50:56", "02:42:ac", "0a:58:0a", "06:1f:3b", "00:1b:21", "d4:be:d9"]

# Ports by role keyword found in the hostname.
ROLE_PORTS = {
    "webserver": [80, 443],
    "lb": [80, 443],
    "proxy": [80, 443, 3128],
    "db": [5432, 3306],
    "mail": [25, 143, 465, 587, 993],
    "dns": [53],
    "ntp": [123],
    "hub": [80, 443],
    "monitor": [9090, 3000],
    "backup": [873],
    "firewall": [],
    "client": [],
}

# Software by role keyword found in the hostname.
ROLE_SOFTWARE = {
    "webserver": ["apache", "nginx"],
    "lb": ["haproxy"],
    "proxy": ["squid"],
    "db": ["postgresql", "mysql"],
    "mail": ["postfix", "dovecot"],
    "dns": ["bind"],
    "ntp": ["chrony"],
    "hub": ["apache", "postgresql"],
    "monitor": ["prometheus", "grafana"],
    "backup": ["rsync"],
}

DEBIAN_LIKE_SOFTWARE = ["dpkg", "apt", "apt-get"]
RHEL_LIKE_SOFTWARE = ["yum", "rpm", "dnf"]
SUSE_SOFTWARE = ["zypper", "rpm"]
WINDOWS_SOFTWARE = ["powershell", "chocolatey", "windows-defender"]
COMMON_LINUX_SOFTWARE = ["curl", "wget", "openssh", "cron", "rsyslog"]
# Cloud providers with weights. The empty string means no cloud provider:
# the host runs in your own data center or similar.
CLOUD_PROVIDERS = [("AWS", 40), ("", 25), ("Azure", 12), ("GCP", 10), ("Hetzner", 8), ("DigitalOcean", 5)]

# Installed on every host, Linux and Windows alike.
UNIVERSAL_SOFTWARE = ["cfengine"]

# Running systemd services. Every Linux host runs a few base units; the
# rest follow from the installed software, with unit names differing
# between Debian-like and RHEL-like distributions. Windows has no systemd.
BASE_SERVICES = ["systemd-journald", "systemd-logind", "dbus", "cf-execd", "cf-serverd", "cf-monitord"]
DEBIAN_LIKE_SERVICES = ["systemd-networkd", "systemd-resolved", "unattended-upgrades"]
RHEL_LIKE_SERVICES = ["NetworkManager", "firewalld", "auditd"]
SUSE_SERVICES = ["wicked", "firewalld"]
SOFTWARE_SERVICES = {
    # software: (debian-like unit, rhel/suse-like unit)
    "openssh": ("ssh", "sshd"),
    "cron": ("cron", "crond"),
    "rsyslog": ("rsyslog", "rsyslog"),
    "chrony": ("chrony", "chronyd"),
    "apache": ("apache2", "httpd"),
    "nginx": ("nginx", "nginx"),
    "haproxy": ("haproxy", "haproxy"),
    "squid": ("squid", "squid"),
    "mysql": ("mysql", "mysqld"),
    "postgresql": ("postgresql", "postgresql"),
    "postfix": ("postfix", "postfix"),
    "dovecot": ("dovecot", "dovecot"),
    "bind": ("named", "named"),
    "grafana": ("grafana-server", "grafana-server"),
    "prometheus": ("prometheus", "prometheus"),
}

# Believable versions per software, with weights so that most hosts share
# the same few versions (the current release dominates, older ones linger).
SOFTWARE_VERSIONS = {
    "cfengine": [("3.27.0", 60), ("3.24.3", 25), ("3.21.7", 10), ("3.18.5", 5)],
    "apache": [("2.4.62", 50), ("2.4.58", 30), ("2.4.57", 15), ("2.4.37", 5)],
    "nginx": [("1.26.2", 50), ("1.24.0", 30), ("1.22.1", 15), ("1.18.0", 5)],
    "haproxy": [("2.9.10", 50), ("2.8.12", 35), ("2.6.19", 15)],
    "squid": [("6.10", 55), ("5.9", 30), ("4.15", 15)],
    "mysql": [("8.0.39", 60), ("8.4.2", 25), ("5.7.44", 15)],
    "postgresql": [("16.4", 50), ("15.8", 25), ("14.13", 15), ("13.16", 10)],
    "postfix": [("3.9.0", 50), ("3.8.6", 35), ("3.7.11", 15)],
    "dovecot": [("2.3.21", 70), ("2.3.16", 30)],
    "bind": [("9.18.28", 60), ("9.16.50", 30), ("9.11.36", 10)],
    "chrony": [("4.6", 50), ("4.5", 35), ("4.2", 15)],
    "grafana": [("11.2.0", 55), ("10.4.8", 35), ("9.5.21", 10)],
    "prometheus": [("2.54.1", 60), ("2.45.6", 30), ("2.37.9", 10)],
    "rsync": [("3.3.0", 55), ("3.2.7", 35), ("3.1.3", 10)],
    "rsyslog": [("8.2408.0", 50), ("8.2312.0", 30), ("8.2102.0", 20)],
    "openssh": [("9.8p1", 45), ("9.6p1", 30), ("8.9p1", 15), ("8.7p1", 10)],
    "curl": [("8.9.1", 45), ("8.5.0", 30), ("7.88.1", 15), ("7.76.1", 10)],
    "wget": [("1.24.5", 50), ("1.21.4", 35), ("1.21.1", 15)],
    "cron": [("3.0pl1-189", 50), ("3.0pl1-137", 30), ("1.7.0", 20)],
    "dpkg": [("1.22.6", 55), ("1.21.22", 35), ("1.20.13", 10)],
    "apt": [("2.7.14", 55), ("2.6.1", 35), ("2.4.13", 10)],
    "apt-get": [("2.7.14", 55), ("2.6.1", 35), ("2.4.13", 10)],
    "rpm": [("4.19.1.1", 45), ("4.16.1.3", 35), ("4.14.3", 20)],
    "yum": [("4.14.0", 60), ("4.7.0", 25), ("3.4.3", 15)],
    "dnf": [("4.14.0", 60), ("4.7.0", 40)],
    "zypper": [("1.14.76", 70), ("1.14.64", 30)],
    "powershell": [("7.4.5", 50), ("7.2.24", 25), ("5.1.20348", 25)],
    "chocolatey": [("2.3.0", 60), ("2.2.2", 25), ("1.4.0", 15)],
    "windows-defender": [("4.18.24080.9", 60), ("4.18.24070.5", 30), ("4.18.23110.3", 10)],
}

# Users by role keyword found in the hostname.
ROLE_USERS = {
    "webserver": ["www-data"],
    "lb": ["haproxy"],
    "proxy": ["proxy"],
    "db": ["postgres", "mysql"],
    "mail": ["postfix", "dovecot"],
    "dns": ["bind"],
    "monitor": ["prometheus", "grafana"],
    "hub": ["www-data", "postgres"],
}
COMMON_LINUX_USERS = ["daemon", "mail", "lp", "sshd", "nobody", "syslog"]
COMMON_WINDOWS_USERS = ["Guest", "DefaultAccount", "SYSTEM"]


def generate_id():
    return "SHA=" + secrets.token_hex(32)


def generate_hostname(used):
    while True:
        prefix = random.choice(HOSTNAME_PREFIXES)
        if random.random() < 0.4:
            prefix += str(random.randint(1, 9))
        parts = [prefix]
        if random.random() < 0.8:
            parts.append(random.choice(HOSTNAME_ROLES))
        parts.append(random.choice(HOSTNAME_IDENTIFIERS))
        hostname = "-".join(parts)
        if hostname not in used:
            used.add(hostname)
            return hostname


def generate_ipv4():
    prefix = random.choice(IPV4_PREFIXES)
    return f"{prefix}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def generate_ipv6():
    groups = [f"{random.randint(0, 0xFFFF):x}" for _ in range(4)]
    return f"{IPV6_PREFIX}:1000:{':'.join(groups)}:{random.randint(1, 0xFFFF):x}"


MAX_IPV4 = 4  # including 127.0.0.1
MAX_IPV6 = 2


def generate_ips():
    # Every host has loopback, plus 0-3 more IPv4 and 0-2 IPv6 addresses,
    # so at most MAX_IPV4 IPv4 and MAX_IPV6 IPv6 addresses in total.
    ipv4 = {"127.0.0.1"}
    ipv6 = set()
    ipv4_count = random.randint(1, MAX_IPV4)
    ipv6_count = random.choices(range(MAX_IPV6 + 1), weights=[50, 35, 15])[0]
    while len(ipv4) < ipv4_count:
        ipv4.add(generate_ipv4())
    while len(ipv6) < ipv6_count:
        ipv6.add(generate_ipv6())
    return sorted(ipv4 | ipv6)


def generate_mac():
    prefix = random.choice(MAC_PREFIXES)
    return f"{prefix}:{random.randint(0, 255):02x}:{random.randint(0, 255):02x}:{random.randint(0, 255):02x}"


def generate_macs(used):
    # One network interface per host is normal, a few have more.
    count = random.choices([1, 2, 3], weights=[70, 25, 5])[0]
    macs = set()
    while len(macs) < count:
        mac = generate_mac()
        if mac not in used:
            used.add(mac)
            macs.add(mac)
    return sorted(macs)


def role_of(hostname):
    for role in ROLE_PORTS:
        if role in hostname:
            return role
    return None


def generate_ports(hostname):
    ports = {22, 5308}
    role = role_of(hostname)
    if role:
        ports.update(ROLE_PORTS[role])
    return sorted(ports)


def generate_software(os_name, hostname):
    if os_name.startswith(("Ubuntu", "Debian")):
        software = DEBIAN_LIKE_SOFTWARE + COMMON_LINUX_SOFTWARE
    elif os_name.startswith(("RHEL", "CentOS", "Fedora")):
        software = RHEL_LIKE_SOFTWARE + COMMON_LINUX_SOFTWARE
    elif os_name.startswith("SUSE"):
        software = SUSE_SOFTWARE + COMMON_LINUX_SOFTWARE
    else:
        software = list(WINDOWS_SOFTWARE)
    role = role_of(hostname)
    if role and not os_name.startswith("Windows"):
        software = software + ROLE_SOFTWARE.get(role, [])
    return sorted(set(software + UNIVERSAL_SOFTWARE))


def generate_services(os_name, software):
    if os_name.startswith("Windows"):
        return []
    debian_like = os_name.startswith(("Ubuntu", "Debian"))
    services = list(BASE_SERVICES)
    if debian_like:
        services += DEBIAN_LIKE_SERVICES
    elif os_name.startswith("SUSE"):
        services += SUSE_SERVICES
    else:
        services += RHEL_LIKE_SERVICES
    for name in software:
        units = SOFTWARE_SERVICES.get(name)
        if units:
            services.append(units[0] if debian_like else units[1])
    return sorted(set(services))


def generate_software_versions(software):
    versions = {}
    for name in software:
        choices = SOFTWARE_VERSIONS.get(name)
        if not choices:
            continue
        versions[name] = random.choices(
            [v for v, _ in choices], weights=[w for _, w in choices]
        )[0]
    return versions


def generate_users(os_name, hostname):
    if os_name.startswith("Windows"):
        users = ["Administrator"] + random.sample(COMMON_WINDOWS_USERS, k=random.randint(1, 3))
    else:
        users = ["root"] + random.sample(COMMON_LINUX_USERS, k=random.randint(2, 4))
        role = role_of(hostname)
        if role:
            users += ROLE_USERS.get(role, [])
    return sorted(set(users))


def generate_classes(os_name, hostname):
    classes = list(OS_CLASSES.get(os_name, ["any", "cfengine"]))
    if role_of(hostname) == "hub":
        classes += ["policy_server", "am_policy_hub"]
    return classes


NOW = datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def generate_seen(online):
    """First and last time the host reported in, as ISO 8601 UTC timestamps.

    Online hosts reported within the last 15 minutes; offline hosts between
    a couple of hours and two months ago. Hosts were first seen between a
    day and three years before that.
    """
    if online:
        last_seen = NOW - timedelta(seconds=random.randint(0, 15 * 60))
    else:
        last_seen = NOW - timedelta(seconds=random.randint(2 * 3600, 60 * 24 * 3600))
    first_seen = last_seen - timedelta(seconds=random.randint(24 * 3600, 3 * 365 * 24 * 3600))
    return iso(first_seen), iso(last_seen)


def generate_cloud_provider():
    return random.choices(
        [name for name, _ in CLOUD_PROVIDERS], weights=[w for _, w in CLOUD_PROVIDERS]
    )[0]


def generate_host(used_hostnames, used_macs):
    os_name = random.choices(
        OPERATING_SYSTEMS, weights=list(OPERATING_SYSTEM_WEIGHTS.values())
    )[0]
    hostname = generate_hostname(used_hostnames)
    software = generate_software(os_name, hostname)
    # Roughly 70% of hosts are online (have reported recently).
    online = random.random() < 0.7
    first_seen, last_seen = generate_seen(online)
    return {
        "os": os_name,
        "id": generate_id(),
        "hostname": hostname,
        "ips": generate_ips(),
        "macs": generate_macs(used_macs),
        "ports-listening": generate_ports(hostname),
        "software": software,
        "services": generate_services(os_name, software),
        "software-versions": generate_software_versions(software),
        "local-users": generate_users(os_name, hostname),
        "classes": generate_classes(os_name, hostname),
        "cloud-provider": generate_cloud_provider(),
        "online": online,
        "first-seen": first_seen,
        "last-seen": last_seen,
    }


def main():
    used_hostnames = set()
    used_macs = set()
    hosts = [generate_host(used_hostnames, used_macs) for _ in range(NUM_HOSTS)]
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(hosts, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(hosts)} hosts to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate random hosts based on the description in README.md.

Writes 100 hosts to tmp/hosts.json.
"""

import json
import random
import secrets
from pathlib import Path

NUM_HOSTS = 100
OUTPUT_PATH = Path(__file__).parent.parent / "tmp" / "hosts.json"

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
    return sorted(set(software))


def generate_users(os_name, hostname):
    if os_name.startswith("Windows"):
        users = ["Administrator"] + random.sample(COMMON_WINDOWS_USERS, k=random.randint(1, 3))
    else:
        users = ["root"] + random.sample(COMMON_LINUX_USERS, k=random.randint(2, 4))
        role = role_of(hostname)
        if role:
            users += ROLE_USERS.get(role, [])
    return sorted(set(users))


def generate_host(used_hostnames, used_macs):
    os_name = random.choices(
        OPERATING_SYSTEMS, weights=list(OPERATING_SYSTEM_WEIGHTS.values())
    )[0]
    hostname = generate_hostname(used_hostnames)
    return {
        "os": os_name,
        "id": generate_id(),
        "hostname": hostname,
        "ips": generate_ips(),
        "macs": generate_macs(used_macs),
        "ports-listening": generate_ports(hostname),
        "software": generate_software(os_name, hostname),
        "local-users": generate_users(os_name, hostname),
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

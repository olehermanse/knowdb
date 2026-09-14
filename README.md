# KnowDB

A prototype for exploring your infrastructure in a Wikipedia-like manner,
based on the data reported from your hosts.
Click on a host to see information about it, see that port 22 is open,
read what port 22 is for, see other hosts with port 22 open, and so on.

## Running the frontend

The frontend is a Next.js app in the `frontend/` directory.

### With the npm dev server

```bash
( cd frontend && npm install && npm run dev )
```

Then open http://localhost:3000.

### With Docker

```bash
( cd frontend && docker build -t knowdb-frontend . && docker run --rm -p 3000:3000 knowdb-frontend )
```

Then open http://localhost:3000.

### Running the tests

The frontend has Playwright tests (the test runner starts the dev server for you):

```bash
cd frontend
npm install
npx playwright install chromium
npm test
```

## Generating host data

`scripts/generate_hosts.py` generates 100 random hosts and writes them to
`tmp/hosts.json`. The frontend reads a committed copy of this data from
`frontend/data/hosts.json`:

```bash
python3 scripts/generate_hosts.py
cp tmp/hosts.json frontend/data/hosts.json
```

## Descriptions of ports and software

`frontend/data/info.json` is a hand-written file with descriptions of
well-known ports and software. Each port has a short common name (like
`ssh` for port 22) and a description, and each software package has a
description. Edit this file to improve or extend the descriptions shown
on entry pages; the frontend reads it at build time.

## Host data format

The relevant information from a host looks like this:

```json
{
  "os": "Ubuntu 24",
  "id": "SHA=31bcb32950d8b91ffdfca85bca71364ec8f67c93246e3617c3a49af58363c4a1",
  "hostname": "production-hub",
  "ips": ["124.56.78.77", "127.0.0.1"],
  "ports-listening": [22, 80, 443, 5308],
  "software": ["apache", "dpkg", "apt", "apt-get", "brew", "curl", "wget"],
  "local-users": ["root", "nickanderson"]
}
```

Some guidelines for generating random hosts:

- `os` Should be one of N different real operating systems in a hardcoded list (Ubuntu 24, Ubuntu 22, Debian 12, RHEL 9, Windows 2016, etc.).
- `id` should be a truly randomly generated SHA 256 hex ID, prefixed with `SHA=`
- `hostname` should be unique and believable, combine 2 or three words like: production-hub, testing1-webserver-alpha, testing2-webserver-alpha. Prefixes to use could be production, testing, staging, dev, optionally with numbers, role / descriptions (middle word) could be hub, webserver, client, firewall, lb, etc. Last word could be common identifier words like alpha, beta, charlie, alice, bob, mercury, saturn, jupiter, zeus, etc.
- `ips` should be valid IPv4 or IPv6 IP addresses.
  Between 1 and 10 of them.
  Nice to not be completely random, i.e. most of them should start with he digits for AWS or similar.
- `ports-listening` should not be completely random - 22 and 5308 should be present on all hosts.
  Other ports for NTP, DNS, webserver etc. can be added.
  Should make sense wrt the name, so a webserver would have 443 and 80 listening, for example.
- `software` should also be based on name - all Ubuntu should have dpkg, apt and apt-get, RHEL should have yum, rpm, dnf, and so on.
- `local-users` should include root on all Linux machines, and Administrator on Windows.
  Make sure to include some common system / application users for things like email software, printing, etc.

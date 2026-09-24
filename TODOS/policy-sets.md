Introduce a new entry for a policy set.
Policy sets should be uniquely identified by a SHA-256 hash, but also have a human readable version number which is shown first (SHA in parens).
Change it so all the files from out/masterfiles are a part of the policy set.
The host should report which policy set it is using, not all the individual files.
The host should still report other files, like SSHD configs and motd etc.
Host entry page should show which policy set the host has.
The entry for a policy set should show the version, checksum, which hosts have it, and which files are inside it.
It should also show all the "recursive" links as files do, so bundles, bodies, calls, variables, classes, etc.

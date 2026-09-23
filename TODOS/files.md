Add support for files. We don't want to list literally all files on each host, but we want to pay attention to CFEngine policy files, and some other notable files, like some files CFEngine is editing.

A file is uniquely identified by its SHA-256 checksum.
There are also filenames and paths (full absolute paths).

look at tmp/proj/out/masterfiles to find a real policy set.
Put all of those files in the generated test data.

One file (checksum) may have multiple names and multiple different paths.
One filename may have multiple different actual files (checksums).
We want to add 3 new entry types: file, path, filename.

The files in the policy set at tmp/proj/out/masterfiles should show up on hosts like so:

tmp/proj/out/masterfiles/promises.cf

should show up as 

/var/cfengine/masterfiles/promises.cf on the hub(s)

and

/var/cfengine/inputs/promises.cf

on hubs and clients.

In the UI I want to open a file and see the full file content.
For some cases, like large binary files, content may not be available, only checksum.

Another example of a file to put in the example data is SSH authorized_keys files and sshd config files.

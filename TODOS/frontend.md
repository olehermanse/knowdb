Make a NextJS based project for this.
We want to use npm, and docker.
README should have instructions for how to run with the npm dev server, and how to run in Docker.

Frontend should have 10 random entries shown on the front page.
We can make search later.

Each entry is an ID/name and a type.
Examples:
 - Type: host Name: <SHA256 hostkey>
 - Type: ip Name: 1.2.3.4
 - Type: port Name: 22

When you are looking at 1 entry all the information there should be clickable, so for example, when looking at a host, its OS, IP addresses, listening port(s) etc. should be clickable and take you to a page which has information about that entry. This way someone could navigate from 1 host, to a port number, to another host with that port listening, etc.

This means you need to generate 2-way linked entries for all the things found in the host information.

The type is important, for example a host with the name dpkg should not be considered the same thing as the dpkg software.

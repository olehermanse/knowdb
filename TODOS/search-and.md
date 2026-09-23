Make it so when using a search like this:

```
os:"Ubuntu 24" os:"Ubuntu 22"
```

This should mean Ubuntu 24 OR Ubuntu 22, so search shows the list of all hosts for both OSes.

When targeting different filters, the logic should be as now:

```
os:"Ubuntu 24" port:443
```

This narrows it down from 14 results for only Ubuntu 24, to only 1 result which matches both.


```
os:"Ubuntu 24" group:"Linux"
```

is the same as:

```
os:"Ubuntu 24"
```

This is only since Ubuntu 24 is a strict subset of Linux.

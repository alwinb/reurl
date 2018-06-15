Re-URL
======

Work in progress. 

A second attempt at a URL parser. 

Features:

* A small code base. 
* Support for relative URLs. 
* Optional coercion to base URLs as defined in the [WhatWG URL Standard][1]. 
* Optional support for Windows drive letters. 
* Optional support for backslash separators in URLs. 

[1]: https://url.spec.whatwg.org/


Theory
------

The library is based on a simple theory of URLs, as follows. 

An **URL** is a sequence of tokens where tokens are tuples (type, value), where

  - type is taken from the set { SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG } and
  - value is a string. 

In addition URLs are subject to the following conditions:

  - URLs contain at most one token per type, except for DIR-tokens (of which they may have any amount),
  - tokens are ordered by type according to SCHEME < AUTH < DRIVE < ROOT < DIR < FILE < QUERY < FRAG, and
  - if an URL has an AUTH or a DRIVE token, and it has a DIR or a FILE token, then it also has a ROOT token. 


Parser
------

The library uses, comparatively, a very simple parser that produces a sequence of tokens. 
Operations such as resolution and coercion to base URLs are implemented as operations on sequences of tokens. 


Operations
----------

The quintessential operation on URLs is 'join', which is the basis for the resolve operation.
URLs are a special case of ordered lists, and 'join' is much like zipping/ merging two ordered lists. 

- join
- force (coerce to a base URL, may use steal)
- normalize (remove superfluous `.` and `..` tokens, a.o.)
- resolve (resolves an URL against a base URL)
- steal (attempt to 'steal' a missing AUTH token from the first nonempty DIR ot FILE token)
- letter (detect possible drive-letters in an URL)

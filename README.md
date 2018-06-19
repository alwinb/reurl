Re-URL
======

(Some work still in progress.)

A second attempt at a small, properly structured URL parser. 

Features:

* A small code base. 
* Support for relative URLs. 
* Optional coercion to base URLs as defined in the [WhatWG URL Standard][1]. 
* Optional support for Windows drive letters. 
* Optional support for backslash separators. 

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


Thus, URLs are a special case of ordered lists, where the ordering reflects the hierarchical structure of an URL string. 
The key operations on URLs are a lot like merging / zipping ordered lists. 



Architecture
------------

The core of the library uses, comparatively, a very simple parser that 
produces a sequence of tokens, as per the above. Operations such as resolution
and coercion to base URLs are implemented as operations on this sequences of 
tokens. The quintessential operation on URLs is 'join' (or, 'goto'), which is
the basis for the resolve operation.  
The operations implemented in the core library are:

- url (configurable parser)
- parse (naive parser)
- print (convert to string)
- join (aka. goto)
- force (coerce to a base URL, may use steal)
- normalize (remove superfluous `.` and `..` tokens, a.o.)
- resolve (resolves an URL against a base URL)
- steal (attempt to 'steal' a missing AUTH token from the first nonempty DIR or FILE token)
- letter (detects if an URL has a windows drive-letter and create a DRIVE token for it)



Public API
----------

The public API exposes a single constructor, `Url`. 
All methods on `Url` objects are immutable. 


### Url Constructor

Given an URL-string `string` and optionally a parser configuration object `conf`,
`new Url (string, conf)` returns a new Url object.  

The optional `conf` argument may be a string to specify a base scheme;
or an object with three optional fields 
`convertSlashes:boolean`, `driveLetters:boolean`, `baseScheme:string`. 


### fragment

`url.fragment` is a getter that returns the fragment part as a string, 
or `null` if no such part is present. 

Note that `new Url ('/abc/#').fragment` yields `''` whereas
`new Url ('/abc/').fragment` yields `null`. 


### query

`url.query` is a getter that returns the query part as a string, 
or `null` if no such part is present. 

Note that `new Url ('/abc/?').query` yields `''` whereas
`new Url ('/abc/').query` yields `null`. 


### scheme

`url.scheme` is a getter that returns the scheme as a string, 
or `null` if the scheme part is not present (e.g. in relative URLs). 


### toString

`url.toString ()` converts an Url object to an URL-string. 


### goto, join

### normalize, normalise

### force

### resolve

### tokens, [Symbol.iterator]











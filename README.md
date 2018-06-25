Re-URL
======

Relative (and absolute, too!) URL parser and manipulation library.

(Some work still in progress.)

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


Thus, URLs are a special case of ordered lists, where the ordering reflects the hierarchical structure of the URL. 
The key operations on URLs are a lot like merging / zipping ordered lists. 



Public API
----------

The public API exposes a single constructor, `Url`. 
All methods on `Url` objects are immutable. 


### Constructor: new Url (string, conf)

Given an URL-string `string` and optionally a parser configuration object `conf`,
`new Url (string, conf)` returns a new Url object.  

The optional `conf` argument may be a string to specify a base scheme;
or an object with three optional fields 
`convertSlashes:boolean`, `detectDrive:boolean`, `baseScheme:string`. 


### Constructor: new Url (url)

Given an Url object `url`, `new Url (url)` returns a new Url object
that is equivalent to `url`. 


### url.fragment

Given an Url object `url`, `url.fragment` is a getter that returns the
fragment part of `url` as a string, or `null` if no such part is present. 

	new Url ('http://foo#baz').fragment
	// => 'baz'

	new Url ('/abc/#').fragment
	// => ''

	new Url ('/abc/').fragment
	// => null


### url.query

Given an Url object `url`, `url.query` is a getter that returns the
query part of `url` as a string, or `null` if no such part is present. 

	new ReUrl ('http://foo?search#baz').query
	// => 'search'

	new Url ('/abc/?').query
	// => ''

	new Url ('/abc/').query
	// => null


### url.scheme

Given an Url object `url`, `url.scheme` is a getter that returns the
scheme of `url` as a string, or `null` if no scheme part is present (e.g. in relative URLs). 

	new Url ('http://foo?search#baz').scheme
	// => 'http'

	new Url ('/abc/?').scheme
	// => null


### url.toString (); url.toJSON ()

Converts an Url object to an URL-string. 


### url.goto (other)

Given an Url object `url`, `url.goto (other)` returns a new Url object
by 'refining' `url` with `other`, where other may be a string or an Url object. 

Goto does not do additional normalization. If you need normalization, 
use `url.goto (other) .normalize ()`.

If `other` is a string, it will be internally converted to an Url object, using the scheme of `url` as a parser setting. 

	new Url ('/foo/bar') .goto ('baz/index.html') .toString ()
	// => '/foo/baz/index.html'

	new Url ('/foo/bar') .goto ('//host/path') .toString ()
	// => '//host/path'

	new Url ('http://foo/bar/baz/') .goto ('./../bee') .toString ()
	// => 'http://foo/bar/baz/./../bee'


### url.normalize (); url.normalise ()

Given an Url object `url`, `url.normalize ()` returns a new Url object by
normalizing `url`. Normalization involves, a.o. 
interpreting `.` and `..` segments within the path and removing the default port
and empty user/password info from the authority of `url`. 


### url.resolve (baseUrl)

Equivalent to `new Url (baseUrl) .force () .goto (url) .normalize ()`


### url.tokens (); url \[Symbol.iterator] ()

(Forthcoming)


### url.force ()

Forcibly convert an Url to a base URL. 
The coercion follows the behaviour that is specified in the WhatWG URL Standard. 

- For URLs that have a scheme being one of `http`, `https`, `ws`, `wss`,
`ftp` or `gopher` and an absent or empty authority, the authority component
will be 'stolen' from the first nonempty component of the path. For example,
calling `force` on any of the following URLs, will result in `http://foo/bar`. 

  - `http:foo/bar`
  - `http:/foo/bar`
  - `http://foo/bar`
  - `http:///foo/bar`

- In file URLs, windows drive letters are detected. 
If the authority looks like a drive-letter, then it is converted to a DRIVE token. 
Otherwise, if the first path segment looks like a drive letter, then
it is converted to a DRIVE token. 

Examples:

	new Url ('http:foo/bar') .force () .toString ()
	// => 'http://foo/bar'

	new Url ('file:d:/foo/bar') .force () .toString ()
	// => 'file:///d:/foo/bar'


Architectural notes
-------------------

The core of the library uses, comparatively, a very simple parser that 
produces a sequence of tokens. Operations such as resolution
and coercion to base URLs are implemented as operations on these sequences of 
tokens. The quintessential operation on URLs is 'join' (or, 'goto'), which is
the basis for the resolve operation. This operation can be elegantly expressed
as a zip/ merge like operation on sequences of ordered URL tokens. 

The operations implemented in the core library `/lib/core.js` are:

- url (configurable parser)
- parse (naive parser)
- print (convert to string)
- join (aka. goto)
- force (coerce to a base URL, may use steal)
- normalize (remove superfluous `.` and `..` tokens, a.o.)
- resolve (resolves an URL against a base URL)
- steal (attempt to 'steal' a missing AUTH token from the first nonempty DIR or FILE token)
- letter (detects if an URL has a windows drive-letter and creates a DRIVE token for it)


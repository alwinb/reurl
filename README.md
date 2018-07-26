Re-URL
======

Relative (and absolute) URL parser and manipulation library.

(Some work still in progress.)

Features:

* Small code base. 
* Supports working with relative URLs. 
* Optional coercion to base URLs as defined in the [WhatWG URL Standard][1]. 
* Configurable support for Windows drive letters and backslash separators. 

[1]: https://url.spec.whatwg.org/


Theory
------

The library is based on a simple theory of URLs, as follows. 

An **URL** is a sequence of tokens where tokens are tuples (type, value), where

  - type is taken from the set { SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG } and
  - if type is AUTH then value is an **Authority**, otherwise value is a string.

In addition URLs are subject to the following conditions:

  - URLs contain at most one token per type, except for DIR-tokens (of which they may have any amount),
  - tokens are ordered by type according to SCHEME < AUTH < DRIVE < ROOT < DIR < FILE < QUERY < FRAG, and
  - if an URL has an AUTH or a DRIVE token, and it has a DIR or a FILE token, then it also has a ROOT token. 

An **Authority** is a named tuple (username, password, hostname, port) where

  - hostname is a string
  - username, password and port are either undefined or a string,
  - if the password is a string, then so is the username. 

By this definition, URLs are a special case of ordered lists, where the ordering reflects the hierarchical structure of the URL. 
The key operations on URLs are a lot like merging / zipping ordered lists. 


Public API
----------

The public API exposes a single constructor, `ReUrl`. 
All methods on `ReUrl` objects are immutable. 

In the documentation below:

- An **URL** is the abstract, mathematical entity;
  a sequence of tokens as described above. 
- An **URL-string**, is a string representation of an URL. 
- A **ReUrl object**, is a javascript ReUrl object representation of an URL. 


### Constructor: new ReUrl (string, conf)

Given a string `string` and optionally a parser configuration object `conf`,
`new ReUrl (string, conf)` returns a new ReUrl object by parsing the string as an URL-string.  

The optional `conf` argument may be a string to specify a base scheme;
or an object with three optional fields 
`convertSlashes:boolean`, `detectDrive:boolean`, `baseScheme:string`. 


### Constructor: new ReUrl (url)

Given a ReUrl object `url`, `new ReUrl (url)` returns a new ReUrl object that represents the same URL. 


### url.scheme

A getter that returns the scheme of `url` as a string,
or `null` if no scheme part is present (e.g. in relative URLs). 

	new ReUrl ('http://foo?search#baz').scheme
	// => 'http'

	new ReUrl ('/abc/?').scheme
	// => null


### url.path

A getter that returns a new ReUrl object consisting of only 
the path components of `url` or `null` if no such components are present. 

	new ReUrl ('http://foo#baz').path
	// => null

	new ReUrl ('http://foo/bar/file#baz') .path .toString ()
	// '/bar/file'

	new ReUrl ('../foo/bar/file#baz') .path .toString ()
	// '../foo/bar/file'


### url.query

A getter that returns the query part of `url` as a string,
or `null` if no such part is present. 

	new ReUrl ('http://foo?search#baz').query
	// => 'search'

	new ReUrl ('/abc/?').query
	// => ''

	new ReUrl ('/abc/').query
	// => null


### url.fragment

A getter that returns the fragment part of `url` as a string, 
or `null` if no such part is present. 

	new ReUrl ('http://foo#baz').fragment
	// => 'baz'

	new ReUrl ('/abc/#').fragment
	// => ''

	new ReUrl ('/abc/').fragment
	// => null


### url.toString (); url.toJSON (); url.valueOf ()

Converts a ReUrl object to an URL-string. 


### url.toArray ()

Returns an Array representation of url, modeling the sequence of URL tokens as described in the Theory section above. 
(Note, the actual format of the tokens returned is still in flux.)

	new ReUrl ('http://example.com/foo/bar/baz?q#h') .toArray ()
	// => 
	// [ [ 'scheme', 'http' ],
	//   [ 'auth', 'example.com' ],
	//   [ 'path-root', '' ],
	//   [ 'dir', 'foo' ],
	//   [ 'dir', 'bar' ],
	//   [ 'file', 'baz' ],
	//   [ 'query', 'q' ],
	//   [ 'fragment', 'h' ] ]


### url.goto (other)

Returns a new ReUrl object by 'refining' `url` with `other`, 
where other may be a string or a ReUrl object. 
If `other` is a string, it will be internally converted to a ReUrl object,
using the scheme of `url` as a parser setting. 

	new ReUrl ('/foo/bar') .goto ('baz/index.html') .toString ()
	// => '/foo/baz/index.html'

	new ReUrl ('/foo/bar') .goto ('//host/path') .toString ()
	// => '//host/path'

	new ReUrl ('http://foo/bar/baz/') .goto ('./../bee') .toString ()
	// => 'http://foo/bar/baz/./../bee'


### url.normalize (); url.normalise ()

Returns a new ReUrl object by normalizing `url`. 
This interprets a.o. `.` and `..` segments within the path ans removes default ports
and trivial usernames/ passwords from the authority of `url`. 

	new ReUrl ('http://foo/bar/baz/./../bee') .normalize () .toString ()
	// => 'http://foo/bar/bee'
	

### url.resolve (base)

Equivalent to `new ReUrl (base) .force () .goto (url) .normalize ()`


### url.force ()

Forcibly convert an URL to a base URL. 
The coercion follows the behaviour that is specified in the WhatWG URL Standard. 

- For URLs that have a scheme being one of `http`, `https`, `ws`, `wss`,
`ftp` or `gopher` and an absent or empty authority, the authority component
will be 'stolen from the first nonempty path segement'. For example,
calling `force` on any of the following URLs, will result in `http://foo/bar`. 

  - `http:foo/bar`
  - `http:/foo/bar`
  - `http://foo/bar`
  - `http:///foo/bar`

- In file URLs, windows drive letters will be detected and inserted:
If the authority looks like a drive-letter, then it is converted to a DRIVE token. 
Otherwise, if the first path segment looks like a drive letter, then
it is converted to a DRIVE token. 

Examples:

	new ReUrl ('http:foo/bar') .force () .toString ()
	// => 'http://foo/bar'

	new ReUrl ('file:d:/foo/bar') .force () .toString ()
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

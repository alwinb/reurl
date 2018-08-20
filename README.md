Re-URL
======

Absolute and Relative URL parser and manipulation library.

(Getting there...)

* Small code base. 
* Supports working with relative URLs. 
* Supports working with non-normalized URLs. 
* Optional and configurable support for Windows drive letters and backslash separators. 
* Optional coercion to base URLs as defined in the [WhatWG URL Standard][1]. 

[1]: https://url.spec.whatwg.org/


Theory
------

The library is based on a simple theory of URLs, as follows. 

An **URL** is a sequence of tokens where tokens are tuples (_type_, _value_), where

  - _type_ is taken from the set { **scheme**, **authority**, **drive**, **root**, **directory**, **file**, **query**, **fragment** } and
  - if _type_ is **authority** then value is an **Authority**, otherwise value is a string.

In addition URLs are subject to the following conditions:

  - URLs contain at most one token per type, except for **directory**-tokens (of which they may have any amount),
  - tokens are ordered by type according to **scheme** < **authority** < **drive** < **root** < **directory** < **file** < **query** < **fragment** and
  - if an URL has an **authority** or a **drive** token, and it has a **directory** or a **file** token, then it also has a **root** token. 

An **Authority** is a named tuple (_username_, _password_, _hostname_, _port_) where

  - _hostname_ is a string
  - _username_, _password_ and _port_ are either undefined or a string,
  - if _password_ is a string, then _username_ is a string.  

By this definition, URLs are a special case of ordered lists, where the ordering reflects the hierarchical structure of the URL. 
The key operations on URLs are like merging / zipping ordered lists. 


API
---

The library exposes a single `ReUrl` class. 


### Constructors

Create new ReUrl objects by parsing an URL-string with an optional parser configuration,
or by aliasing an existing object. Here `conf` is a string (a base scheme), or a function from 
a string (scheme) or null (schemeless) to an object `{ drive:boolean, backslashes:boolean }`. 

- new ReUrl (string [, conf])
- new ReUrl (reurl)


### Conversions

To convert a ReUrl object `url` to a string or Array, use the following. 
All methods are equivalent except for toArray. 

- url.toString ()
- url.valueOf ()
- url.toJSON ()
- url.toArray ()
- url.href // getter


### Getters

A ReUrl object `url` has the following getters that return the corresponding
constituents as strings, or `null` if they are not present. (See below for details). 

- url.scheme
- url.username
- url.password
- url.hostname
- url.port
- url.root
- url.drive
- url.file
- url.query
- url.fragment


### Adding and modifying URL components

To add to or change the values of URL components, 
use the following methods.  
The methods do not mutate `url` but return new ReUrl objects instead. 

- url.withScheme (scheme)
- url.withCredentials (username [, password])
- url.withHost (host [,port]) // aka. withAuthority
- url.withPort (port)
- url.withDrive (drive)
- url.withRoot ()
- url.withFile (filename)
- url.withQuery (querystring)
- url.withFragment (fragment)

withScheme, withPort, withDrive, withFile may throw a TypeError on invalid input. 
withCredentials and withHost throw a TypeError when username, resp. host is null or undefined. 


### Removing URL components

To remove URL components from a ReUrl object, 
use the following methods.  
The methods do not mutate `url` but return new ReUrl objects instead. 

- url.dropScheme ()
- url.dropCredentials ()
- url.dropAuthority () // aka. dropHost
- url.dropPort ()
- url.dropDrive ()
- url.dropRoot ()
- url.dropFile ()
- url.dropDirectory ()
- url.dropQuery ()
- url.dropFragment ()

dropRoot throws a TypeError if dropping the root token
would result in a malformed URL. 

dropDirectory removes the _last_ directory component from the path, 
without normalizing/ interpreting `./` or `../` components. 


### Operations on URLs

- goto (other) // aka. join
- normalize () // aka. normalise
- resolve ([other])
- force ([other])
- forceResolve ([other])


### Full description

#### url.scheme

A getter that returns the scheme of `url` as a string,
or `null` if no scheme part is present (e.g. in relative URLs). 

	new ReUrl ('http://foo?search#baz').scheme
	// => 'http'

	new ReUrl ('/abc/?').scheme
	// => null


#### url.username

A getter that returns the username of `url` as a string,
or `null` if the URL has no authority or credentials. 

	new ReUrl ('http://joe@localhost').username
	// => 'joe'

	new ReUrl ('//host/abc').username
	// => null


#### url.password

A getter that returns the password of `url` as a string,
or `null` if the URL has no authority, credentials or password. 

	new ReUrl ('http://joe@localhost').password
	// => null

	new ReUrl ('http://host').password
	// => null

	new ReUrl ('http://joe:pass@localhost').password
	// => 'pass'

	new ReUrl ('http://joe:@localhost').password
	// => ''


#### url.hostname

A getter that returns the hostname of `url` as a string,
or `null` if no authority is present. 

	new ReUrl ('http://localhost').hostname
	// => 'localhost'

	new ReUrl ('http:foo').hostname
	// => null

	new ReUrl ('/foo').hostname
	// => null


#### url.port

A getter that returns the port of `url`,
or `null` if no authority or port are present. 

	new ReUrl ('http://localhost:8080').port
	// => 8080

	new ReUrl ('foo://host:/foo').port
	// => ''

	new ReUrl ('foo://host/foo').port
	// => null


#### url.root

A getter that returns a string `'/'` if `url` has an absolute path
or `null` otherwise.  
It is possible for file URLs to have a drive, but not a root. 

	new ReUrl ('foo://localhost?q').root
	// => null

	new ReUrl ('foo://localhost/').root
	// => '/'

	new ReUrl ('foo/bar').root
	// => null

	new ReUrl ('/foo/bar').root
	// => '/'

	new ReUrl ('file://c:').root
	// => null

	new ReUrl ('file://c:/').root
	// => '/'


#### url.drive

A getter that returns the drive of `url` as a string
or `null` if no drive is present.  
Note that the presence of drives
depends on the parser settings and/ or URL scheme. 

	new ReUrl ('file://c:').drive
	// => 'c:'

	new ReUrl ('http://c:').drive
	// => null

	new ReUrl ('/c:/foo/bar', 'file').drive
	// => 'c:'

	new ReUrl ('/c:/foo/bar').drive
	// => null


#### url.query

A getter that returns the query part of `url` as a string,
or `null` if no such part is present. 

	new ReUrl ('http://foo?search#baz').query
	// => 'search'

	new ReUrl ('/abc/?').query
	// => ''

	new ReUrl ('/abc/').query
	// => null


#### url.fragment

A getter that returns the fragment part of `url` as a string, 
or `null` if no such part is present. 

	new ReUrl ('http://foo#baz').fragment
	// => 'baz'

	new ReUrl ('/abc/#').fragment
	// => ''

	new ReUrl ('/abc/').fragment
	// => null


#### url.toString (); url.toJSON (); url.valueOf (); url.href (getter);

Converts a ReUrl object to an URL-string. 


#### url.toArray ()

Returns an Array representation of url, modeling the sequence of URL tokens as described in the Theory section above. 
(Note, the actual format of the tokens returned is still in flux.)

	new ReUrl ('http://example.com/foo/bar/baz?q#h') .toArray ()
	// => 
	// [ [ 'scheme', 'http' ],
	//   [ 'authority', { user: null, pass: null, host: 'example.com', port: null } ],
	//   [ 'root', '/' ],
	//   [ 'directory', 'foo' ],
	//   [ 'directory', 'bar' ],
	//   [ 'file', 'baz' ],
	//   [ 'query', 'q' ],
	//   [ 'fragment', 'h' ] ]


#### url.goto (other)

Returns a new ReUrl object by 'refining' `url` with `other`, 
where other may be a string or a ReUrl object. 
If `other` is a string, it will be parsed with the parser configuration
of `url`. If `other` is a ReUrl object then its configuration will
be passed along to the newly returned url. 

	new ReUrl ('/foo/bar') .goto ('baz/index.html') .toString ()
	// => '/foo/baz/index.html'

	new ReUrl ('/foo/bar') .goto ('//host/path') .toString ()
	// => '//host/path'

	new ReUrl ('http://foo/bar/baz/') .goto ('./../bee') .toString ()
	// => 'http://foo/bar/baz/./../bee'


#### url.normalize (); url.normalise ()

Returns a new ReUrl object by normalizing `url`. 
This interprets a.o. `.` and `..` segments within the path and removes default ports
and trivial usernames/ passwords from the authority of `url`. 

	new ReUrl ('http://foo/bar/baz/./../bee') .normalize () .toString ()
	// => 'http://foo/bar/bee'
	

#### url.force (base)

Forcibly convert an URL to a base URL. 
The coercion follows the behavior that is specified in the WhatWG URL Standard. 

- In `file` URLs without hostname, the hostname will be set to `''`. 
- For URLs that have a scheme being one of `http`, `https`, `ws`, `wss`,
`ftp` or `gopher` and an absent or empty authority, the authority component
will be 'stolen from the first nonempty path segment'. For example,
calling `force` on any of the following URLs, will result in `http://foo/bar`. 

  - `http:foo/bar`
  - `http:/foo/bar`
  - `http://foo/bar`
  - `http:///foo/bar`

- Other URLs remain unaffected. 


#### url.resolve (base)

Equivalent to `new ReUrl (base) .goto (url) .normalize ()`


#### url.forceResolve (base)

This implements coercion according to the WhatWG URL standard. 
Equivalent to `new ReUrl (base) .force () .goto (url) .force () .normalize ()`



License
-------

MIT. 

Enjoy!
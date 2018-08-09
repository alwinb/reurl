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
The key operations on URLs are a lot like merging / zipping ordered lists. 


API
---

The library exposes a single constructor, `ReUrl`. 
All methods on `ReUrl` objects are immutable. 

In the documentation below:

- An **URL** is the abstract, mathematical entity;
  a sequence of tokens as described above. 
- An **URL-string**, is a string representation of an URL. 
- A **ReUrl object**, is a javascript ReUrl object representation of an URL. 


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


### Adding and modifying URL components

To add to or change the values of URL components, 
use the following methods.  
The methods do not mutate `url` but return new ReUrl objects insted. 

- url.withScheme (scheme)
- url.withCredentials (username [, password])
- url.withHost (host [,port]) // alias withAuthority
- url.withAuthority (host [,port])
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
The methods do not mutate `url` but return new ReUrl objects insted. 

- url.dropScheme ()
- url.dropCredentials ()
- url.dropAuthority () // alias dropHost
- url.dropHost ()
- url.dropPort ()
- url.dropDrive ()
- url.dropRoot ()
- url.dropFile ()
- url.dropQuery ()
- url.dropFragment ()

url.dropRoot () throws a TypeError if dropping the root token
would result in a malformed URL. 


### Operations on URLs

- goto (other)
- normalize ()
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
or `null` if the URL has no authority or no credentials. 

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
Note that (file) URLs may have a drive, but no root. 

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

	new ReUrl ('/c:/foo/bar', null).drive
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
If `other` is a string, it will be internally converted to a ReUrl object,
using the scheme of `url` as a parser setting. 

	new ReUrl ('/foo/bar') .goto ('baz/index.html') .toString ()
	// => '/foo/baz/index.html'

	new ReUrl ('/foo/bar') .goto ('//host/path') .toString ()
	// => '//host/path'

	new ReUrl ('http://foo/bar/baz/') .goto ('./../bee') .toString ()
	// => 'http://foo/bar/baz/./../bee'


#### url.normalize (); url.normalise ()

Returns a new ReUrl object by normalizing `url`. 
This interprets a.o. `.` and `..` segments within the path ans removes default ports
and trivial usernames/ passwords from the authority of `url`. 

	new ReUrl ('http://foo/bar/baz/./../bee') .normalize () .toString ()
	// => 'http://foo/bar/bee'
	

#### url.force (base)

Forcibly convert an URL to a base URL. 
The coercion follows the behaviour that is specified in the WhatWG URL Standard. 

- In `file` URLs without hostname, the hostname will be set to ''
- For URLs that have a scheme being one of `http`, `https`, `ws`, `wss`,
`ftp` or `gopher` and an absent or empty authority, the authority component
will be 'stolen from the first nonempty path segement'. For example,
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
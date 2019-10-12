# Re-URL

[![NPM version][npm-image]][npm-url]

An URL parser and manipulation library. 

* Small code base. 
* Immutable URL objects. 
* Support for relative URLs. 
* Support for non-normalized URLs. 
* Access to the 'parse tree' of URLs (a list of URL tokens). 
* Goto, Normalize and Resolve operations. 
* Support for Windows drive letters (configurable). 
* Support for Backslash separators (configurable). 
* [WhatWG URL][1] compliant coercion to base URLs. 

[1]: https://url.spec.whatwg.org/
[npm-image]: https://img.shields.io/npm/v/reurl.svg
[npm-url]: https://npmjs.org/package/reurl


## Theory

The library is based on a simple theory of URLs, as follows. 


### URLs

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


### Operations

By the definition above, URLs are a special case of ordered lists, where 
the ordering reflects the hierarchical structure of the URL. 
This makes it relatively easy to define and implement the key operations on URLs, as follows:

* The **type** of an URL (type _url_) is defined to be:
  - **fragment** if _url_ is the empty URL.
  - The type of its first token otherwise. 

* The **type-limited prefix** (_url1_ upto _t_) is defined to be
  - the _shortest_ prefix of _url1_ that contains
    - all tokens of _url1_ with a type strictly smaller than _t_ and
    - all **directory** tokens with a type weakly smaller than _t_. 

* The **goto** operation (_url1_ goto _url2_) is defined to return:
  - the _shortest_ URL that has _url1_ upto (type _url2_) as a prefix and _url2_ as a postfix. 

* The **_nonstrict_ goto** operation (_url1_ goto' _url2_) is defined to be (_url1_ goto _url2'_) where
  - _url2'_ is _url2_ with the **scheme** token removed if it equals the **scheme** token of _url1_, or _url2_ otherwise. 


### Properties

Some properties:

- type (url1 goto url2) is the least type of {type url1, type url2}. 
- (url1 goto url2) goto url3 = url1 goto (url2 goto url3). 
- empty goto url2 = url2. 
- url1 goto empty = url1 is **not** true in general (the fragment is dropped). 
- similar for goto'. 
- url2 is a postfix of (url1 goto url2) but not necessarily of (url1 goto' url2).



## API

The library exposes a single `Url` class. 


### Constructors

Create new Url objects by parsing an URL-string with an optional parser configuration,
or by aliasing an existing object. Here `conf` is a string (a base scheme), or a function from 
a string (scheme) or null (schemeless) to an object `{ drive:boolean, backslashes:boolean }`. 

- new Url (string \[, conf])
- new Url (reurl)


### Conversions

To convert a Url object `url` to a string, use the following. 

- url.toString ()
- url.valueOf ()
- url.toJSON ()
- url.href // getter

To iterate over the tokens of an url, use `url.tokens`, equivalently, `url[Symbol.iterator]`
- [url.\[Symbol.iterator\]](#urltokens--#url-symboliterator)
- [url.tokens ()](#urltokens--#urlsymboliterator)


### Getters

A Url object `url` has the following getters that return the corresponding
constituents as strings, or `null` if they are not present. (See below for details). 

- [url.scheme](#urlscheme)
- [url.user](#urluser)
- [url.pass](#urlpass)
- [url.host](#urlhost)
- [url.port](#urlport)
- [url.root](#urlroot)
- [url.drive](#urldrive)
- [url.file](#urlfile)
- [url.query](#urlquery)
- [url.hash](#urlhash)


### Adding, removing and modifying URL components

To add to or change the values of URL components, 
use the `set (dict)` method, where `dict` is a patch object with component values to be changed. 
Returns a new Url object with updated values. 

The `dict` obect may contain the following keys. 

- scheme, if present, must be `null` or a valid scheme string (without the trailing colon). 
- user, if present must be `null` or a string
- pass, if present must be `null` or a string. 
- host, if present must be `null` or a string. 
- port, if present, must be `null`, a valid port number, or a valid port string. 
- drive, if present, must be `null` or a valid drive letter string. 
- root
- file, if present, muse be `null`, or a non-empty string value
- query, if present, must be `null` or a string
- hash, if present must be `null`, or a string

To remove a component, you can set its value to `null`. 

- Setting a new username also updates the password, defaulting to `null` if no password value is supplied. 
- Setting a hostname also update username, password, and port, defaulting to `null` if no values for them are supplied. 
- Setting the scheme, port, drive, or file to an invalid value throws a TypeError. 


### Operations on URLs

- goto (other) // aka. join
- normalize () // aka. normalise
- force ()


### Full description

#### url.scheme

A getter that returns the scheme of `url` as a string,
or `null` if no scheme part is present (e.g. in relative URLs). 

```javascript
new Url ('http://foo?search#baz').scheme
// => 'http'
```

```javascript
new Url ('/abc/?').scheme
// => null
```

#### url.user

A getter that returns the username of `url` as a string,
or `null` if the URL has no authority or credentials. 

```javascript
new Url ('http://joe@localhost').user
// => 'joe'
```

```javascript
new Url ('//host/abc').user
// => null
```

#### url.pass

A getter that returns the password of `url` as a string,
or `null` if the URL has no authority, credentials or password. 

```javascript
new Url ('http://joe@localhost').pass
// => null
```

```javascript
new Url ('http://host').pass
// => null
```

```javascript
new Url ('http://joe:pass@localhost').pass
// => 'pass'
```

```javascript
new Url ('http://joe:@localhost').pass
// => ''
```

#### url.host

A getter that returns the hostname of `url` as a string,
or `null` if no authority is present. 

```javascript
new Url ('http://localhost').host
// => 'localhost'
```

```javascript
new Url ('http:foo').host
// => null
```

```javascript
new Url ('/foo').host
// => null
```

#### url.port

A getter that returns the port of `url`,
or `null` if no authority or port are present. 

```javascript
new Url ('http://localhost:8080').port
// => 8080
```

```javascript
new Url ('foo://host:/foo').port
// => ''
```

```javascript
new Url ('foo://host/foo').port
// => null
```

#### url.root

A getter that returns a string `'/'` if `url` has an absolute path
or `null` otherwise.  
It is possible for file URLs to have a drive, but not a root. 

```javascript
new Url ('foo://localhost?q').root
// => null
```

```javascript
new Url ('foo://localhost/').root
// => '/'
```

```javascript
new Url ('foo/bar').root
// => null
```

```javascript
new Url ('/foo/bar').root
// => '/'
```

```javascript
new Url ('file://c:').root
// => null
```

```javascript
new Url ('file://c:/').root
// => '/'
```

#### url.drive

A getter that returns the drive of `url` as a string
or `null` if no drive is present.  
Note that the presence of drives
depends on the parser settings and/ or URL scheme. 

```javascript
new Url ('file://c:').drive
// => 'c:'
```

```javascript
new Url ('http://c:').drive
// => null
```

```javascript
new Url ('/c:/foo/bar', 'file').drive
// => 'c:'
```

```javascript
new Url ('/c:/foo/bar').drive
// => null
```

#### url.query

A getter that returns the query part of `url` as a string,
or `null` if no such part is present. 

```javascript
new Url ('http://foo?search#baz').query
// => 'search'
```

```javascript
new Url ('/abc/?').query
// => ''
```

```javascript
new Url ('/abc/').query
// => null
```

#### url.hash

A getter that returns the hash part of `url` as a string, 
or `null` if no such part is present. 

```javascript
new Url ('http://foo#baz').hash
// => 'baz'
```

```javascript
new Url ('/abc/#').hash
// => ''
```

```javascript
new Url ('/abc/').hash
// => null
```

#### url.toString (); url.toJSON (); url.valueOf (); url.href

Converts a Url object to an URL-string. 


#### url.tokens (); url [Symbol.iterator]

Returns a token iterator for the url, modeling the sequence of URL tokens as described in the Theory section above. 
(Note, the actual format of the tokens returned is still in flux.)

```javascript
[... new Url ('http://example.com/foo/bar/baz?q#h') .tokens ()]
// => 
// [ [ 'scheme', 'http' ],
//   [ 'authority', { user: null, pass: null, host: 'example.com', port: null } ],
//   [ 'root', '/' ],
//   [ 'directory', 'foo' ],
//   [ 'directory', 'bar' ],
//   [ 'file', 'baz' ],
//   [ 'query', 'q' ],
//   [ 'hash', 'h' ] ]
```

#### url.goto (other)

Returns a new Url object by 'refining' `url` with `other`, 
where other may be a string or a Url object. 
If `other` is a string, it will be parsed with the parser configuration
of `url`. If `other` is a Url object then its configuration will
be passed along to the newly returned url. 

```javascript
new Url ('/foo/bar') .goto ('baz/index.html') .toString ()
// => '/foo/baz/index.html'
```

```javascript
new Url ('/foo/bar') .goto ('//host/path') .toString ()
// => '//host/path'
```

```javascript
new Url ('http://foo/bar/baz/') .goto ('./../bee') .toString ()
// => 'http://foo/bar/baz/./../bee'
```

#### url.normalize (); url.normalise ()

Returns a new Url object by normalizing `url`. 
This interprets a.o. `.` and `..` segments within the path and removes default ports
and trivial usernames/ passwords from the authority of `url`. 

```javascript
new Url ('http://foo/bar/baz/./../bee') .normalize () .toString ()
// => 'http://foo/bar/bee'
```


#### url.force (base)

Forcibly convert an URL to a base URL according to the WhatWG URL standard.  

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


## License

MIT. 

Enjoy!

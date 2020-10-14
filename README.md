# ReURL

[![NPM version][npm-image]][npm-url]

_ReUrl_ is a library for parsing and manipulating URLs. It supports relative- and non-normalized URLs and a number of operations on them. It can be used to parse, resolve, normalize and serialze URLs in separate phases and in such a way that it conforms to the [WhatWG URL Standard][1]. 

[1]: https://url.spec.whatwg.org/
[npm-image]: https://img.shields.io/npm/v/reurl.svg
[npm-url]: https://npmjs.org/package/reurl

## Motivation
<details><summary> Motivation </summary>

I wrote this library because I needed a library that supported non-normalized and relative URLs but I also wanted to be certain that it followed the specification completely. 

The [WhatWG URL Standard][1] defines URLs in terms of a parser algorithm that resolves URLs, normalizes URLs and serializes URL components in one pass. Thus to implement a library that follows the standard, but also supports more versatile set of operations on relative, and non-normalized URLs, I had to disentangle these phases from the specification and to some extent rephrase the specification in more elementary terms. 

Eventually I came up with a small 'theory' of URLs that I found very helpful and I based the library on that. 
</details>

## Theory of URLs

<details><summary>Theory of URLs</summary>

### URLs

An **URL** is a sequence of tokens where tokens are tuples (_type_, _value_), where

  - _type_ is taken from the set { **scheme**, **authority**, **drive**, **root**, **directory**, **file**, **query**, **fragment** } and
  - if _type_ is **authority** then value is an **Authority**, otherwise value is a string.

URLs are subject to the following structural constraints:

  - URLs contain at most one token per type, except for **directory**-tokens (of which they may have any amount),
  - tokens are ordered by type according to **scheme** < **authority** < **drive** < **root** < **directory** < **file** < **query** < **fragment** and
  - if an URL has an **authority** or a **drive** token, and it has a **directory** or a **file** token, then it also has a **root** token. 

An **Authority** is a named tuple (_username_, _password_, _hostname_, _port_) where

  - _hostname_ is an ipv6-address, an opaque-host-string, an ipv4-address, a domain (-string) or the empty string. 
  - _username_ and _password_ are either null or a string,
  - port is either null or an integer in the range 0 to 2<sup>16</sup>–1. 

Authorities are subject to the following constraints:

  - if _password_ is a string, then _username_ is a string.  
  - if _hostname_ is the empty string, then _port_, _username_ and _password_ are null. 


### File URLs

There are two additional constraints that set file URLs apart form non-file URLs. 

- If an URL has a **scheme** token whose value _is not_ `file` then it must not have a **drive** token. 
- If an URL has a **scheme** token whose value _is_ `file` and it has an **authority** token then *password*, *username* and *port* must be null. 


### Operations on URLs

By the definition above, URLs are a special case of ordered lists, where 
the ordering reflects the hierarchical structure of the URL. 
This makes it relatively easy to define and implement the key operations on URLs, as follows:

* The **order** of an URL (ord _url_) is defined to be:
  - **fragment** if _url_ is the empty URL.
  - The type of its first token otherwise. 

* The **order-limited prefix** (_url1_ upto _t_) is defined to be
  - the _shortest_ prefix of _url1_ that contains
    - all tokens of _url1_ with a type strictly smaller than _t_ and
    - all **directory** tokens with a type weakly smaller than _t_. 

* The **goto** operation (_url1_ goto _url2_) is defined to return:
  - the _shortest_ URL that has _url1_ upto (ord _url2_) as a prefix and _url2_ as a postfix. 

* The **_nonstrict_ goto** operation (_url1_ goto' _url2_) is defined to be (_url1_ goto _url2'_) where
  - _url2'_ is _url2_ with the **scheme** token removed if it equals the **scheme** token of _url1_, or _url2_ otherwise. 


### Properties

Some properties of URLs and their operations:

- ord (url1 goto url2) is the least type of {ord url1, ord url2}. 
- (url1 goto url2) goto url3 = url1 goto (url2 goto url3). 
- empty goto url2 = url2. 
- url1 goto empty = url1 is **not** true in general (the fragment is dropped). 
- similar for goto'. 
- url2 is a postfix of (url1 goto url2) but not necessarily of (url1 goto' url2).
</details>

## API

### Constructors

The ReUrl library exposes an Url class. Url objects are immutable. Changes to the fields are ignored and methods return new objects. 

In addition it exposes a RawUrl class with an identical API. The only difference is that Url objects _decode_ percent escape sequences whereas RawUrl objects _preserve_ them. 


<details><summary>new Url (string \[, conf])</summary>

Construct a new Url object from an URL-string. The optional _conf_ argument, if present must be a configuration object as described below. 

```javascript
var url = new Url ('sc:/foo/bar')
console.log ([...url.tokens ()])
// => [ ['scheme', 'sc'], ['root', '/'], ['dir', 'foo'], ['file', 'bar'] ]
```
</details>
<details><summary>new Url (object \[, conf])</summary>

Construct a new Url object from any object, possibly an Url object itself. The optional conf argument, if present, must be a configuration object as described below. 
Throws an error if the object cannot be coerced into a valid URL. 

```javascript
var url = new Url ({ scheme:'file', dirs:['foo', 'buzz'], file:'abc' })
console.log (url.toString ())
// => 'file:foo/buzz/abc'
```
</details>
<details><summary>conf.parser</summary>

You can pass a configuration object with a **parser** property to the Url constructor to trigger scheme-specific parsing behaviour for relative, scheme-less URL-strings. 

The scheme determines support for windows drive-letters and backslash separators.
Drive-letters are only supported in `file` URL-strings, and backslash separators are limited to `file`, `http`, `https`, `ws`, `wss` and `ftp` URL-strings. 

```javascript
var url = new Url ('/c:/foo\\bar', { parser:'file' })
console.log ([...url.tokens ()])
// => [ ['drive', 'c:'], ['root', '/'], ['dir', 'foo'], ['file', 'bar'] ]
```
```javascript
var url = new Url ('/c:/foo\\bar', { parser:'http' })
console.log ([...url.tokens ()])
// => [ ['root', '/'], ['dir', 'c:'], ['dir', 'foo'], ['file', 'bar'] ]
```
```javascript
var url = new Url ('/c:/foo\\bar')
console.log ([...url.tokens ()])
// => [ ['root', '/'], ['dir', 'c:'], ['file', 'foo\\bar'] ]
```
</details>

### PercentCoding

<details><summary>Url</summary>

For Url objects the URL parser **decodes** percent-escape-sequences, getters report percent-decoded values and the _set_ method assumes that its input is percent-decoded unless explicitly specified otherwise. 

```javascript
var url = new Url ('//host/%61bc')
url.file // => 'abc'
url = url.set ({ query:'%def' })
url.query // => '%def'
url.toString () // => '//host/abc?%25def'
```

</details>
<details><summary>RawUrl</summary>

For RawUrl objects the parser **preserves** percent-escape-sequences, getters report values with percent-escape-sequenes preserved and _set_ expects values in which % signs start a percent-escape sequence. 

```javascript
var url = new RawUrl ('//host/%61bc')
url.file // => '%61bc'
url = url.set ({ query:'%25%64ef' })
url.query // => '%25%64ef'
url.toString () // => '//host/%61bc?%25%64ef'
```
</details>

### Conversions

<details><summary>url.toString ()</summary>

Converts an Url object to a string. Percent encodes only a minimal set of codepoints. The resulting string may contain non-ASCII codepoints. 

```javascript
var url = new Url ('http://🌿🌿🌿/{braces}/hʌɪ')
url.toString ()
// => 'http://🌿🌿🌿/%7Bbraces%7D/hʌɪ'
```

</details>
<details><summary>url.toASCII (), url.toJSON (), url.href</summary>

Converts an Url object to a string that only contains ASCII code points.  Non-ASCII codepoints in components will be percent encoded and/ or punycoded. 

```javascript
var url = new Url ('http://🌿🌿🌿/{braces}/hʌɪ')
url.toASCII ()
// => 'http://xn--8h8haa/%7Bbraces%7D/h%CA%8C%C9%AA'
```
</details>
<details><summary>url.tokens ()</summary>

Returns a token iterator for the Url, modeling the sequence of URL tokens as described in the [theory](#theory) section above. 

```javascript
[...new Url ('http://example.com/foo/bar/baz?q#h') .tokens ()]
// => 
// [ [ 'scheme', 'http' ],
//   [ 'auth', { user: null, pass: null, host: 'example.com', port: null } ],
//   [ 'root', '/' ],
//   [ 'dir', 'foo' ],
//   [ 'dir', 'bar' ],
//   [ 'file', 'baz' ],
//   [ 'query', 'q' ],
//   [ 'hash', 'h' ] ]
```
</details>


### Getters

<details><summary>url.scheme</summary>

A getter that returns the scheme of `url` as a string,
or `null` if no scheme part is present (e.g. in relative URLs) . 

```javascript
new Url ('http://foo?search#baz') .scheme
// => 'http'
```

```javascript
new Url ('/abc/?') .scheme
// => null
```
</details>
<details><summary>url.user</summary>

A getter that returns the username of `url` as a string,
or `null` if the URL has no authority or credentials. 

```javascript
new Url ('http://joe@localhost') .user
// => 'joe'
```

```javascript
new Url ('//host/abc') .user
// => null
```
</details>
<details><summary>url.pass</summary>

A getter that returns the password of `url` as a string,
or `null` if the URL has no authority, credentials or password. 

```javascript
new Url ('http://joe@localhost') .pass
// => null
```

```javascript
new Url ('http://host') .pass
// => null
```

```javascript
new Url ('http://joe:pass@localhost') .pass
// => 'pass'
```

```javascript
new Url ('http://joe:@localhost') .pass
// => ''
```
</details>
<details><summary>url.host</summary>

A getter that returns the hostname of `url` as a string,
or `null` if no authority is present. 

```javascript
new Url ('http://localhost') .host
// => 'localhost'
```

```javascript
new Url ('http:foo') .host
// => null
```

```javascript
new Url ('/foo') .host
// => null
```
</details>
<details><summary>url.port</summary>

A getter that returns the port of `url`,
or `null` if no authority or port are present. 

```javascript
new Url ('http://localhost:8080') .port
// => 8080
```

```javascript
new Url ('foo://host:/foo') .port
// => ''
```

```javascript
new Url ('foo://host/foo') .port
// => null
```
</details>
<details><summary>url.root</summary>

A getter that returns a string `'/'` if `url` has an absolute path
or `null` otherwise.  
It is possible for file URLs to have a drive, but not a root. 

```javascript
new Url ('foo://localhost?q') .root
// => null
```

```javascript
new Url ('foo://localhost/') .root
// => '/'
```

```javascript
new Url ('foo/bar') .root
// => null
```

```javascript
new Url ('/foo/bar') .root
// => '/'
```

```javascript
new Url ('file://c:') .root
// => null
```

```javascript
new Url ('file://c:/') .root
// => '/'
```
</details>
<details><summary>url.drive</summary>

A getter that returns the drive of `url` as a string
or `null` if no drive is present.  
Note that the presence of drives
depends on the parser settings and/ or URL scheme. 

```javascript
new Url ('file://c:') .drive
// => 'c:'
```

```javascript
new Url ('http://c:') .drive
// => null
```

```javascript
new Url ('/c:/foo/bar', 'file') .drive
// => 'c:'
```

```javascript
new Url ('/c:/foo/bar') .drive
// => null
```
</details>
<details><summary>url.dirs</summary>

TODO

</details>
<details><summary>url.file</summary>

TODO

</details>
<details><summary>url.query</summary>

A getter that returns the query part of `url` as a string,
or `null` if no such part is present. 

```javascript
new Url ('http://foo?search#baz') .query
// => 'search'
```

```javascript
new Url ('/abc/?') .query
// => ''
```

```javascript
new Url ('/abc/') .query
// => null
```
</details>
<details><summary>url.hash</summary>

A getter that returns the hash part of `url` as a string, 
or `null` if no such part is present. 

```javascript
new Url ('http://foo#baz') .hash
// => 'baz'
```

```javascript
new Url ('/abc/#') .hash
// => ''
```

```javascript
new Url ('/abc/') .hash
// => null
```
</details>


### Setters

<details><summary>url.set (patch)</summary>

Url objects are immutable, therefore setting and removing components is achieved via a _set_ method that takes a _patch_ object. 

The _patch_ object may contain one or more keys being 
**scheme**, **user**, **pass**, **host**, **port**, **drive**, **root**, **dirs**, **file**, **query** and/ or **hash**. To remove a component you can set its value to null.

If present;
– **port** must be `null`, a string, or a number
– **dirs** must be an array of strings
– **root** may be anything and is converted to `'/'` if truth-y and to `null` otherwise
– all others must be `null` or a string. 

```javascript
new Url ('//host/dir/file')
  .set ({ host:null, query:'q', hash:'h' })
  .toString ()
// => '/dir/file?q#h'
```

##### Additional resets

For security reasons, setting the **user** will reset **pass** to `null` unless a value is supplied for it as well. 
Setting the **host** will reset **user**, **pass** and **port** to `null` unless values are supplied for them as well. 

```javascript
new Url ('http://joe:secret@example.com')
  .set ({ user:'jane' })
  .toString ()
// => 'http://jane@example.com'
```
```javascript
new Url ('http://joe:secret@localhost:8080')
  .set ({ host:'example.com' })
  .toString ()
// => 'http://example.com'
```


</details>
<details><summary>patch.percentCoded</summary>

The _patch_ may have an additional key **percentCoded** with a boolean value to indicate that strings in the patch contain percent encode sequences.

This means that you can pass percent-_encoded_ values to Url.set by explicity setting **percentCoded** to true. The values will then be decoded. 

```javascript
var url = new Url ('//host/')
url = url.set ({ file:'%61bc-%25-sign', percentCoded:true })
url.file // => 'abc-%-sign'
log (url.toString ()) // => '//host/abc-%25-sign'
```

You can pass percent-_decoded_ values to RawUrl.set by explicitly setting **percentCoded** to false. Percent characters in values will then be encoded; specifically, they will be replaced with `%25`. 

```javascript
var rawUrl = new RawUrl ('//host/')
rawUrl = rawUrl.set ({ file:'abc-%-sign', percentCoded:false })
rawUrl.file // => 'abc-%25-sign'
rawUrl.toString () // => '//host/abc-%25-sign'
```

**Note** that if no percentCoded value is specified, then Url.set assumes percentCoded to be _false_ whilst RawUrl.set assumes percentCoded to be _true_. 

```javascript
var url = new Url ('//host/') .set ({ file:'%61bc' })
url.file // => '%61bc'
url.toString () // => '//host/%2561bc'
```
```javascript
var rawUrl = new RawUrl ('//host/') .set ({ file:'%61bc' })
url.file // => '%61bc'
rawUrl.toString () // => '//host/%61bc'
```

</details>


### Operations on URLs

<details><summary>url.goto (url2)</summary>

Returns a new Url object by 'extending' `url` with `url2`, where url2 may be a string or an Url object. 

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

If `other` is a string, it will be parsed with the scheme of `url` as a fallback scheme. TODO if the scheme is null, use the conf of `url`. 

```javascript
new Url ('file://host/dir/') .goto ('/c:/dir2/') .toString ()
// => 'file://host/c:/dir2/'
```

</details>
<details><summary>url.resolve (baseUrl)</summary>

Resolve an Url object `url` against a baseUrl. This is similar to
`baseUrl.goto (url)` but in addition it throws an error if it would not result in a base URL, being an URL that has at least a scheme and an authority. 
</details>
<details><summary>url.normalize (), url.normalise ()</summary>

Returns a new Url object by normalizing `url`. 
This interprets a.o. `.` and `..` segments within the path and removes default ports and trivial usernames/ passwords from the authority of `url`. 

```javascript
new Url ('http://foo/bar/baz/./../bee') .normalize () .toString ()
// => 'http://foo/bar/bee'
```
</details>
<details><summary>url.force ()</summary>

Forcibly convert an Url to a base URL according to the WhatWG URL standard. 

- In `file` URLs without hostname, the hostname will be set to `''`. 
- For URLs that have a scheme being one of `http`, `https`, `ws`, `wss` or `ftp` and an absent or empty authority, the authority component will be 'stolen from the first nonempty path segment'. 
- An error is thrown if the Url cannot be forced. This happens if it has no scheme, or if it has an empty host and no non-empty path segment. 

```javascript
new Url ('http:foo/bar') .force () .toString ()
// => 'http://foo/bar'
```
```javascript
new Url ('http:/foo/bar') .force () .toString ()
// => 'http://foo/bar'
```
```javascript
new Url ('http://foo/bar') .force () .toString ()
// => 'http://foo/bar'
```
```javascript
new Url ('http:///foo/bar') .force () .toString ()
// => 'http://foo/bar'
```
</details>

## License

MIT. 

Enjoy!

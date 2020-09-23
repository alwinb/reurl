# URL Strings

This is a very preliminary attempt to formalise the parser/grammar that I use in the library. This is based on notes that I made while working on it. It is incomplete and there may be mistakes, but it **should** be in agreement with the WhatWG URL Standard. 

## Base Grammar

This is a very forgiving grammar for URLs that serves as a starting point. Additional rules and operations on the parse tree will be added later. 

Using the square bracket notation [ rule ] **for optional rules**, a postfix star (*) for repetition, an infix pipe (|) for alternatives and monospaced type for literal strings, the following defines a base grammar for URLs.

* url := [ scheme`:` ] [ `//`auth-string ] [ root ] [ dir`/` ]* [ file ] [ `?`query ] [ `#`hash ]

where

* scheme := alpha (alpha | digit | dotsign)\*
* auth-string := nonsep*
* root := `/`
* dir := nonsep*
* file := nonsep+
* query := nonhash*
* hash := any*

based on the following character sets:

* alpha := {`a`…`z`. `A`…`Z`}
* digit := {`0`…`9`}
* dotsign := { `.`, `+`, `-` }
* nonsep := not {`/`, `#`, `?`}
* nonhash := not {`#`}
* any := not { } &nbsp; – i.e. any character. 

Note that the rules are defined in such a way that there are no ambiguous occurences of  `:` `/` `?` or `#`. 


## Special URLs

In certain contexts, backslashes (`\`) have come to be interpreted as forward slashes (`/`). The WhatWG has standardised this behaviour for URLs with a scheme in the set {`http`, `https`, `ws`, `wss`, `ftp`, `file`}. 

A concise way to define this behaviour is by using a parser that splits the scheme from the rest of the url, and to then use a separate parser for the rest, i.e. for parsing schemeless URLs. 

* scheme-rest := [ scheme `:`] rest
* rest := any*

The scheme relative URLs can be parsed in 'strict' mode or in 'special' mode. 
This is done by adding and refining the rules of the base grammar as follows. 

* scheme-relative-url := [ slash slash auth-string ] [ root ] [ dir slash ]* [ file ] [ `?`query ] [ `#`hash ]
* root := slash
* slash := `/` – in strict mode. 
* slash := (`/` | `\`) – in special mode
* nonsep := not {`/`, `#`, `?`} – in strict mode. 
* nonsep := not {`/`, `\`, `#`, `?`} – in special mode

If the scheme is one of `http`, `https`, `ws`, `wss`, `ftp` or `file` then the 'special' mode must be used. For other schemes the 'strict' mode must be used. If no scheme is present then a mode will have to be selected based on the context or it will have to be specified manually. 


## Drive letters

The grammars defined so far have no rules for parsing windows drive letters. 
It is possible to add that, but together with the mode selection, it would complicate the grammar quite a bit. An easier way to express this is via a separate operation on parsed URLs. 

The grammar for drive-letters is:

* drive-letter := alpha (`:` | `|`)

To detect drive letters in a parsed URL _url_, proceed as follows:  
(TODO this requires a formal specification of the parse tree). 

- If _url_ has an auth-string that is a drive-letter,  
then set its drive to the auth-string and unset its auth-string. 
- Otherwise if _url_ has a dir node and its first dir node is a drive-letter  
then set its drive to the first dir, set its root to `/` and remove the first dir node. 
- Otherwise if _url_ has no dir nodes but it does have a file node that is a drive-letter  
then set its drive to its file, and remove its root and file token. 

Drive letter detection must not be applied to URLs that have a scheme that is not `file`. It may be applied to schemeless URLs in contexts where file URLs are expected. 


## Multiple Slashes

Over time, browsers have come to interpret any amount of slashes after a special scheme as the start of the authority component. For example, the following URL Strings would all be parsed as the same URL:

1. `http:foo/bar`
2. `http:/foo/bar`
3. `http://foo/bar`
4. `http:///foo/bar`

The parser defined here however will parse each of them as distinct, as follows. 

1. (**scheme**`http`) (**dir**`foo`) (**file**`bar`)
2. (**scheme**`http`) (**root**`/`) (**dir**`foo`) (**file**`bar`)
3. (**scheme**`http`) (**auth-string**`foo`) (**root**`/`) (**file**`bar`)
4. (**scheme**`http`) (**auth-string**<code></code>) (**root**`/`) (**dir**`foo`) (**file**`bar`)

The browser behaviour can be expressed via an operation on parsed URLs that 'forces the authority'. This operation 'steals' the auth-string (if empty or absent) from the first dir or file node that is a non-empty string. 

(TODO formal description)


## Authorities

The rules so far, have not defined a grammar to parse authorities, but left them intact as auth-strings. 
Authorities can be parsed from an auth-string by using the following grammar. 

* auth := [ creds `@` ] host-string [ `:`port]
* creds := user [ `:`pass ]
* user := userchar*
* pass := nonsep*
* port := portchar*

This uses the following character sets:

* portchar := nonsep \ { `@` }
* userchar := nonsep \ { `:` }

Notes:

- user cannot contain `:` but pass and port can. 
- both user and pass can contain `@` whilst neither host nor port can. 

This is a forgiving Authority grammar. The WhatWG URL standard puts additional constraints on the host and the port. If these constraints are not met, then it expects the parser to return a failure. 

It could be useful to return an URL that is marked as 'failure' instead, for example in the context of authoring tools, to allow a script to 'patch up' the url to remove the errors. 

TODO

- host-string is more complicated: It can contain `:` within square brackets. There are several ways to rephrase the standard, and I have not figured out which one is nicest. 
- Additional constraints on the port -- it must be a number < 2<sup>16</sup>, hosts are much more complex and pretty much require a separate standard.)






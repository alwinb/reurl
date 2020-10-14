# Theory of URLs

## URLs

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

Autorities are subject to the following constraints:

  - if _password_ is a string, then _username_ is a string.  
  - if _hostname_ is the empty string, then _port_, _username_ and _password_ are null. 


## File URLs

There are two additional constraints that set file URLs apart form non-file URLs. 

- If an URL has a **scheme** token whose value _is not_ `file` then it must not have a **drive** token. 
- If an URL has a **scheme** token whose value _is_ `file` and it has an **authority** token then *password*, *username* and *port* must be null. 


## Operations on URLs

By the definition above, URLs are a special case of ordered lists, where 
the ordering reflects the hierarchical structure of the URL. 
This makes it relatively easy to define and implement the key operations on URLs, as follows:

* The **order** of an URL (ord _url_) is defined to be:
  - **fragment** if _url_ is the empty URL.
  - The type of its first token otherwise. 

* The **order-limited prefix** (_url1_ upto _o_) is defined to be
  - the _shortest_ prefix of _url1_ that contains
    - all tokens of _url1_ with a type strictly smaller than _o_ and
    - all **directory** tokens with a type weakly smaller than _o_. 

* The **goto** operation (_url1_ goto _url2_) is defined to return:
  - the _shortest_ URL that has _url1_ upto (ord _url2_) as a prefix and _url2_ as a postfix. 

* The **_nonstrict_ goto** operation (_url1_ goto' _url2_) is defined to be (_url1_ goto _url2'_) where
  - _url2'_ is _url2_ with the **scheme** token removed if it equals the **scheme** token of _url1_, or _url2_ otherwise. 


## Properties

Some properties of URLs and their operations:

- ord (url1 goto url2) is the least type of {ord url1, ord url2}. 
- (url1 goto url2) goto url3 = url1 goto (url2 goto url3). 
- empty goto url2 = url2. 
- url1 goto empty = url1 is **not** true in general (the fragment is dropped). 
- similar for goto'. 
- url2 is a postfix of (url1 goto url2) but not necessarily of (url1 goto' url2).


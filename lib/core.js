"use strict"
const wtf8 = require ('wtf-8')
const log = console.log.bind (console)

// URLs
// ----
// Urls are modeled simply as arrays of tokens where
// Tokens are tuples [type, value]. 
// Token types have a natural order, which will be shown below. 

const TYPE = 0
const VALUE = 1

const SCHEME = 'scheme'
const AUTH   = 'authority'
const DRIVE  = 'drive'
const ROOT   = 'root'
const DIR    = 'directory'
const FILE   = 'file'
const QUERY  = 'query'
const FRAG   = 'fragment'


// Total and partial orders
// ------------------------

const LT = -1
  , EQ = 0
  , GT = 1
  , NC = NaN /* Non-comparable. Be careful; NC !== NC. */

// ### Total order on tokens, based on their type alone
// This is used for in the operations on URLs. 

const _ord = [SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG]

function compareType (t1, t2) {
  const i1 = _ord.indexOf (t1)
  const i2 = _ord.indexOf (t2)
  return i1 < i2 ? LT : i1 > i2 ? GT : EQ
}

// The 'type' of an URL is its first token or FRAG otherwise

function _type (url, _off = 0) {
  return _off < url.length ? url[_off][TYPE] : FRAG
}


// Configuration object
// --------------------

// The configuration 'object', rather is a function,
// scheme => { backslashes:boolan, drive:boolean }

const specialSchemes = 
  { ftp: 21
  , file: null 
  , gopher: 70
  , http: 80
  , https: 443
  , ws: 80
  , wss: 443 }

const _defaultConf = scheme => 
  scheme == null ? { backslashes:true, drive:false } :
  scheme === 'file' ? { backslashes:true, drive:true } :
  scheme in specialSchemes ? { backslashes:true, drive:false } :
  { backslashes:false, drive:false }

// TODO maybe allow 'http' as a conf object, e.g. scheme => string|object
// thus, need a function to patch up the output. 

const makeConf = conf =>
  typeof conf === 'string' ? (scheme => _defaultConf (scheme == null ? conf : scheme)) :
  typeof conf === 'function' ? (scheme => (conf (scheme) || _defaultConf (scheme))) :
  typeof conf === 'object' && conf ? (scheme => conf) :
  _defaultConf


// URL Parser
// ----------

const R_ALPHA = /[A-Za-z]/
  , SCHEME_CONTD = /[A-Za-z0-9+\-.]/
  , R_DRIVE = /^[a-zA-Z][:|]$/
  , R_DOT   = /^(?:\.|%2e)$/i
  , R_DOTS  = /^(?:\.|%2e){2}$/i
  //, HEXCHARS = /[0-9a-fA-F]/

// const C0_SPACE = /[\x00-\x1F\x20]/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]/g

// parse (url_string, conf)
// The `conf` is a configuration _function_
// This is a function that takes a scheme string (without the tailing ':')
// to an object { backslashes:boolean, drive:boolean } 

function parse (input, conf) {
  conf = makeConf (conf)
  input = input.replace (TRIM, '')

  // state
  let { backslashes = true, drive = false } = conf (null) 
  let part = R_ALPHA.test (input [0]) ? SCHEME : FILE
  let buff = ''
  let _auth = true // check for auth (//) or root (/)
  let url = []

  return _parse (input)

  function _parse (input) {
    let p = 0
    while (p < input.length) {
      const c = input [p++]
      const c2 = input [p]

      if (part === FRAG)
        buff += c
    
      else if (c === '#')
        emit (part, buff, FRAG)

      else if (part === QUERY)
        buff += c

      else if (c === '?')
        emit (part, buff, QUERY)

      else if (c === '/' || c === '\\' && backslashes) {
        if (_auth && (c2 === '/' || c2 === '\\' && backslashes)) {
          part = AUTH
          p++
        }
        else if (_auth)
          emit (ROOT, '/', FILE)

        else if (part === FILE || part === SCHEME)
          emit (DIR, buff, FILE)

        else if (part === AUTH) {
          emit (AUTH, buff)
          emit (ROOT, '/', FILE)
        }
        _auth = false
      }
      else if (c === ':' && part === SCHEME) {
        ({ backslashes = true, drive = false } = conf (buff.toLowerCase ()))
        emit (SCHEME, buff, FILE)
        _auth = true
      }
      else if (part === SCHEME && !SCHEME_CONTD.test (c)){
        buff += c
        part = FILE
        _auth = false
      }
      else {
        buff += c
        _auth = false
      }
    }

    part = part === SCHEME ? FILE : part
    emit (part, buff)
    return url
  }


  // emit has addtional logic to detect drives and empty files
  function emit (type, value, _part) {
    if (drive && (type === AUTH || type === DIR || type === FILE) && R_DRIVE.test (value)) {

      if (url.length && url[url.length - 1][TYPE] === ROOT)
        url.pop ()

      if (type === AUTH)
        url.push ([AUTH, parseAuth ('')])

      url.push ([DRIVE, value])

      if (type === DIR)
        url.push ([ROOT, '/'])

      drive = false
    }

    else if (type === AUTH)
      url.push ([type, parseAuth (value)])

    else if (type !== FILE || value.length) {
      // Disable drive detection after a token >= DIR has been emitted
      url.push ([type, value])
      drive = drive && compareType (type, DIR) < 0
    }

    buff = ''
    part = _part
  }

}


// URL Printer
// -----------

// TODO: check all cases in which a reparse might fail.
// e.g. [[ROOT], [DIR, ''], [FILE, 'foo']] and probably others, too

// NB! At the moment, URL percent escapes in token values are neither interpreted, nor inserted,
// and 'escaping' is done just before printing. I'm still thinking about the cleanest way to do this. 
// - The WhatWG adds additional escapes during _parsing_
// - Intuitively, I'd prefer to _interpret_ percent-encoded bytes during parsing instead. 
// - However that would be lossy whilst the WhatWG spec requires that encoding specificities are preserved

const C0_ESC = /[\x00-\x1F\x7F-\xFF]/g
  , HOST_ESC = C0_ESC
  , FRAG_ESC = /[\x00-\x1F\x7F-\xFF "<>`]/g
  , PATH_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}]/g
  , USER_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}/:;=@\[\\\]^|]/g
  , QUERY_ESC = /[\x00-\x20\x7F-\xFF"#<>]/g


// Note: The WhatWG defines that 'cannot-be-base' URLs,
// encode less characters in the path; 
// This is implemented here as a check: cannot-be-base
// is true iff scheme is present and non-special and immediately
// followed by a dir or file token. 
// TODO be careful; it should probably encode / too and \ too if special?

function print (url) {
  let path_esc = PATH_ESC
  return url.map (printToken) .join ('')

  function printToken (token) {
    const v = token [VALUE]
    switch (token [TYPE]) {
      case SCHEME: 
        if (! (v in specialSchemes)) path_esc = C0_ESC
        return v + ':'
      case AUTH: 
        path_esc = PATH_ESC
        return '//' + printAuth (v)
      case DRIVE: 
        path_esc = PATH_ESC
        return '/' + v
      case ROOT: 
        path_esc = PATH_ESC
        return '/'
      case DIR: return _encode (v, path_esc) + '/'
      case FILE: return _encode (v, path_esc)
      case QUERY: return '?' + _encode (v, QUERY_ESC)
      case FRAG: return '#' + _encode (v, FRAG_ESC)
    }
  }
}

function _escapeChar (char) {
  const b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}

function _encode (value, regex) {
  return wtf8.encode (value) .replace (regex, _escapeChar)
}


// Authority parser
// ----------------

// Invariants:
// An authority has credentials :<=> username is non-null
// If it has a password, then username is non-null

const _emptyAuth = { user:null, pass:null, host:'', port:null }

// Parser:
// the last @ is the nameinfo-host separator
// the first : before the nameinfo-host separator is the username-password separator
// the first : after the nameinfo-host separator is the host-port separator

// Thus,
// username cannot contain : but may contain @
// pass may contain both : and @ 
// host cannot contain : nor @
// port cannot contain @

// NB. In the WhatWG Standard, file auths cannot have
// credentials or a port. However, their hostname also cannot
// contain '@' or ':' chars. So it is fine to use the default
// auth parser and implement the check on the parsed auth instead. 

function parseAuth (string) {
  let last_at = -1
  let port_col = -1
  let first_col = -1
  let bracks = false

  for (let i=0, l=string.length; i<l; i++) {
    const c = string [i]
    if (c === '@') {
      last_at = i
      bracks = false
    }
    else if (c === ':') { // FIXME handle brackets correctly
      first_col = first_col < 0 ? i : first_col
      port_col = port_col <= last_at && !bracks ? i : port_col
    }
    else if (c === '[')
      bracks = true
    else if (c === ']')
      bracks = false
  }

  const auth = { host:'' }

  if (last_at >= 0) { // has credentials
    if (0 <= first_col && first_col < last_at) { // has password
      auth.user = string.substring (0, first_col)
      auth.pass = string.substring (first_col + 1, last_at)
    }
    else
      auth.user = string.substring (0, last_at)
  }

  if (port_col > last_at) { // has port
    auth.host = string.substring (last_at + 1, port_col)
    auth.port = string.substr (port_col + 1)
    if (/^[0-9]+$/.test (auth.port)) auth.port = parseInt (auth.port, 10)
  }

  else
    auth.host = string.substr (last_at + 1)

  return auth
}


// Authority printer
// -----------------

function printAuth (auth) {
  const host = _encode (auth.host, HOST_ESC)
  const port = auth.port == null ? '' : ':' + auth.port
  const pass = auth.pass == null ? '' : ':' + _encode (auth.pass, USER_ESC)
  const info = auth.user == null ? '' : _encode (auth.user, USER_ESC) + pass + '@'
  return info + host + port
}


// Operations on URLs
// ------------------

// ### 'Join'
// May be named 'goto' instead

// Take all tokens of url1 with a strictly smaller type than url2,
// all DIR tokens with a weakly smaller type than URL2, concatenate
// with url2. One exception, the nonstrict mode, and also,
// use _cat to insert root tokens where necessary. 

const _low = url => url[0][VALUE].toLowerCase()

function join (as, bs) {
  let ai = 0, bi = 0
  let at = _type (as)
  let bt = _type (bs)
  let c, authOrDrive = false

  // Implements the 'nonstrict' mode according to RFC 3986
  // example: http://foo/bar goto http:bee ==> http://foo/bee

  if (at === SCHEME && at === bt && _low (as) === _low(bs)) {
    bt = _type (bs, ++bi)
    at = _type (as, ++ai)
  }

  while ((c = compareType (at, bt)) < 0 || at === DIR && c <= 0) {
    authOrDrive = at === AUTH || at === DRIVE
    at = _type (as, ++ai)
  }

  return authOrDrive && (bt === DIR || bt === FILE) ?
    [ ...as.slice (0, ai), [ROOT, '/'], ...bs.slice (bi) ] :
    [ ...as.slice (0, ai), ...bs.slice (bi) ]
}



// ### Normalize

function normalize (url) {
  const r = []
  let scheme

  for (let token of url) {
    let [type, value] = token
      , last = r [r.length - 1]

    switch (type) {
      case SCHEME:
        scheme = value.toLowerCase ()
        r.push ([type, scheme])
      break

      case AUTH:
        r.push ([type, normalizeAuth (value, scheme)])
      break

      case DRIVE:
        r.push ([type, value[0] + ':'])
      break

      case DIR:
      case FILE:
        if (R_DOTS.test (value)) {
          if (last == null) r.push ([DIR, '..'])
          else if (last [TYPE] === DIR) {
            if (!R_DOTS.test (last [VALUE])) r.pop ()
            else r.push ([DIR, '..'])
          }
        }
        else if (!R_DOT.test (value))
          r.push (token)
      break

      default:
        r.push (token)
      break
    }
  }
  
  if (scheme in specialSchemes && r[r.length-1] [TYPE] === AUTH)
    r.push ([ROOT, '/'])

  return r
}


function normalizeAuth (auth, scheme) {
  let { user, pass, host, port } = auth

  pass = pass === '' ? null : pass
  user = user === '' && pass == null ? null : user
  host = scheme === 'file' && host === 'localhost' ? '' : host
  port = port != null && /^[0-9]+$/.test (port)
    ? parseInt (port, 10)
    : port == '' ? null
    : port
    
  if (scheme in specialSchemes && port === specialSchemes [scheme])
    port = null

  return { user, pass, host, port }
}


// ### ChangeRoot and RelativeTo

function chroot (as, bs) {
  // TODO: chroot
}


function relto (as, bs) {
  // TODO: relto
}


// ### Steal
// To convert a relative URL to a base URL, one may attemp to 'steal' 
// the authority from the first nonempty path-component (DIR or FILE)

function compare (tok1, tok2) {
  return compareType (tok1 [TYPE], tok2 [TYPE]) ||
  (tok1 [VALUE] === tok2 [VALUE] ? EQ : NC)
}

const lte = (tok1, tok2) => compare (tok1, tok2) <= 0

function steal (as) {
  if (_scheme (as) === null) return as
  const l = as.length
  let i = 0

  while (i<l && lte (as[i], [DIR, ''])) {
    const [t,v] = as [i]
    if (t === AUTH && printAuth (v) !== '') return as // TODO do this more clean?
    if (t === DRIVE) return as
    else i++
  }

  if (i<l) {
    var a  = as [i]
      , bs = as.slice (i + 1)
    if (a [TYPE] === FILE || a [TYPE] === DIR || a [TYPE] === DRIVE)
      bs.unshift ([AUTH, parseAuth (a [VALUE])], [ROOT, '/'])
    else
      bs.unshift (a)
    return join (as, bs)
  }

  return as
}


// Force urls
// ----------
// A base URL, is any url that has a scheme and authority component. 
// The WhatWG specifies a way to try and coerce URLs without authority
// to a base URL by 'stealing' the authority from the first path component. 
// This function only affects URLs with a special scheme. 

function force (url) {
  const scheme = _scheme (url)
  if (scheme == null) return url
  const base = [[SCHEME, scheme], [AUTH, _emptyAuth], [ROOT, '/']]
  return scheme.toLowerCase () === 'file' ? join (base, url) :
    scheme in specialSchemes ? steal (join (base, url)) :
    url
}

// ### Resolve
// resolve `url` against base url `base`. 

function resolve (url, base) {
  return normalize (join (base, url))
}

// forceResolve forcibly coerces `base` before resolving. 

function forceResolve (url, base) {
  return normalize (force (join (force (base), url)))
}

// Util

function _scheme (url) {
  return url.length && url[0][TYPE] === SCHEME ?
    url[0][VALUE] : null
}

function _path (url) {
  const r = url.filter (token => {
    let t = token [TYPE]
    return t === DRIVE || t === ROOT || t === DIR || t === FILE })
  return r.length ? r : null
}

// replace or insert url token by type
// if type is DIR, append instead

function set (url, token) {
  // Yes, I wish to redo this. 
  // But for now it works
  // Ah but not for DIRs
  // and type checks
}


// Url tokenlist datastructure
// ---------------------------
// select/ get/ set on URL sequences
// I'm not sure I like this so much

function cursor (url, i, l, type, value = null) {

  function get (fn) {
    return l ? fn ? fn (value) : value : null
  }

  function prev () {
    if (i > 0) {
      const [t, v] = url [i-1]
      return cursor (url, i-1, 1, t, v) 
    }
    return null
  }

  function next () {
    if (i < url.length-l) {
      const [t, v] = url [i+l]
      return cursor (url, i+l, 1, t, v) 
    }
    return null
  }

  function set (fn) {
    if (!l && fn == null) return url
    const r = url.concat ()
    if (fn != null) r.splice (i, l, [type, typeof fn === 'function' ? fn (value) : fn])
    else r.splice (i, l)
    return r
  }

  return { found:!!l, _i:i, type, value, get, set, prev, next }
}

function select (url, type) {
  let [i, d] = compareType (type, DIR) < 0 ? [0, 1] : [url.length - 1, -1]
  while (url [i]) {
    const [t, value] = url [i]
    const c = compareType (t, type)
    if (c === -d) i += d
    else if (c === 0) return cursor (url, i, 1, type, value)
    else if (d === -1) return cursor (url, i+1, 0, type)
    else return cursor (url, i, 0, type)
  }
  return cursor (url, i, 0, type)
}


// Exports
// -------

module.exports = {

  SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG, // tokens

  _path, _scheme, select, // get/ set/ modify

  specialSchemes, makeConf, // config

  parse, print, join, goto:join, normalize, normalise:normalize, // parse / print / normalize

  auth: { parse: parseAuth, print: printAuth, normalize: normalizeAuth }, // auth functions

  force, steal, resolve, forceResolve // force / resolve

}
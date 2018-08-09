"use strict"
const wtf8 = require ('wtf-8')

const log = console.log.bind (console)
function trace (x) {
  log.apply (this, arguments)
  return x
}

function compose (fn1, fn2, fn3, __) { 
  const fns = arguments
  return function () {
    var x = arguments
    for (let i = fns.length-1; i >= 0; i--)
      x = [fns[i].apply (null, x)]
    return x[0] } }


// URLs
// ----
// Urls are modeled simply as arrays of tokens where
// Tokens are tuples [type, value]. 
// Token types have a natural order, which will be shown below. 

const TYPE = 0
  , VALUE  = 1

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
// (Added private _EOI token type to represent end of input)

const _EOI = null
const _ord = [SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG, _EOI]

function compareType (t1, t2) {
  const i1 = _ord.indexOf (t1)
  const i2 = _ord.indexOf (t2)
  return i1 < i2 ? LT : i1 > i2 ? GT : EQ
}

// ### _Partial_ order tokens, based on their type first and on value,  _equality only_, next. 
// So, tokens with the same type but distinct value are considered non-comparabe (NC). 
// This is useful in the join/ resolution process, which is a lot like zipping ordered lists,
// where it must be specified how to handle non-comparable tokens. 

function compare (tok1, tok2) {
  return compareType (tok1 [TYPE], tok2 [TYPE]) ||
  (tok1 [VALUE] === tok2 [VALUE] ? EQ : NC)
}

function leastType (tok1, tok2) {
  const c = compare (tok1, tok2)
  return c < 0 ? tok1 [TYPE] : tok2 [TYPE]
}

const lt  = (tok1, tok2) => compare (tok1, tok2) < 0
const lte = (tok1, tok2) => compare (tok1, tok2) <= 0
const eq  = (tok1, tok2) => compare (tok1, tok2) === 0
const gte = (tok1, tok2) => compare (tok1, tok2) >= 0
const gt  = (tok1, tok2) => compare (tok1, tok2) > 0

function nc (tok1, tok2)  {
  const n = compare (tok1, tok2)
  return n !== n
}


// URL Parser
// ----------

//const R_SCHEME = !/^[A-Za-z][A-Za-z0-9+\-.]*$/

const R_ALPHA = /[A-Za-z]/
  , HEXCHARS = /[0-9a-fA-F]/
  , SCHEME_CONTD = /[A-Za-z0-9+\-.]/
  , R_DRIVE = /^[a-zA-Z][:|]$/

// Preprocess
// const C0_SPACE = /[\x00-\x1F\x20]/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]/g

function _trim (string) {
  return string.replace (TRIM, '')
}

// parse (url_string, conf)
// The `conf` is a configuration _function_
// This is a function that takes a scheme string (without the tailing ':')
// to an object { convertSlashes:boolean, detectDrive:boolean } 

const specialSchemes = 
  { ftp: 21
  , file: null 
  , gopher: 70
  , http: 80
  , https: 443
  , ws: 80
  , wss: 443 }

function defaultConf (scheme) { 
  return (scheme == null
    ? { convertSlashes:true, detectDrive:false }
    : { convertSlashes: scheme in specialSchemes, detectDrive: scheme === 'file' }) }

function parse (input, conf_) {
  input = _trim (input)

  let conf = typeof conf_ === 'string' ? (_ => defaultConf (_ == null ? conf_ : _))
    : typeof conf_ === 'function' ? conf_
    : defaultConf

  // position and partial result
  let p = 0
    , part = FILE
    , buff = ''
    , scheme
    , r = []

  // machine state
  let { convertSlashes, detectDrive } = conf (scheme) 
    , _scheme = R_ALPHA.test (input [0]) // check for scheme delimiter (:)
    , _auth = true // check for auth (//) or root (/) 
    , _dir = false // check for directory delimiter (/)
    , _q   = true  // check for query delimiter (?)
    , _h   = true  // check for fragment delimiter (#)

  // emit has addtional logic to detect drives and empty files
  function emit (type, value) {
    let last = r.length ? r [r.length - 1] [TYPE] : null
    if (detectDrive && (type === AUTH || type === DIR || type === FILE) && R_DRIVE.test (value)) {
      if (last === ROOT) r.pop ()
      r.push ([last = DRIVE, value])
      if (type === DIR)
        r.push ([last = ROOT, '/'])
    }

    else if (type === AUTH)
      r.push ([last = type, parseAuth (value)])

    else if (type !== FILE || value.length)
      r.push ([last = type, value])

    detectDrive = compareType (DRIVE, last) < 0
    buff = ''
  }

  // parser main loop
  while (p < input.length) {
    let c = input [p++], c2 = input [p]
    c = _h && c === '\\' && convertSlashes ? '/' : c

    // console.log ([c, '|', _scheme?1:' ', _dir?1:' ', _auth?1:' ', part].join(' '))

    if (c === ':' && _scheme) {
      scheme = buff.toLowerCase ()
      emit (SCHEME, buff)
      let x = conf (scheme)
      convertSlashes = x.convertSlashes
      detectDrive = x. detectDrive
      _scheme = _dir = false
      _auth = true
    }

    else if (c === '/' && _auth) {
      if (c2 === '/' || c2 === '\\' && convertSlashes) {
        part = AUTH
        _dir = true
        p++
      }
      else {
        emit (ROOT, '/')
      }
      _scheme = _auth = false
    }

    else if (c === '/' && _dir) { // part is FILE or AUTH
      if (part === AUTH) {
        emit (AUTH, buff)
        emit (ROOT, '/')
        part = FILE
      }
      else
        emit (DIR, buff)
    }

    else if (c === '?' && _q) {
      emit (part, buff)
      part = QUERY
      _auth = _dir = _q = false
    }

    else if (c === '#' && _h) {
      emit (part, buff)
      part = FRAG
      _auth = _dir = _q = _h = false
    }

    else if (c === '\0' && !_h) {
      // this removes null characters from fragment
      // validation error
      // NB. neither Safari nor Firefox do this
    }

    // else if (c === '%') {
    // // disabled, needed only for validation
    // }

    else if (_scheme && !SCHEME_CONTD.test (c)){
      buff += c
      _scheme = _auth = false
    }

    else {
      buff += c
      _auth = false
      _dir = _q
    }
  }

  // finish up and return
  emit (part, buff)
  return r
}

// log (parse ('file://c|', 'file'))


// URL Printer
// -----------

// TODO: check all cases in which a reparse might fail.
// e.g. [ROOT], [DIR, ''], [FILE, 'foo'] and probably others, too

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
// TODO be careful; it should probably encode / too and \ too if special..

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
  var b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}

function _encode (value, regex) {
  return wtf8.encode (value) .replace (regex, _escapeChar)
}


// Authority parser
// ----------------

function Authority () {
  this.user
  this.pass
  this.host = ''
  this.port
}

const _emptyAuth = new Authority ()

// the last @ is the nameinfo-host separator
// the first : before the nameinfo-host separator is the namename-password separator
// the first : after the nameinfo-host separator is the host-port separator

// Thus,
// namename cannot contain : but may contain @
// pass may contain both : and @ 
// host cannot contain : nor @
// port cannot contain @

// An authority has credentials :<=> username is non-null
// If it has a password, then username is non-null

function parseAuth (string) {
  let last_at = -1
  let port_col = -1
  let first_col = -1
  let bracks = false

  for (let i=0, l=string.length; i<l; i++) {
    const c = string [i]
    if (c === '@') // TODO what if in brackets?
      last_at = i
    else if (c === ':' && !bracks) {
      first_col = first_col < 0 ? i : first_col
      port_col = port_col <= last_at ? i : port_col
    }
    else if (c === '[')
      bracks = true
    else if (c === ']')
      bracks = false
  }

  const auth = new Authority ()

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

function join (as, bs) {
  const eoi = [_EOI, null]
  let ai = 0, bi = 0

  while (true) {
    let a = as [ai] || eoi
      , b = bs [bi] || eoi
      , t = leastType (a, b)

    switch (t) {
      case SCHEME: 
        // This is the 'nonstrict' mode according to RFC 3986
        // strict mode would use the default branch. 
        switch (compare (a, b)) {
          case LT: ai++; break
          case EQ: ai++; bi++; break
          default: return _cat (as, ai, bs, bi) }
      break

      case DIR:
        // special case, keep DIR tokens
        if (a [TYPE] === DIR) ai++
        else return _cat (as, ai, bs, bi)
      break

      case FRAG:
        // special case, always drop FRAG from as
        return _cat (as, ai, bs, bi)
      break

      default:
        if (lt (a, b)) ai++
        else return _cat (as, ai, bs, bi)
      break
    }
  }
}

// Helper, to preserve the invariant that URLs that have an (AUTH or DRIVE)
// and a (DIR or FILE) also have a ROOT token.

function _cat (as, ai, bs, bi) {
  as = as.slice (0, ai)
  if (ai && bi < bs.length) {
    let ta = as [ai-1] [TYPE]
    let tb = bs [bi] [TYPE]
    if ((ta === AUTH || ta === DRIVE) && (tb === DIR || tb === FILE))
      as.push ([ROOT, '/'])
  }
  return as.concat (bs.slice (bi))
}


// ### Normalize

const R_DOT   = /^(?:\.|%2e)$/i
    , R_DOTS  = /^(?:\.|%2e){2}$/i

function normalize (url) {
  const r = []
  let scheme

  for (let i = 0; i < url.length; i++) {
    let token = url [i]
      , [type, value] = token
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


// NB. In the WhatWG Standard, file auths cannot have
// credentials or a port. However, their hostname also cannot
// contain '@' or ':' chars. So it is fine to use the default
// auth parser and implement the check on the parsed auth instead. 

function normalizeAuth (auth, scheme) {
  let { name, pass, host, port } = auth

  pass = pass === '' ? null : pass
  name = name === '' && pass == null ? null : name
  host = scheme === 'file' && host === 'localhost' ? '' : host
  port = port != null && /^[0-9]+$/.test (port)
    ? parseInt (port, 10)
    : port == '' ? null
    : port

  if (scheme in specialSchemes && port === specialSchemes [scheme])
    port = null

  return { name, pass, host, port }
}


// ### ChangeRoot and RelativeTo

function chroot (as, bs) {
  // TODO: chroot
}


function relto (as, bs) {
  // TODO: relto
}

//var sample = 
//  { base:'http://example.com'
//  , url:'http://example.com/foo/bar/' }
//
//compose (trace, print, _ => chroot (_.url, _.base), trace)  (sample)


// ### Steal
// To convert a relative URL to a base URL, one may attemp to 'steal' 
// the authority from the first nonempty path-component (DIR or FILE)

function steal (as) {
  if (_scheme (as) === null) return as
  var l = as.length
    , i = 0

  while (i<l && lte (as[i], [DIR, ''])) {
    var a = as [i], t = a [TYPE]
    if (t === AUTH && printAuth (a [VALUE]) !== '') return as // TODO do this more clean?
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

// TODO, what if no scheme is supplied?
function force (url, scheme) {
  scheme = _scheme (url) || scheme
  const base = [[SCHEME, scheme], [AUTH, _emptyAuth], [ROOT, '/']]
  return = scheme.toLowerCase () === 'file' ? join (base, url) :
    scheme in specialSchemes ? steal (join (base, url)) :
    url
}

// ### Resolve
// resolve `url` against base url `base`
// NB. `base` will be forcibly coerced into a base url. 

function resolve (url, base) {
  return normalize (join (force (base), url))
  // TODO... do we want force in there? Don't think so
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


// Exports
// -------

module.exports = 
{ parse
, defaults: defaultConf
, print
, force
, steal
, specialSchemes
, join
, goto: join
, normalize
, normalise: normalize
, resolve
, auth: { parse: parseAuth, print: printAuth, normalize: normalizeAuth }

// getters
, _path
, _scheme

, Authority

// token lists
, SCHEME
, AUTH
, DRIVE
, ROOT
, DIR
, FILE
, QUERY
, FRAG
}

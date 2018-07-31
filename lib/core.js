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

const specialSchemes = 
  { ftp: 21
  , file: null 
  , gopher: 70
  , http: 80
  , https: 443
  , ws: 80
  , wss: 443 }


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
    , i2 = _ord.indexOf (t2)
  return i1 < i2 ? LT : i1 > i2 ? GT : EQ
}

// ### _Partial_ order tokens, based on their type first and on value,  _equality only_, next. 
// So, tokens with the same type but distinct value are considered non-comparabe (NC). 
// This is useful in the join/ resolution process, which is a lot like zipping ordered lists,
// where it must be specified how to handle non-comparable tokens. 

function compare (tok1, tok2) {
  return compareType (tok1 [TYPE], tok2 [TYPE]) ||
    (tok1 [VALUE] === tok2 [VALUE] ? EQ : NC) }

function lt  (tok1, tok2) { return compare (tok1, tok2) < 0 }
function lte (tok1, tok2) { return compare (tok1, tok2) <= 0 }
function eq  (tok1, tok2) { return compare (tok1, tok2) === 0 }
function nc  (tok1, tok2) { const n = compare (tok1, tok2); return n !==n }
function gte (tok1, tok2) { return compare (tok1, tok2) >= 0 }
function gt  (tok1, tok2) { return compare (tok1, tok2) > 0 }

function leastType (tok1, tok2) {
  const c = compare (tok1, tok2)
  return c < 0 ? tok1 [TYPE] : tok2 [TYPE]
}


// Records
// -------
// Alright, so now I have two representations,
// one ideal for 'goto': the ordered lists above,
// and one ideal for get/set: object records. 

// What to do with this? 
// I like the idea of making iterators on records,
// to present them as lists of tokens, and use a record
// backing for the ReUrl object/ API

function _fromRecord (rec) {
  let r = [], authOrDrive = null, root = null
  if (rec.scheme) r.push ([SCHEME, rec.scheme])
  if (rec.authority != null) r.push (authOrDrive = [AUTH, rec.authority])
  if (rec.drive) r.push (authOrDrive = [DRIVE, rec.drive])
  if (rec.root != null) r.push (root = [ROOT, rec.root])
  if (rec.dirs) r = _mut_cat (r, rec.dirs.map (_ => [DIR, _]))
  if (rec.file) r = _mut_cat (r, [[FILE, rec.file]])
  if (rec.query != null) r.push ([QUERY, rec.query])
  if (rec.fragment != null) r.push ([FRAG, rec.fragment])
  return r
}

function _toRecord (as) {
  const r = {}
  as.forEach (token => { 
    if (token [TYPE] === DIR) {
      if (r.dirs) r.dirs.push (token [VALUE])
      else r.dirs = [token [VALUE]]
    }
    else
      r [token [TYPE]] = token [VALUE]
  })
  return r
}

function* tokens (record) {
  let keyIndex = 0
    , dirIndex = 0
    , key
    , authOrDrive = null
    , root = null

  while ((key = _ord [keyIndex]) !== _EOI) switch (key) {
    case AUTH:
      if (record.host != null)
        yield [key, { name:record.name, pass:record.pass, host:record.host, port:record.port }]
      keyIndex ++
      // authOrDrive = true
    break

    case DIR: 
      if (record.dirs != null && dirIndex < record.dirs.length)
        yield [key, record.dirs [dirIndex ++]]
      else keyIndex ++
    break

    default:
      if (record [key] != null)
        yield [key, record [key]]
      keyIndex ++
  }
}


//var sample = { scheme:'http', host:null, query:'searchme', root:null, dirs:['foo', 'bar'], fragment:'haa', file:'ff' }
//setTimeout(_ => compose (log, print, Array.from.bind (Array), tokens) (sample))



// URL Parser
// ----------

const R_ALPHA = /[A-Za-z]/
  , HEXCHARS = /[0-9a-fA-F]/
  , SCHEME_CONTD = /[A-Za-z0-9+\-.]/
  , R_DRIVE = /^[a-zA-Z][:|]$/

// Preprocess
// var C0_SPACE = /[\x00-\x1F\x20]/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]/g

function _trim (string) {
  return string.replace (TRIM, '')
}


// The `slashes` and `drive` 'modes' determine how backslashes are handled
// and whether drives should be parsed. 
// It is one of true, false, null/ undefined, or a string-specified base scheme. 
// - true: always convert '\' to '/'. 
// - false: never convert '\' to '/'. 
// - <scheme>: for schemeless URLs, use the default setting for <scheme>. 
// - default: convert '\' to '/' in schemeless URLs and in 'special scheme' URLs. 

function parse (input, slashes, drive) {
  input = _trim (input)

  let convertSlashes = slashes == null ? true // default to true for relative URLs
    : typeof slashes !== 'boolean' ? slashes in specialSchemes : slashes

  let detectDrive = drive == null ? false // default to false for relative URLs
    : typeof slashes !== 'boolean' ? drive === 'file' : drive

  let _scheme = R_ALPHA.test (input [0]) // check for scheme delimiter (:)
    , _auth = true // check for auth (//) or root (/) 
    , _dir = false // check for directory delimiter (/)
    , _q   = true  // check for query delimiter (?)
    , _h   = true  // check for fragment delimiter (#)

  // position and partial result
  let p = 0
    , part = FILE
    , buff = ''
    , scheme
    , r = []

  // emit has some addtional logic to 
  // to detect drives and remove empty files

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

    detectDrive = compareType (last, DRIVE) > 0
    buff = ''
  }


  while (p < input.length) {
    let c = input [p++], c2 = input [p]
    c = _h && c === '\\' && convertSlashes ? '/' : c

    // console.log ([c, '|', _scheme?1:' ', _dir?1:' ', _auth?1:' ', part].join(' '))

    if (c === ':' && _scheme) {
      scheme = buff.toLowerCase ()
      emit (SCHEME, buff)
      convertSlashes = typeof slashes !== 'boolean' ? scheme in specialSchemes : convertSlashes
      detectDrive = typeof drive !== 'boolean' ? scheme === 'file' : detectDrive
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
      /* validation error - remove null character from fragment. */
    }

    // else if (c === '%') {
    //
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

  emit (part, buff)

  return r
}


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
        return '//' + auth.print (v)
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

  const auth = { name:null, pass:null, host:'', port:null }

  if (last_at >= 0) { // has credentials
    if (0 <= first_col && first_col < last_at) { // has password
      auth.name = string.substring (0, first_col)
      auth.pass = string.substring (first_col + 1, last_at)
    }
    else
      auth.name = string.substring (0, last_at)
  }

  if (port_col > last_at) { // has port
    auth.host = string.substring (last_at + 1, port_col)
    auth.port = string.substr (port_col + 1)
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
  const info = auth.name == null ? '' : _encode (auth.name, USER_ESC) + pass + '@'
  return info + host + port
}

const _emptyAuth = { name: null, pass: null, host: '', port: null }
const auth = { parse:parseAuth, print:printAuth, normalize:normalizeAuth, normalise:normalizeAuth }



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
          default: return _mut_cat (as.slice (0, ai), bs.slice (bi)) }
      break

      case DIR:
        // special case, keep DIR tokens
        if (a [TYPE] === DIR) ai++
        else return _mut_cat (as.slice (0, ai), bs.slice (bi))
      break

      case FRAG:
        // special case, always drop FRAG from as
        return _mut_cat (as.slice (0, ai), bs.slice (bi))
      break

      default:
        if (lt (a, b)) ai++
        else return _mut_cat (as.slice (0, ai), bs.slice (bi))
      break
    }
  }
}

// Helper, to preserve the invariant that URLs that have a (AUTH or DRIVE)
// and a (DIR or FILE) also have a ROOT token.
// May mutate as. 

function _mut_cat (as, bs) {
  if (as.length && bs.length) {
    let ta = as [as.length - 1] [TYPE]
    let tb = bs [0] [TYPE]
    if ((ta === AUTH || ta === DRIVE) && (tb === DIR || tb === FILE))
      as.push ([ROOT, '/'])
  }
  return as.concat (bs)
}


// ### Normalize

const R_DOT   = /^(?:\.|%2e)$/i
    , R_DOTS  = /^(?:\.|%2e){2}$/i


function normalize (url) {
  //log ('normlize', url)
  const r = []
  let scheme

  for (let i = 0; i < url.length; i++) {
    let a = url [i], prev = r [r.length - 1]

    switch (a [TYPE]) {
      case SCHEME:
        scheme = a [VALUE] .toLowerCase ()
        r.push ([SCHEME, scheme])
      break

      case AUTH:
        r.push ([AUTH, normalizeAuth (a [VALUE], scheme)])
      break

      case DRIVE:
        r.push ([DRIVE, a [VALUE][0] + ':'])
      break

      case DIR:
      case FILE:
        if (R_DOTS.test (a [VALUE])) {
          if (prev == null) r.push ([DIR, '..'])
          else if (prev [TYPE] === DIR) {
            if (!R_DOTS.test (prev [VALUE])) r.pop ()
            else r.push ([DIR, '..'])
          }
          // else if (prev [TYPE] === ROOT) r
        }
        else if (!R_DOT.test (a [VALUE]))
          r.push (a)
      break

      default:
        r.push (a)
      break
    }
  }
  
  if (scheme in specialSchemes && r[r.length-1] [TYPE] === AUTH)
    r.push ([ROOT, '/'])

  return r
}


// NB. File Auths, cannot have credentials or ports. However, 
// the WhatWG behaviour is to fail on file hosts that 
// contain '@' or ':' characters, so there is no danger 
// in parsing them with the default auth parser, as long as  
// we check 'on time' (TODO: when?) if they end up having non-null 
// nameinfo or ports, and throwing then.  

function normalizeAuth (auth, scheme) {
  const pass = auth.pass === '' ? null : auth.pass
  const name = auth.name === '' && pass == null ? null : auth.name
  const host = scheme === 'file' && auth.host === 'localhost' ? '' : auth.host
  let port = !auth.port ? null : /^[0-9]+$/.test (auth.port) ? parseInt (auth.port, 10) + '' : auth.port
  port = scheme in specialSchemes && port === specialSchemes [scheme] + '' ? null : port

  const r = { name:name, pass:pass, host:host, port:port }

  return r
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
    if (t === AUTH && auth.print (a [VALUE]) !== '') return as // TODO do this more clean?
    if (t === DRIVE) return as
    else i++
  }

  if (i<l) {
    var a  = as [i]
      , bs = as.slice (i + 1)
    if (a [TYPE] === FILE || a [TYPE] === DIR || a [TYPE] === DRIVE)
      bs.unshift ([AUTH, auth.parse (a [VALUE])], [ROOT, '/'])
    else
      bs.unshift (a)
    return join (as, bs)
  }

  return as
}


// Configurable parser
// -------------------
// `parse (url_string, conf)`
// conf is either a base-scheme, or an object: { convertSlashes?, detectDrive?, baseScheme? }
// convertSlashes: true, false, (other values are ignored)
// detectDrive: true, false, (other values are ignored)
// baseScheme: <string>; set unspecified settings according to the default settings for `baseScheme`

function url (url_string, conf) {
  conf = typeof conf === 'string'
    ? { baseScheme: conf.toLowerCase() }
    : conf == null || typeof conf !== 'object'
    ? { }
    : conf

  const slashes = typeof conf.convertSlashes === 'boolean'
    ? conf.convertSlashes
    : conf.baseScheme

  const drive = typeof conf.detectDrive === 'boolean'
    ? conf.detectDrive
    : conf.baseScheme

  return parse (url_string, slashes, drive)
}


// Base urls
// ---------
// A base URL, is any url that has a scheme and authority component. 
// The WhatWG specifies a way to try and force any URL to a base URL,
// if needed, by 'stealing' the authority from the first path component. 

function force (url) {
  const scheme = _scheme (url)
  const base = [[SCHEME, scheme], [AUTH, _emptyAuth], [ROOT, '/']]
  return scheme === 'file' ? join (base, url) :
    scheme in specialSchemes ? steal (join (base, url)) :
    url
}

// ### Resolve
// resolve `url` against base url `base`
// NB. `base` will be forcibly coerced into a base url. 

function resolve (url, base) {
  return normalize (join (force (base), url))
}


// Util

function _scheme (url) {
  return url.length && url[0][TYPE] === SCHEME ?
    url[0][VALUE] .toLowerCase () :
    null
}


// Exports
// -------

module.exports = 
{ parse: parse
, print: print
, auth: auth // hmmm
, url: url
, force: force
, steal: steal
, specialSchemes: specialSchemes
, join: join
, goto: join
, normalize: normalize
, normalise: normalize
, resolve: resolve
//
, _toRecord: _toRecord
, _fromRecord: _fromRecord
//
, SCHEME: SCHEME
, AUTH: AUTH
, DRIVE: DRIVE
, ROOT: ROOT
, DIR: DIR
, FILE: FILE
, QUERY: QUERY
, FRAG: FRAG
}

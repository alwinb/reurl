"use strict"
const log = console.log.bind (console)
  , percentEncode = require ('./utf')

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

const SCHEME  = 'scheme'
  , AUTH      = 'auth' // 'opaque-auth'
  , DRIVE     = 'drive-letter' // New!
  , ROOT      = 'path-root'
  , DIR       = 'dir'
  , FILE      = 'file'
  , QUERY     = 'query'
  , FRAG      = 'fragment'

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
// This is used extensively by the operations on URLs later. 
// (Added private _EOI token type to represent end of input)

const _EOI = null
const _ord = [SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG, _EOI]

function compareType (tok1, tok2) {
  const i1 = _ord.indexOf (tok1 [TYPE])
    , i2 = _ord.indexOf (tok2 [TYPE])
  return i1 < i2 ? LT : i1 > i2 ? GT : EQ
}


// ### _Partial_ order tokens, based on their type first and on value,  _equality only_, next. 
// So, tokens with the same type but distinct value are considered non-comparabe (NC). 
// This is useful in the join/ resolution process, which is a lot like zipping ordered lists,
// where it must be specified how to handle non-comparable tokens. 

function compare (tok1, tok2) {
  return compareType (tok1, tok2) ||
    (tok1 [VALUE] === tok2 [VALUE] ? EQ : NC) }

function lt  (tok1, tok2) { return compare (tok1, tok2) < 0 }
function lte (tok1, tok2) { return compare (tok1, tok2) <= 0 }
function eq  (tok1, tok2) { return compare (tok1, tok2) === 0 }
function nc  (tok1, tok2) { const n = compare (tok1, tok2); return n !==n }
function gte (tok1, tok2) { return compare (tok1, tok2) >= 0 }
function gt  (tok1, tok2) { return compare (tok1, tok2) > 0 }

function leastType (tok1, tok2) {
  const c = compareType (tok1, tok2)
  return c < 0 ? tok1 [TYPE] : tok2 [TYPE]
}


// Parser
// ------

const R_ALPHA = /[A-Za-z]/
  , HEXCHARS = /[0-9a-fA-F]/
  , SCHEME_CONTD = /[A-Za-z0-9+\-.]/

// Preprocess
// var C0_SPACE = /[\x00-\x1F\x20]/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]/g

function _trim (string) {
  return string.replace (TRIM, '')
}


// The `mode` determines how backslashes are handled.
// It is one of true, false, null/ undefined, or a string-specified base scheme. 
// - true: always convert '\' to '/'. 
// - false: never convert '\' to '/'. 
// - <scheme>: for schemeless URLs, use the default setting for <scheme>. 
// - default: convert '\' to '/' in schemeless URLs and in 'special scheme' URLs. 

function parse (input, mode) {
  input = _trim (input)

  // configuration
  let convert_slashes = mode == null ? true // default to true for relative URLs
    : typeof mode !== 'boolean' ? mode in specialSchemes : mode

  // state machine state / flags for specific checks
  let _scheme = R_ALPHA.test (input[0]) // check for scheme delimiter (:)
    , _auth = true // check for auth (//) or root (/) 
    , _dir = false // check for directory delimiter (/)
    , _q   = true  // check for query delimiter (?)
    , _h   = true  // check for fragment delimiter (#)
    , part = FILE

  // position and partial result
  let p = 0
    , buff = ''
    , scheme
    , r = []

  while (p < input.length) {
    let c = input [p++], c2 = input [p]
    c = _h && c === '\\' && convert_slashes ? '/' : c

    // console.log ([c, '|', _scheme?1:' ', _dir?1:' ', _auth?1:' ', part].join(' '))

    if (c === ':' && _scheme) {
      scheme = buff.toLowerCase ()
      r.push ([SCHEME, buff])
      buff = ''
      convert_slashes = typeof mode !== 'boolean' ? scheme in specialSchemes : convert_slashes
      _scheme = _dir = false
      _auth = true
    }

    else if (c === '/' && _auth) {
      if (c2 === '/' || c2 === '\\' && convert_slashes) {
        part = AUTH
        _dir = true
        p++
      }
      else {
        r.push ([ROOT, ''])
        buff = ''
      }
      _scheme = _auth = false
    }

    else if (c === '/' && _dir) { // part is FILE or AUTH
      if (part === AUTH) {
        r.push ([AUTH, buff], [ROOT, ''])
        part = FILE
      }
      else
        r.push ([DIR, buff])
      buff = ''
    }

    else if (c === '?' && _q) {
      if (part !== FILE || buff) r.push ([part, buff])
      part = QUERY
      buff = ''
      _auth = _dir = _q = false
    }

    else if (c === '#' && _h) {
      if (part !== FILE || buff) r.push ([part, buff])
      part = FRAG
      buff = ''
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

  if (part !== FILE || buff) r.push ([part, buff])
  return r
}


// Printer
// -------

function print (url) {
  return _print (url.map (escapeToken))
}

function _print (toks) {
  let _p = ''
  return toks.map (p). join ('')
  /* where */
  function p (tok) {
    const v = tok [VALUE]
    switch (tok [TYPE]) {
      case SCHEME: return v+':'
      case AUTH: return '//' + v
      case DRIVE: return '/' + v
      case ROOT: return '/' // _p = v && '/'; return '/' + (v ? v + '/' : '')
      case DIR: return v + '/'
      case FILE: return v
      case QUERY: return '?' + v
      case FRAG: return '#' + v
    }
  }
}

// NB! At the moment, URL percent escapes in token values are neither interpreted, nor inserted,
// and 'escaping' is done just before printing. I'm still thinking about the cleanest way to do this. 
// - The WhatWG adds additional escapes during _parsing_
// - Intuitively, I'd prefer to _interpret_ percent-encoded bytes during parsing instead. 
// - However that would be lossy whilst the WhatWG spec requires that encoding specificities are preserved


const HOST_ESC = /[\x00-\x1F\x7F-\xFF]/g
const FRAG_ESC = /[\x00-\x1F\x7F-\xFF "<>`]/g
const PATH_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}]/g
const QUERY_ESC = /[\x00-\x20\x7F-\xFF"#<>]/g

function _esc (char) {
  var b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}

function escapeToken (tok) {
  let v = tok[1]

  switch (tok[0]) {
    case AUTH:
      v = v //percentEncode (v) .replace (HOST_ESC, esc)
    break
    case FRAG:
      v = percentEncode (v) .replace (FRAG_ESC, _esc)
    break
    case DIR:
    case FILE:
      v = percentEncode (v) .replace (PATH_ESC, _esc)
    break
    case QUERY:
      v = percentEncode (v) .replace (QUERY_ESC, _esc)
    break
    default:
      v = percentEncode (v)
  }

 return [tok[0], v]
}



// Operations on URLs
// ------------------

const R_DRIVE = /^[a-zA-Z][:|]$/
    , R_DOT   = /^(?:\.|%2e)$/i
    , R_DOTS  = /^(?:\.|%2e){2}$/i


// ### 'Join'
// May be named 'goto' instead
// example: `join ('/foo/bar', 'bee#baz')` returns `'/foo/bee#baz'`

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
          case EQ: ai++; bi++ ;break
          default: return as.slice (0, ai) .concat (bs.slice (bi)) }
      break

      case DIR:
        // special case, keep DIR tokens
        if (a [TYPE] === DIR) ai++
        else return as.slice (0, ai) .concat (bs.slice (bi))
      break

      case FRAG:
        // special case, always drop FRAG from as
        return as.slice (0, ai) .concat (bs.slice (bi))
      break

      default:
        if (lt (a, b)) ai++
        else return as.slice (0, ai) .concat (bs.slice (bi))
      break
    }
  }
}


// ### Normalize

function normalize (url) {
  const r = []
  let scheme, auth = false

  for (let i = 0; i < url.length; i++) {
    let a = url [i], prev = r [r.length - 1] || {}

    switch (a [TYPE]) {
      case SCHEME:
        scheme = a [VALUE] .toLowerCase ()
        r.push ([SCHEME, scheme])
      break

      case AUTH:
        r.push (scheme === 'file' && a [VALUE] === 'localhost' ? [AUTH, ''] : a)
      break

      case DRIVE:
        r.push ([DRIVE, a [VALUE][0] + ':'])
      break

      case DIR:
      case FILE:
        if (R_DOTS.test (a [VALUE])) {
          if (prev [TYPE] === DIR && !R_DOTS.test (prev [VALUE])) r.pop ()
          if (prev [TYPE] === ROOT) r
        }
        else if (!R_DOT.test (a [VALUE]))
          r.push (a)
      break

      default:
        r.push (a)
      break
    }
  }
  return r
}


// ### ChangeRoot and RelativeTo

function chroot (as, bs) {
  // TODO
}


function relto (as, bs) {
  // TODO
}

//var sample = 
//  { base:'http://example.com'
//  , url:'http://example.com/foo/bar/' }
//
//
//compose (trace, print, _ => chroot (_.url, _.base), trace)  (sample)



// ### 'Patch' 
// Patch, patches up the first url `as` with the second, `bs` by
// replacing components of equal type and adding in absent components. 
// Any sequence of DIR components in `bs` will be used to replace all
// of the DIR components of `as`. 

function _patch (as, bs) {
  const eoi = [_EOI, null]
  const r = []
  let ai = 0, bi = 0

  do {
    let a = as [ai] || eoi
      , b = bs [bi] || eoi
      , t = leastType (a, b)
      , c = compareType (a, b)

    if (t === _EOI)
      return r

    else {
      if (c === LT) r.push (as [ai++])
      else if (c === GT) r.push (bs [bi++])
      else if (t === DIR) ai++
      else {
        ai++
        r.push (bs [bi++])
      }
    }
  } while (true)
}


// ### Steal
// To convert a relative URL to a base URL, one may attemp to 'steal' 
// the authority from the first nonempty path-component, or
// nonempty path-roots (e.g. drive letters) when they are present. 

// TODO check if this is still ok, after having added DRIVE tokens. 

function steal (as) {
  if (as.length === 0 || as[0][TYPE] !== SCHEME) return as
  var l = as.length
    , i = 0

  while (i<l && lte (as[i], [DIR, ''])) {
    var a = as [i], t = a [TYPE]
    if (t === AUTH && a [VALUE] !== '') return as
    if (t === DRIVE) break
    else i++
  }

  if (i<l) {
    var a  = as [i]
      , bs = as.slice (i+1)
    if (a [TYPE] === FILE || a [TYPE] === DIR || a [TYPE] === DRIVE)
      bs.unshift ([AUTH, a [VALUE]], [ROOT, ''])
    else
      bs.unshift (a)
    return join (as, bs)
  }

  return as
}


// ### Drive letters
// If AUTH value is a drive-letter, then promote it to DRIVE
// Else if the first DIR or FILE is a drive letter, demote it to DRIVE

function letter (as) {
  const r = []
  let done = false

  for (let i=0, l=as.length; i<l; i++) {
    let a = as [i]
      , v = a [VALUE]
      , last = i > 0 ? as [i-1] : [null]

    switch (a [TYPE]) {

      case AUTH:
        if (R_DRIVE.test (v))
          r.push ([AUTH, ''], done = [DRIVE, v])
        else
          r.push (a)
      break

      case DRIVE:
        if (!done)
          r.push (done = a)
        else if (last [TYPE] === DRIVE)
          r.push ([ROOT, ''], [FILE, v])
        else if (last [TYPE] === ROOT)
          r.push ([FILE, v])
      break

      case DIR:
        if (!done && R_DRIVE.test (v)) {
          if (last [TYPE] === ROOT) r.pop ()
          r.push (done = [DRIVE, v], [ROOT, ''])
        }
        else
          r.push (done = a)
      break

      case FILE:
        if (!done && R_DRIVE.test (v)) {
          if (last [TYPE] === ROOT) r.pop ()
          r.push (done = [DRIVE, v])
        }
        else
          r.push (done = a)
      break

      default:
        r.push (a)
    }
  }

  return r
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

  const pure = parse (url_string, slashes)
    , scheme = pure.length && pure[0][TYPE] === SCHEME ? pure[0][VALUE].toLowerCase() : null
    , isFile = scheme === 'file' || !scheme && conf.baseScheme === 'file'

  const drive = typeof conf.detectDrive === 'boolean'
    ? conf.detectDrive
    : isFile

  return drive ? letter (pure) : pure
}


// Base urls
// ---------
// A base URL, is any url that has a scheme and authority component. 
// The WhatWG specifies a way to try and force any URL to a base URL,
// if needed, by 'stealing' the authority from the first path component. 

// TODO should this do something on non-special schemes?
// Look at this more closely

function force (url, baseScheme) {
  if (typeof baseScheme !== 'string') baseScheme = 'about' // Does not matter
  const base = [[SCHEME, baseScheme], [AUTH, ''], [ROOT, '']]
  const scheme = (url.length && url[0][TYPE] === SCHEME ? url[0][VALUE] : baseScheme)
    .toLowerCase ()

  if (scheme === 'file') {
    return letter (_patch (base, url))
  }

  else if (scheme in specialSchemes) {
    return steal (_patch (base, url))
  }
  
  return url
}

//var sample = 'http:cool'
//var sample = '//d|?'
//compose (trace, print, trace, x => force (x, 'http'), letter, parse, trace) (sample)
//compose (trace, print, trace, letter, parse, trace) (sample)
//var sample = '//foo'
//compose (trace, print, trace, _ => force (_, 'about'), parse, trace) (sample)


// ### Resolve
// resolve `url` against base url `base`
// NB. `base` will be forciby coerced into a base url. 

function resolve (url, base) {
  return normalize (join (force (base), url))
}


// Exports
// -------

module.exports = 
{ parse: parse
, print: print
, url: url
, force: force
, steal: steal
, letter: letter
, specialSchemes: specialSchemes
, join: join
, goto: join
, normalize: normalize
, normalise: normalize
, resolve: resolve
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

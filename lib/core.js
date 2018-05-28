"use strict"
const log = console.log.bind (console)

function trace (x) {
  log.apply (this, arguments)
  return x
}

function compose (fn1, fn2, fn3, __) { 
  const fns = arguments
  return function (x) {
    for (let i = fns.length-1; i >= 0; i--) x = fns[i](x)
    return x } }



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
  , PATH      = 'path-root'
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
const _ord = [SCHEME, AUTH, DRIVE, PATH, DIR, FILE, QUERY, FRAG, _EOI]

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


// Preprocess
// ----------

// var C0_SPACE = /[\x00-\x1F\x20]/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]/g

function _trim (string) {
  return string.replace (TRIM, '')
}

// Lexer
// -----

const R_ALPHA = /[A-Za-z]/
  , HEXCHARS = /[0-9a-fA-F]/
  , SCHEME_CONTD = /[A-Za-z0-9+\-.]/


// The `mode` determines how backslashes are handled.
// It is one of true, false, null/ undefined, or a string-specified base scheme. 
// - true: convert '\' to '/' for all schemes and in reative URLs. 
// - false: never convert '\' to '/'. 
// - <scheme>: convert '\' to '/' in relative URLs using the default settings for <scheme>. 
// - default: convert '\' to '/' in schemeless URLs and using the default setting per scheme otherwise. 

function parse (input, mode) {
  input = _trim (input)

  // configuration
  let convert_slashes = mode == null ? true // default to true for relative URLs
    : typeof mode !== 'boolean' ? mode in specialSchemes : mode

  // state machine state 
  let _scheme = R_ALPHA.test (input[0])
    , _rel = true
    , _dir = false
    , _q   = true
    , _h   = true
    , part = FILE

  // position and partial result
  let p = 0
    , buff = ''
    , scheme
    , r = []

  while (p < input.length) {
    let c = input [p++], c2 = input [p]
    c = _h && c === '\\' && convert_slashes ? '/' : c

    // console.log ([c, '|', _scheme?1:' ', _dir?1:' ', _rel?1:' ', part].join(' '))

    if (c === ':' && _scheme) {
      scheme = buff.toLowerCase ()
      r.push ([SCHEME, buff])
      buff = ''
      convert_slashes = typeof mode !== 'boolean' ? scheme in specialSchemes : convert_slashes
      _scheme = _dir = false
      _rel = true
    }

    else if (c === '/' && _rel) {
      if (c2 === '/' || c2 === '\\' && convert_slashes) {
        part = AUTH
        _dir = true
        p++
      }
      else {
        r.push ([PATH, ''])
        buff = ''
      }
      _scheme = _rel = false
    }

    else if (c === '/' && _dir) { // part is FILE or AUTH
      if (part === AUTH) {
        r.push ([AUTH, buff], [PATH, ''])
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
      _rel = _dir = _q = false
    }

    else if (c === '#' && _h) {
      if (part !== FILE || buff) r.push ([part, buff])
      part = FRAG
      buff = ''
      _rel = _dir = _q = _h = false
    }

    else if (c === '\0' && !_h) {
      /* validation error. remove null character from fragment. */
    }

    // else if (c === '%') {
    //
    // }

    else if (_scheme && !SCHEME_CONTD.test (c)){
      buff += c
      _scheme = _rel = false
    }

    else {
      buff += c
      _rel = false
      _dir = _q
    }

  }

  if (part !== FILE || buff) r.push ([part, buff])
  return r
}


// Printer
// -------

function print (toks) {
  let _p = ''
  return toks.map (p). join ('')
  function p (tok) {
    const v = tok [VALUE]
    switch (tok [TYPE]) {
      case SCHEME: return v+':'
      case AUTH: return '//'+v
      case PATH: _p = v && '/'; return '/' + (v ? v + '/' : '')
      case DIR: return /*_p +*/ v + '/' +(_p = '')
      case FILE: return /*_p +*/ v +(_p = '')
      case QUERY: return '?'+v
      case FRAG: return '#'+v
    }
  }
}


// Operations on URLs
// ------------------

const R_DRIVE = /^[a-zA-Z][:|]$/
    , R_DOT   = /^(?:\.|%2e)$/i
    , R_DOTS  = /^(?:\.|%2e){2}$/i


// ### 'Join'

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
        if (a [TYPE] === DIR) ai++
        else return as.slice (0, ai) .concat (bs.slice (bi))
      break

      default:
        if (lt (a, b)) ai++
        else return as.slice (0, ai) .concat (bs.slice (bi))
      break
    }
  }
}

// var base = url ('file:///C:/a/b')
// var sample = '/'
// var joined = join (base), url (sample, 'file'))
// log (base, sample, joined)


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
        r.push (scheme === 'file' && a[VALUE] === 'localhost' ? [AUTH, ''] : a)
      break

      case PATH:
        r.push (a [VALUE] ? [PATH, a [VALUE][0] + ':'] : a)
      break

      case DIR:
      case FILE:
        if (R_DOTS.test (a [VALUE])) {
          if (prev [TYPE] === DIR && !R_DOTS.test (prev [VALUE])) r.pop ()
          if (prev [TYPE] === PATH) r
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

// var sample = '//host/c|/bar/../..'
// var sample = 'file://localhost'
// var sample = 'http://example.com/foo/bar/../ton/../../a'
// var sample = 'localhost/.'
// compose (trace, print, trace, normalize, url, trace)  (sample)

function chroot (as, bs) {
  // to do
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

function patch (as, bs) {
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

//function _patch (pair) {
//  return patch (parse (pair[0]), parse(pair[1]))
//}
//
//var sample = ['http://host/d1/d2/', '/sss']
//compose (log, print, _patch, trace) (sample)


// Base urls
// ---------
// A base URL, is any url that has a scheme and authority component. 
// The WhatWG specifies a way to try and convert any URL to a base URL,
// if needed, by 'stealing' the authority from the forst path component. 

function force (url, baseScheme) {
  const base = [[SCHEME, baseScheme], [AUTH, ''], [PATH, '']]
    , patched = patch (base, url)
    , scheme = patched [0] [VALUE] .toLowerCase ()

  if (scheme === 'file')
    return letter (patched)

  if (scheme in specialSchemes) 
    return steal (patched)

  return url
}

//var sample = 'http:cool'
//var sample = '//d|?'
//var t = compose (trace, print, trace, x => force (x, 'http'), letter, parse, trace) 
//var t = compose (trace, print, trace, letter, parse, trace) 
//setTimeout (_ =>  t (sample))

// ### Steal
// To convert a relative URL to a base URL, one may attemp to 'steal' 
// the authority from the first nonempty path-component, or
// nonempty path-roots (e.g. drive letters) when they are present. 

function steal (as) {
  if (as.length === 0 || as[0][TYPE] !== SCHEME) return as
  var l = as.length
    , i = 0

  while (i<l && lte (as[i], [DIR, ''])) {
    var a = as [i], t = a [TYPE]
    if (t === AUTH && a [VALUE] !== '') return as
    if (t === PATH && a [VALUE] !== '') break
    else i++
  }

  if (i<l) {
    var a  = as [i]
      , bs = as.slice (i+1)
    if (a [TYPE] === FILE || a [TYPE] === DIR || a [TYPE] === PATH)
      bs.unshift ([AUTH, a [VALUE]], [PATH, ''])
    else
      bs.unshift (a)
    return join (as, bs)
  }

  return as
}


// ### Drive letters
// If auth is a drive-letter, then merge it into the path-root. 
// Else if the first dir is a drive letter, merge that into the path root. 
// It sounds so simple. 

function letter (as) {
  const r = []
  let path = false // has a path
    , p = false // wants a path
    , q = false // wants a path before file or dir

  for (let i=0, l=as.length; i<l; i++) {
    var a = as [i]
      , v = a [VALUE]

    switch (a [TYPE]) {

      case SCHEME:
        r.push (a)
        q = true
      break

      case AUTH:
        q = true
        if (R_DRIVE.test (v))
          r.push ([AUTH, ''], path = [PATH, v])
        else
          r.push (a)
      break
    
      case PATH:
        if (!path && v)
          r.push (path = [PATH, v])
        else if (path && v)
          r.push ([DIR, v])
        else
          p = true
      break

      case DIR: case FILE:
        if (!path && R_DRIVE.test (v)) {
          r.push (path = [PATH, v])
        }
        else if (!path && p) {
          r.push (path = [PATH, ''], a)
        }
        else if (!path && q) {
          r.push (path = a)
        }
        else 
          r.push (a)
      break
      
      case QUERY: case FRAG:
        if (p && !path) r.push (path = [PATH, ''], a)
        else r.push (a)
      break
    }
  }

  if (p && !path) r.push (path = [PATH, ''])
  return r
}


// Configurable parser
// conf is either a base-scheme, or an object: { ?ignoreSlashes, ?driveLetters, ?baseScheme }
// ignoreSlashes: true, false, 'auto', defaults to auto
// driveLetters: true, false, 'auto', defaults to auto
// baseScheme: <string>, for auto; parse relative URLs with the settings per scheme. 

function url (url, conf) {
  conf = typeof conf === 'string'
    ? { baseScheme: conf }
    : conf == null || typeof conf !== 'object'
    ? { }
    : conf

  const slashes = typeof conf.convertSlashes === 'boolean'
    ? conf.convertSlashes
    : conf.baseScheme
  
  const pure = parse (url, slashes)
    , scheme = pure.length && pure[0][TYPE] === SCHEME ? pure[0][VALUE] : null
    , isFile = scheme === 'file' || !scheme && conf.baseScheme === 'file'

  const drive = typeof conf.driveLetters === 'boolean'
    ? conf.driveLetters
    : isFile
    
  return drive ? letter (pure) : pure
}


//var conf = { baseScheme:'httpsp', convertSlashes:'http' }
//var conf = {} //'file'
//var sample = '/c|/asdf\\sdf'
//var sample = 'file:c:\\foo\\bar.html'
//compose (trace, print, trace, s => url (s, conf), trace) (sample)

// ### Relative to, chroot, resolve/normalize and others. 
// TODO



// Exports
// -------

module.exports = 
{ parse: parse
, print: print
, url: url
, str: print
, force: force
, steal: steal
, letter: letter
, specialSchemes: specialSchemes
, join: join
, normalize: normalize
, normalise: normalize
//
, SCHEME: SCHEME
, AUTH: AUTH
, PATH: PATH
, DIR: DIR
, FILE: FILE
, QUERY: QUERY
, FRAG: FRAG
}

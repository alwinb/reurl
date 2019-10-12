"use strict"
const wtf8 = require ('wtf-8')
const log = console.log.bind (console)

// URLs
// ----
// Urls are modeled simply as arrays of tokens where
// Tokens are tuples [type, value]. 
// Token types have a natural order, which will be shown below. 

const tokenTypes = [ 'scheme', 'authority', 'drive', 'root', 'dir', 'file', 'query', 'hash' ]
const [ SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG ] = tokenTypes

// Total and partial orders
// ------------------------

const LT = -1
const EQ =  0
const GT =  1

// ### Total order on tokens, based on their type alone
// This is used for in the operations on URLs. 

function compareType (t1, t2) {
  const i1 = tokenTypes.indexOf (t1)
  const i2 = tokenTypes.indexOf (t2)
  return i1 < i2 ? LT : i1 > i2 ? GT : EQ
}

const specialSchemes = {
  ftp: 21,
  file: null ,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
}


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

// parseUrl (url_string, conf)
// The `conf` is a configuration object { backslashes, drive }
// with values being a boolean, or a function that takes a scheme string or null to a boolean

function parseUrl (input, conf) {
  input = input.replace (TRIM, '')

  // state
  let backslashes = conf.backslashes (conf.scheme) 
  let drive = conf.drive (conf.scheme) 
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
        emit (part === SCHEME ? FILE : part, buff, FRAG)

      else if (part === QUERY)
        buff += c

      else if (c === '?')
        emit (part === SCHEME ? FILE : part, buff, QUERY)

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
        const _scheme = buff.toLowerCase ()
        backslashes = conf.backslashes (_scheme) 
        drive = conf.drive (_scheme) 
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

      if (url.length && url[url.length - 1] [0] === ROOT)
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

function printUrl (url) {
  let path_esc = PATH_ESC
  let host_pre = '//'
  return [...url] .map (printToken) .join ('')

  function printToken ([key, v]) {
    switch (key) {
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

function printAuth (auth) {
  const host = _encode (auth.host, HOST_ESC)
  const port = auth.port == null ? '' : ':' + auth.port
  const pass = auth.pass == null ? '' : ':' + _encode (auth.pass, USER_ESC)
  const info = auth.user == null ? '' : _encode (auth.user, USER_ESC) + pass + '@'
  return info + host + port
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



module.exports = {
  printAuth,
  parseAuth,
  printUrl,
  parseUrl,

  specialSchemes,
  tokenTypes,
  compareType,

  SCHEME,
  AUTH,
  DRIVE,
  ROOT,
  DIR,
  FILE,
  QUERY,
  FRAG
}
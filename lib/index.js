const wtf8 = require ('wtf-8')
const punycode = require ('punycode')
const log = console.log.bind (console)

const define = (obj, props) =>
  (Object.defineProperties (obj, props), obj)

// Internals
// =========

// In my 'theory of URLs' I have modeled them as a sequences of tokens, where tokens are tuples [type, value]. 
// Token types have a natural order, implemented by `compareType` below. 

const tokenTypes = [ 'scheme', 'authority', 'drive', 'root', 'dir', 'file', 'query', 'hash' ]
const [ SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, HASH ] = tokenTypes

function compareType (t1, t2) {
  const i1 = tokenTypes.indexOf (t1)
  const i2 = tokenTypes.indexOf (t2)
  return i1 < i2 ? -1 : i1 > i2 ? 1 : 0
}

// An alternative view, is as records or nested records. 
// Both views are implemented by the Url class below. 

const ERR_INVALID = 'ERR_INVALID'
const ERR_NOAUTH = 'ERR_NOAUTH'
const ERR_NOUSER = 'ERR_NOUSER'
const ERR_HASROOT = 'ERR_HASROOT'
const ERR_NOSCHEME = 'ERR_NOSCHEME'

const R_SCHEME = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const R_DRIVE  = /^([a-zA-Z])([:|])?$/
const R_DOT    = /^(?:\.|%2e)$/i
const R_DOTS   = /^(?:\.|%2e){2}$/i
const MAX_PORT = Math.pow (2, 16) - 1


// Url class
// =========

class Url {

  constructor (object = { }, conf) {

    if (typeof object === 'string')
      return Url.fromString (object, conf)

    let { scheme, pass, user, host, port, drive, root, dirs, file, hash, query } = object
    dirs = [...Url.toDirs (dirs)] // shallow copy; contents are not checked

    define (this, {
      scheme: { get: $=> scheme
              , set: v=> scheme = Url.toScheme (v) },
    
      pass:   { get: $=> pass
              , set: v=> pass = Url.toPass (v, this) },

      user:   { get: $=> user
              , set: v=> (user = Url.toUser (v, this), pass = null) },
    
      host:   { get: $=> host
              , set: v=> (host = v, pass = user = port = null) },
    
      port:   { get: $=> port
              , set: v=> port = Url.toPort (v, this) },
    
      drive:  { get: $=> drive
              , set: v=> drive = Url.toDrive (v) },
    
      root:   { get: $=> root || Url.needsRoot (this) ? '/' : null
              , set: v=> root = Url.toRoot (v, this) },
    
      dirs:   { get: $=> dirs
              , set: v=> dirs = Url.toDirs (v) },

      file:   { get: $=> file
              , set: v=> file = Url.toFile (v) },

      query:  { get: $=> query
              , set: v=> query = v },

      hash:   { get: $=> hash
              , set: v=> hash = v },

      href:   { get: $=> printUrl (Url.tokens (this)) },

      authority: { get: $=> host == null ? null : { user, pass, host, port } 
                 , set: v=> this.assign (Url.toAuthority (v, this)) },
    })
    
    return this
  }


  // ### Conversions

  static fromString (input, conf) {
    return new Url () .addTokens (parseUrl (input, conf))
  }

  static *tokens (url) {
    for (let k of tokenTypes) {
      if (k === DIR) for (let dir of url.dirs) yield [DIR, dir]
      else if (k === ROOT) { if (url[k]) yield [ROOT, '/'] }
      else if (url[k] != null) yield [k, url[k]]
    }
  }

  toString () { return this.href }
  valueOf () { return this.href }
  toJSON () { return this.href }
  [Symbol.iterator] () { return Url.tokens (this) }
  
  
  // ### Aggregate setters

  set (obj = { }) {
    const r = new Url (this) .assign (obj)
    r.dirs = Array.from (r.dirs) // shallow copy // TODO is this still necessary?
    return r
  }

  assign (obj = { }) { // mutative
    const { host, user, ...rest } = obj // FIXME object splats not supported by edge 18
    if ('host' in obj) this.host = host
    if ('user' in obj) this.user = user
    return Object.assign (this, rest)
  }

  // TokenList representation

  addTokens (tokens) { // mutative
    for (let token of tokens)
      this.addToken (token)
    return this
  }

  addToken ([k, v]) { // mutative
    if (k === DIR) this.dirs.push (v)
    else if (tokenTypes.indexOf (k) >= 0)
      this [k] = v
    return this
  }


  // ### Operations

  goto (url2) {
    if (!(url2 instanceof Url)) url2 = new Url (url2) // TODO pass the conf?
    return Url.join (this, url2)
  }

  resolve (url1) {
    if (!(url1 instanceof Url)) url1 = new Url (url1) // TODO pass the conf?
    return Url.join (url1, this)
  }

  normalize () {
    return Url.normalize (this)
  }

  force () {
    return Url.force (this)
  }


  static join (url1, url2) {
    const result = new Url ()
    const type2 = Url.leastType (url2, { ignoringScheme: url1.scheme })
    for (let token of url1) {
      const c = compareType (token[0], type2)
      if (c < 0 || c === 0 && token[0] === DIR) result.addToken (token)
      else return result.addTokens (url2)
    }
    return result.addTokens (url2)
  }

  static normalize (url) {
    let { scheme, user, pass, host, port, drive, root, dirs = [], file, query, hash } = url
    if (scheme) scheme = scheme.toLowerCase ()
    if (pass === '') pass = null
    if (user === '' && pass === null) user = null
    if (drive) drive = drive [0] + ':'
    if (R_DOT.test (file)) file = null
    if (typeof port === 'string' && /^[0-9]+$/.test (port)) port = +port

    let dirs2 = []
    for (let x of dirs) {
      if (R_DOTS.test(x)) dirs2.pop ()
      else if (!R_DOT.test(x)) dirs2.push (x)
    }
    if (R_DOTS.test (file)) { // TODO should dots be parsed as dirs always?
      dirs2.pop ()
      file = null
    }

    if (scheme === 'file') {
      if (host === 'localhost') host = ''
      root = root || !drive && !dirs2.length && !file
    }
    else if (scheme && scheme in specialSchemes) {
      if (port === specialSchemes[scheme]) port = null
      root = root || host != null
    }

    return new Url ({ scheme, user, pass, host, port, drive, root, dirs:dirs2, file, query, hash })
  }

  static force (url) {
    if (!url.scheme) throw new Error (ERR_NOSCHEME)
    let scheme = url.scheme.toLowerCase ()

    if (scheme === 'file')
      return url.host == null ? url.set ({ host:'' }) : url

    if (scheme in specialSchemes && !Url.hasSubstantialAuth (url)) {
      const dirs = Array.from (url.dirs)
      while (dirs.length && dirs[0] === '') dirs.shift ()
      if (dirs.length) {
        const { user, pass, host, port } = parseAuth (dirs.shift (), { parseHost:scheme in specialSchemes }) // FIXME
        return url.set ({ user, pass, host, port, dirs })
      }
      if (url.file) {
        const { user, pass, host, port } = parseAuth (url.file, { parseHost:scheme in specialSchemes }) // FIXME
        return url.set ({ user, pass, host, port, dirs: [], file: null })
      }
    }

    return url
  }


  // ### Helpers

  static leastType (url = { }, { ignoringScheme = null } = { }) {
    if (ignoringScheme != null)
      ignoringScheme = ignoringScheme.toLowerCase ()
    for (let token of Url.tokens (url))
      if (token[0] !== SCHEME || ignoringScheme !== token[1].toLowerCase ())
        return token[0]
    return HASH
  }

  static needsRoot ({ host, drive, dirs = [], file } = { }) {
    return (host != null || drive) && (dirs.length || file) ? '/' : null
  }

  static hasSubstantialAuth ({ host, user, pass, port } = { }) {
    return host || user || pass || (port != null && port !== '')
  }

  static Error (message) {
    throw new Error (String (message))
  }

  // ### Validators/ Coercions

  static toScheme (v) { let match;
    return v == null ? null :
      (match = R_SCHEME.exec (v)) == null ?
      Url.Error (ERR_INVALID) : match [1]
  }

  static toUser (v, url) {
    return v == null ? null :
      url.host == null ? Url.Error (ERR_NOAUTH) : String (v)
  }

  static toPass (v, url) {
    return v == null ? null :
      url.host == null ? Url.Error (ERR_NOAUTH) :
      url.user == null ? Url.Error (ERR_NOUSER) : String (v)
  }

  static toHost (v, url) { // Unused
    return v == null ? null : String (v)
  }

  static toPort (v, url) {
    if (v == null || v === '') return null
    if (url.host == null) return Url.Error (ERR_NOAUTH)
    v = typeof v !== 'number' ? +String (v) : v
    return isNaN (v) || v < 0 || v > MAX_PORT ? Url.Error (ERR_INVALID) : v
  }

  static toAuthority (v, url) {
    v = v == null || typeof v !== 'object' ? { host:v } : v
    const { user, pass, host, port } = v
    return { user, pass, host, port }
  }

  static toDrive (v) { let match;
    return v == null ? null :
      (match = R_DRIVE.exec (v)) == null ?
      Url.Error (ERR_INVALID) : match[1] + (match[2] || ':')
  }

  static toRoot (v, url) {
    return !v && Url.needsRoot (url) ?
      Url.Error (ERR_HASROOT) :
      v ? '/' : null
  }

  static toDirs (o) {
    return o == null ? []
      : (typeof o !== 'object' || !(Symbol.iterator in o)) ? [o]
      : o
  }

  static toFile (v) {
    if (v == null) return null
    return !v.length ? Url.Error (ERR_INVALID) : v // TODO coerce to string?
  }

}

Url.prototype.normalise = Url.prototype.normalize
Url.Url = Url


// Parser configuration object
// ---------------------------

// The URL Parser supports both absolute and relative URLs. 
// However, the conversion of backlsahses to forward slashes, and the detection of
// filepath drive letters does depend on the URL scheme. 
// Thus, the desired behaviour must be supplied manually when parsing relative URLs. 
// This is done by passing a configuration object rather than by supplying a scheme. 

// Currenty the configuration may be
// - a string - indicating the scheme to used for schemless urls
// - a config object { convertSlashes:boolean, detectDrive:boolean } to be used for all urls
// - a function that takes a scheme string or null to a config object to override the default configs for urls with a scheme and schemeless urls respectively. 

const specialSchemes = {
  ftp: 21,
  file: null ,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
}

function evalConfig (input, scheme) {
  if (typeof scheme === 'string') scheme = scheme.toLowerCase ()
  if (typeof input === 'function') input = input (scheme)
  if (typeof input === 'string') [scheme, input] = [input.toLowerCase (), { }]
  const special = scheme in specialSchemes || scheme == null, file = scheme === 'file'
  let { convertSlashes, detectDrive, parseHost, percentDecoded } = input
  if (typeof convertSlashes !== 'boolean') convertSlashes = special
  if (typeof detectDrive !== 'boolean') detectDrive = file
  if (typeof parseHost !== 'boolean') parseHost = special && !file
  if (typeof percentDecoded !== 'boolean') percentDecoded = false
  // log ('evalConfig', input, scheme, { convertSlashes, detectDrive, parseHost, percentDecoded })
  return { convertSlashes, detectDrive, parseHost, percentDecoded }
}


// URL Parser
// ----------

const isAlpha = (char = '') =>
  ('A' <= char && char <= 'Z' || 'a' <= char && char <= 'z')

const SCHEME_CONTD = /^[A-Za-z0-9+\-.]$/
const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]+/g
// const C0_SPACE = /[\x00-\x1F\x20]/

// parseUrl (url_string, conf)
// The `conf` is a configuration object (see above)

function parseUrl (input = '', conf = {}) {
  input = input.replace (TRIM, '')

  // Parser state
  const length = input.length
  const result = []
  let position = 0
  let last = null
  let _scheme = null // conf.scheme
  let { convertSlashes, detectDrive, parseHost } = evalConfig (conf, null)

  // config/ state dependent slash/ backslash handling
  const isSep = (c) => c === '/' || convertSlashes && c === '\\' || c === '#' || c === '?' || c == null
  const isSlash = c => c === '/' || convertSlashes && c === '\\'


  // Main loop

  while (position < length) {
    const token = next ()
    result.push (token)
    last = token [0]
    if (last === SCHEME) {
      _scheme = token[1].toLowerCase ()
      const _conf = evalConfig (conf, _scheme)
      convertSlashes = _conf.convertSlashes
      detectDrive = _conf.detectDrive
      parseHost = _conf.parseHost
    }
  }
  return result

  // Parses the next token

  function next () {
    const char = input [position]
    if (isSlash (char)) return last === null || last === SCHEME ? auth () || drive (position + 1) || root ()
      : last === AUTH ? drive (position + 1) || root ()
      : last === DRIVE ? root ()
      : dirOrFile ()
    else return char === '?' ? query ()
      : char === '#' ? hash ()
      : last === null && isAlpha (char) ? schemeDriveDirOrFile ()
      : last === SCHEME ? drive () || dirOrFile ()
      : dirOrFile ()
  }

  // Current char being '/'
  function auth () {
    if (isSlash (input [position + 1])) {
      const start = position = position + 2
      // HACK for drives such as file://c: TODO make neat
      const _d = drive ()
      if (_d) return _d
      let char
      do char = input [position++]
      while (!isSep (char))
      return [AUTH, parseAuth (input.substring (start, --position), { parseHost }) ]
    }
  }

  function drive (pos = position) { // HACK; passing start position, in case such as file:c:/
    const [c1, c2, c3] = input.substr (pos, 3) // eg. C:/ for a valid drive
    if (detectDrive && isAlpha (c1) && (c2 === ':' || c2 === '|') && isSep (c3)) {
      const value = input.substr (pos, 2)
      position = pos + 2
      return [DRIVE, value]
    }
  }

  function root () {
    return [ROOT, input[position++]]
  }

  // Current char being '?'
  function query () {
    const start = ++position
    while (position < length && input[position] !== '#') position++
    return [QUERY, input.substring (start, position)]
  }

  // Current char being '#'
  function hash () {
    const start = position + 1
    position = length
    return [HASH, input.substr (start)]
  }

  // Current char being alpha
  function schemeDriveDirOrFile () {
    const start = position
    let isScheme = true, isDrive = detectDrive
    while (true) {
      const char = input [++position]
      if (isSlash (char)) return [DIR, input.substring (start, position++)]
      if (char === '#' || char === '?' || char == null) return [FILE, input.substring (start, position)]
      if (isScheme && char === ':') return [SCHEME, input.substring (start, position++)]
      if (isDrive && char === '|' && isSep (input[position+1])) return [DRIVE, input.substring (start, ++position)]
      isScheme = isScheme && SCHEME_CONTD.test (char)
      isDrive = false
    }
  }

  // Current char being anything
  function dirOrFile () { 
    const start = position
    while (true) {
      const char = input [position++]
      if (isSlash (char)) return [DIR, input.substring (start, position - 1)]
      if (char === '#' || char === '?' || char == null) return [FILE, input.substring (start, --position)]
    }
  }

}


// Percent coding
// --------------

const PERCENT = /%([0-9a-fA-F]{2})/g
const C0_ESC = /[\x00-\x1F\x7F-\xFF]/g
  , HOST_ESC = C0_ESC
  , HASH_ESC = /[\x00-\x1F\x7F-\xFF "<>`]/g
  , PATH_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}]/g
  , USER_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}/:;=@\[\\\]^|]/g
  , QUERY_ESC = /[\x00-\x20\x7F-\xFF"#<>]/g

function _escapeChar (char) {
  const b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}

function encode (value, regex = C0_ESC) {
  return wtf8.encode (String (value)) .replace (regex, _escapeChar)
}

function decode (value) {
  value = wtf8.encode (value) .replace (PERCENT, pct => String.fromCharCode (parseInt (pct.substr(1), 16)))
  return wtf8.decode (value)
}


// URL Printer
// -----------

// TODO: What to do with cases in which a reparse would fail?
// e.g. [[ROOT], [DIR, ''], [FILE, 'foo']] and probably others, too

// NB! At the moment, URL percent escapes in token values are neither interpreted, nor inserted,
// and 'escaping' is done just before printing. I'm still thinking about the cleanest way to do this. 
// - The WhatWG adds additional escapes during _parsing_
// - Intuitively, I'd prefer to _interpret_ percent-encoded bytes during parsing instead. 
// - However that would be lossy whilst the WhatWG spec requires that encoding specificities are preserved

// Note: The WhatWG defines that 'cannot-be-base' URLs,
// encode less characters in the path; 
// This is implemented here as a check: cannot-be-base
// is true iff scheme is present and non-special and immediately
// followed by a dir or file token. 
// TODO be careful; it should probably encode / too and \ too if special?
// (to prevent reparse issues?)

function printUrl (url) {
  let path_esc = PATH_ESC, scheme = null
  let host_pre = '//'
  return [...url] .map (printToken) .join ('')

  function printToken ([key, v]) {
    switch (key) {
      case SCHEME: 
        if (! (v in specialSchemes)) path_esc = C0_ESC
        scheme = v.toLowerCase ()
        return `${v}:`

      case AUTH: 
        path_esc = PATH_ESC
        return `//${printAuth(v, scheme)}`

      case DRIVE: 
        path_esc = PATH_ESC
        return `/${v}`

      case ROOT: 
        path_esc = PATH_ESC
        return '/'

      case DIR: return encode (v, path_esc) + '/'
      case FILE: return encode (v, path_esc)
      case QUERY: return '?' + encode (v, QUERY_ESC)
      case HASH: return '#' + encode (v, HASH_ESC)
    }
  }
}


// Authority parser
// ----------------

// Invariants:
// - An authority has credentials :<=> user is non-null
// - If pass is non-null then user is non-null

// Parser:
// the last @ is the nameinfo-host separator
// the first : before the last @ is the username-password separator
// the first : after the last @ is the host-port separator

// Thus,
// username cannot contain : but may contain @
// pass may contain both : and @ 
// host cannot contain : nor @ (except, : within brackets)
// port cannot contain @

// NB. In the WhatWG Standard, file auths cannot have
// credentials or a port. However, their hostname also cannot
// contain '@' or ':' chars. So it is fine to use the default
// auth parser and implement the check on the parsed auth instead. 

function parseAuth (string, conf = { }) {
  let [last_at, port_col, first_col, bracks] = [-1, -1, -1, false]

  for (let i=0, l=string.length; i<l; i++) {
    const c = string [i]
    if (c === '@') {
      last_at = i
      bracks = false
    }
    else if (c === ':') {
      if (first_col < 0) first_col = i
      if (port_col <= last_at && !bracks) port_col = i
    }
    else if (c === '[')
      bracks = true
    else if (c === ']')
      bracks = false
  }

  let user = null, pass = null, host = null, port = null

  if (last_at >= 0) { // has credentials
    if (0 <= first_col && first_col < last_at) { // has password
      user = string.substring (0, first_col)
      pass = string.substring (first_col + 1, last_at)
    }
    else
      user = string.substring (0, last_at)
  }

  if (port_col > last_at) { // has port
    host = string.substring (last_at + 1, port_col)
    port = string.substr (port_col + 1)
    if (/^[0-9]+$/.test (port)) port = parseInt (port, 10)
  }

  else
    host = string.substr (last_at + 1)

  host = conf.parseHost ? decode (host) : host
  return { user, pass, host, port }
}

// TODO so, if the host would change to/ from opaque through the API
// then it somehow needs to be reprocessed. 


// Authority printer
// -----------------

function printAuth ({ user, pass, host, port }, scheme = null) {
  host = scheme != null && (scheme in specialSchemes)
    ? punycode.toASCII (String (host)) .toLowerCase ()
    : encode (String (host), HOST_ESC)
  port = port == null ? '' : ':' + port
  pass = pass == null ? '' : ':' + encode (pass, USER_ESC)
  info = user == null ? '' : encode (user, USER_ESC) + pass + '@'
  return info + host + port
}


// Exports
// -------

module.exports = Url
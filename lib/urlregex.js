"use strict"
const wtf8 = require ('wtf-8')
const punycode = require ('punycode')
const ip4 = require ('./ipv4')
const log = console.log.bind (console)
const setProto = Object.setPrototypeOf

// Internals
// =========

// In my 'theory of URLs' I have modeled URLs as sequences of tokens,
// where tokens are tuples [type, value] with a natural order on types. 
// This representation is ideal for implementing the resolve/ goto operations. 

const tokenTypes = ['scheme', 'auth', 'drive', 'root', 'dir', 'file', 'query', 'hash']
const typeOrd    = { scheme:1, auth:2, drive:3, root:4, dir:5, file:6, query:7, hash:8 }

function compareType (t1, t2) {
  const i1 = typeOrd [t1], i2 = typeOrd [t2]
  return i1 < i2 ? -1 : i1 > i2 ? 1 : 0
}

// There is another representation of URLs as indexed records,
// where the fields of the record are taken from the following.
// Here, 'dirs' collects all 'dir' tokens into an array of strings,
// all other fields (if present) are just strings. 

const fieldNames = ['scheme', 'user', 'pass', 'host', 'port', 'drive', 'root', 'dirs', 'file', 'query', 'hash']

// Entries; is like Object.entries for such URL records, as a generator. 
// However, it also implements patching: for each key of fieldNames it takes
// the value from the first argument that has a non-undefined value for it. 

function *entries (...objects) {
  for (let k of fieldNames) { let v
    for (let i=0, l=objects.length; i<l; i++)
      if ((v = objects[i][k]) !== undefined) break
    if (v !== undefined) yield [k, v]
  }
}

// Assemble, takes a token sequence and builds an indexed URL record from it.  
// I have made it more general, so that it can also create copies of records
// by using assemble (entries (record)).

function assemble (entries, onto = {}) {
  for (let [k, v] of entries) {
    if (k === 'dir') (onto.dirs = onto.dirs || []) .push (v) // collect dirs
    else if (k === 'auth') assemble (Object.entries (v), onto) // expand auth
    else assign (onto, k, v)
  } return onto
}

function assign (obj, k, v) {
  const spec = { value:v, enumerable:true, configurable:true, writable:false }
  return Object.defineProperty (obj, k, spec)
}


const R_DOT    = /^(?:\.|%2e)$/i
const R_DOTS   = /^(?:\.|%2e){2}$/i


// Immutable Url Object
// ====================

class Url { 

  constructor (input, { percentCoding = 'decode', parser = 'http' } = { }) {
    const percentCoded = { preserve:true, decode:false } [percentCoding]
    if (percentCoded == null) throw new Error ('ERR_INVALID_SETTINGS')

    if (typeof input === 'string') {
      input = parseUrl (input, parser)
      return Url.fromIterable (!percentCoded ? map (input, decode) : entries (input), { percentCoded })
    }

    if (input instanceof Url) {
      return input.percentCoded === percentCoded ? input : 
        Url.fromIterable (map (input, !percentCoded ? decode : _encode ()), { percentCoded })
    }

    if (typeof input === 'object' && input !== null)
      return Url.fromIterable ([], { percentCoded }) .set (input)

    this._scheme = null
    this.percentCoded = percentCoded
    this.query = this.file = this.dirs = this.root =
    this.drive = this.port = this.host = this.user = 
    this.pass = this.scheme = null
  }

  static fromIterable (fields, { percentCoded = true } = { }) {
    const r = assemble (fields, new Url ())
    if (!r.root && Url.needsRoot (r)) assign (r, 'root', '/') // sets implicit root
    assign (r, '_scheme', r.scheme ? r.scheme.toLowerCase () : null)
    assign (r, 'percentCoded', percentCoded)
    Url.enforceConstraints (r)
    return r
  }

  static fromString (input, conf = { }) {
    return new Url (String (input), conf)
  }

  toString ({ ascii = false } = { }) {
    const { percentCoded } = this
    const special = Url.isSpecial (this)
    const nonbase = Url.cannotBeBase (this) // 'nonbase' URLs have less characters escaped in path
    const encode = _encode ({ percentCoded, special, nonbase, ascii })
    const pre = { user:'//', pass:':', host:'//', port:':', drive:'/', query:'?', hash:'#' }
    const post = { scheme:':', dir:'/'}
    let out = '' /* now consume the iterator for its side effect */
    this.forEach (printItem, this)
    return out
    /* where */
    function printItem (v, k) {
      if (v == null) return
      if (k === 'user') pre.host = '@'
      if (k !== 'host') v = encode (v, k)
      else if (k === 'host') v
        = v[0] === '[' && v.substr(-1) === ']' ? v
        : special && ascii ? punycode.toASCII (v) .toLowerCase ()
        : !special ? encode (v, k)
        : v
      else if (k === 'dirs' && v) v = v.map (d => encode (d, 'dir'))
      out += `${ pre[k] || '' }${ v }${ post[k] || '' }`
    }
  }

  toASCII () {
    return this.toString ({ ascii:true })
  }

  get href () {
    return this.toString ({ ascii:true })
  }

  forEach (fn, thisarg = this) {
    for (let [k,v] of entries (this)) {
      if (k === 'dirs' && v) {
        let i=0; for (let d of v)
          fn.call (thisarg, d, 'dir', i++)
      }
      else fn.call (thisarg, v, k)
    }
  }

  *tokens () {
    for (let k of tokenTypes) {
      if (k === 'dir') yield* (this.dirs||[]) .map (_ => ['dir', _])
      else if (k === 'auth' && this.host != null) {
        const { user = null, pass = null, host, port = null } = this
        yield [k, { user, pass, host, port } ]
      }
      else if (this[k] != null) yield [k, this[k]]
    }
  }

  parseHost () {
    let host = this.host
    if (!host) return this
    if (host[0] === '[' && host.substr(-1) === ']') {
      // TODO support for ipv6
      return this
    }
    else {
      host = punycode.toUnicode (!this.percentCoded ? host : decode (host))
      try { host = ip4.print (ip4.parse (host)) }
      catch (e) { }
      // TODO how to store the 'parsedHost' metadata?
      let { user, pass, port} = this
      return this.set ({ user, pass, host, port, parsedHost:true })
    }
  }

  // ### Operations

  // - The patch may contain a setting: percentCoded to signify
  //   that the values may contain percent escape sequences.
  //   Defaults to true in preserve mode and to false in 'decode' mode. 
  // - If the patch contains a host, all auth components will be reset. 
  //   If it contains a username, the password will be reset. 

  set (patch) {
    const { percentCoded = this.percentCoded } = patch
    try {  patch = assemble (map (patch, validate)) }
      catch (e) { throw e }
  
    if (percentCoded !== this.percentCoded)
      patch = assemble (map (patch, this.percentCoded ? _encode () : decode ))

    const reset = 'host' in patch
      ? { user:null, pass:null, port:null }
      : 'user' in patch ? { pass:null } : { }

    const r = Url.fromIterable (entries (patch, reset, this), this)
    if (r.root && 'root' in patch && !patch.root)
      throw new Error ('ERR_NEEDSROOT') // implied root cannot be removed

    return r
  }

  goto (url) { // AKA join
    const percentCoding = this.percentCoded ? 'preserve' : 'decode'
    url = new Url (url, { percentCoding, parser:this._scheme })
    return Url.fromIterable (_goto (this, url), this)
  }

  resolve (base) {
    const percentCoding = this.percentCoded ? 'preserve' : 'decode'
    base = new Url (base, { percentCoding })
    if (!base.scheme || Url.cannotBeBase (base) && !{ scheme:1, hash:1 } [Url.leastType (this)])
      throw new Error ('ERR_NOT_A_BASE_URL')
    return Url.fromIterable (_goto (base, this), this)
  }

  // Force-coerce an URL to a base URL according to the whatWG URL Standard. 
  // REVIEW should this indeed throw?

  force () {
    if (!this.scheme) throw new Error ('ERR_FORCE_NOSCHEME')
    if (Url.hasSubstantialAuth (this)) return this
    if (this._scheme === 'file') return this.set ({ host:'' })
    // REVIEW Should it be generalised? ie. not check for specialSchemes? => What about drives?
    if (this._scheme in specialSchemes && !this.drive) {
      const url = Url.fromIterable (_force (this), this)
      if (Url.hasSubstantialAuth (url)) return url
      else throw new Error ('ERR_FORCE_FAILED')
    }
    return this
  }

  normalize () {
    const scheme = this._scheme
    const auth = Url._normalizeAuth (this)
    const path = Url._normalizePath (this)
    const root = (scheme in specialSchemes && auth.host != null && !path.drive) ? '/' : path.root
    return Url.fromIterable (entries ({ scheme, root }, auth, path, this), this)
  }

  normalise () {
    return this.normalize ()
  }

  // ### Helpers

  static leastType (url) {
    for (let [k] of url.tokens ()) return k
    return 'hash'
  }

  static needsRoot ({ host, drive, dirs, file }) {
    return (host != null || drive) && (dirs && dirs.length || file) ? '/' : null
  }

  static hasSubstantialAuth ({ user, pass, host, port }) {
    if (host == null) return false
    return host || user != null || pass != null || port != null
  }

  static cannotBeBase ({ scheme, host, drive, root, file }) {
    return host == null && !root && scheme && !(scheme in specialSchemes)
  }

  static isSpecial ({ _scheme }) {
    return _scheme == null || _scheme in specialSchemes
  }

  static enforceConstraints ({ scheme, user, pass, host, port, drive, _scheme }) {
    if ((!host || _scheme === 'file') && (user != null || port != null))
      throw new Error ('ERR_NOAUTH')

    else if (user == null && pass != null)
      throw new Error ('ERR_NOCREDS')

    if (drive && scheme && _scheme !== 'file')
      throw new Error ('ERR_NONFILE_DRIVE')
  }

  // Private

  static _normalizeAuth ({ user, pass, host, port, _scheme, percentCoded }) {
    if (port === '') port = null
    if (pass === '') pass = null
    if (user === '' && pass === null) user = null
    if (host === 'localhost' && _scheme === 'file') host = ''
    else if (port != null && _scheme && port === specialSchemes[_scheme]) port = null
    // host = host == null ? null : parseHost (host, { opaque:_scheme === 'file' || !(_scheme in specialSchemes) , percentCoded })
    return { user, pass, host, port }
  }

  static _normalizePath ({ drive, root, dirs, file, _scheme, percentCoded }) {
    // FIXME if decoded then don't check %2e
    const dirs2 = []
    if (drive) drive = drive [0] + ':'
    for (let x of dirs || []) {
      if (R_DOTS.test (x)) dirs2.pop ()
      else if (!R_DOT.test (x)) dirs2.push (x)
    }
    if (R_DOT.test (file)) file = null
    else if (R_DOTS.test (file)) {
      dirs2.pop ()
      file = null
    }
    return { drive, root, dirs:dirs2.length ? dirs2 : null, file }
  }

}


Url.fromTokens = Url.fromIterable


// ### Input validation

const schemeExp = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const driveExp = /^[a-zA-Z][:|]?$/
const MAX_PORT = 2 ** 16 - 1

function validate (v, k, obj) { 
  return v == null ? null
    : k in validators ? validators [k] (v, k, obj) : v }

const validators = {

  scheme (v) {
    let match = schemeExp.exec (v)
    if (!match) throw new Error ('ERR_INVALID_SCHEME')
    return match [1]
  },

  drive (v) {
    let match = driveExp.exec (v)
    if (!match) throw new Error ('ERR_INVALID_DRIVE')
    return (v + ':') .substr (0,2)
  },

  port (v) {
    v = typeof v !== 'number' ? /^[0-9]+$/ .test (v) ? +v : NaN : v
    if (isNaN (v) || v < 0 || v > MAX_PORT || v !== Math.trunc(v)) throw new Error ('ERR_INVALID_PORT')
    return v
  },

  root (v) {
    return v ? '/' : null
  },

  file (v) {
    return v === '' ? null : v
  }
}

// ### Generators and implementation details

// Map; expands dirs (but it does not matter)

function* map (r, obj) {
  const fn = typeof obj === 'function' ? obj
    : (v, k, r) => v == null ? null
      : k in obj ? obj [k] (v, k, r) : v
  for (let [k,v] of entries (r)) {
    if (k === 'dirs' && v)
      yield* v.map (_ => ['dir', fn (_, 'dir', r)])
    else yield [k, fn (v, k, r)]
  }
}

function* _goto (url, url2) {
  if (url2._scheme && url._scheme === url2._scheme) {
    url = setProto ({ scheme:url2.scheme }, url)
    url2 = setProto ({ scheme:null }, url2)
  }
  const type = Url.leastType (url2)
  for (let [k, v] of url.tokens ()) {
    const c = compareType (k, type)
    if (c < 0 || c === 0 && k === 'dir') yield [k, v]
    else break
  }
  yield* url2.tokens ()
}

function* _force (url) { // NB assumes URL does not have an auth or drive
  const tokens = url.tokens ()
  for (let [k,v] of tokens)
    if (k === 'scheme') yield [k,v]
    else if (k === 'dir' && v !== '' || k === 'file') {
      yield ['auth', parseAuth (v)]
      if (k === 'dir') yield ['root', '/']
      yield* tokens
    }
}


// UTF8 encoding
// =============

let utf8; {
  const [h2, h3, h4, h5] = [ 0b10<<6, 0b110<<5, 0b1110<<4, 0b11110<<3]
  const [t6, t5, t4, t3] = [ ~(-1<<6), ~(-1<<5),  ~(-1<<4),   ~(-1<<3)]
  utf8 = code => {
    if (code < 0x80) return [code]
    else if (code < 0x800) {
      const [c1, c2] = [code >> 6, code & t6]
      return [h3|(t5 & c1), h2|(t6 & c2)]
    }
    else if (code < 0x10000) {
      const [c1, c2, c3] = [code >> 12, code >> 6, code & t6]
      return [h4|(t4 & c1), h2|(t6 & c2), h2|(t6 & c3)]
    }
    else {
      const [c1, c2, c3, c4] = [code >> 18, code >> 12, code >> 6, code & t6]
      return [h5|(t3 & c1), h2|(t6 & c2), h2|(t6 & c3), h2|(t6 & c4)]
    }
  }
}


// Percent Coding
// ==============

// TODO explain

const escapeSets =
  { user:1<<1, pass:1<<2, host:1<<3, port:1<<4, dir:1<<7, file:1<<8, query:1<<9, hash:1<<10 }

const _e = escapeSets
const creds = _e.user | _e.pass
const path = _e.dir | _e.file
const auth = creds | _e.host
const all = auth | path | _e.query | _e.hash

const symbolMap = {
 ' ': all,
 '<': all,
 '>': all,
 '/': auth | path,
 '?': auth | path,
 ':': auth, '@': auth, '[': auth, ']': auth, '^': auth, '\\': auth,
 '`': creds | path | _e.hash,
 '"': creds | path | _e.query | _e.hash,
 '#': creds | path | _e.query,
 '{': creds | path,
 '}': creds | path,
 ';': creds,
 '=': creds,
 '|': creds,
}

const specialSymbolMap = setProto ({
  "'": _e.query,
 '\\': auth | path,
}, symbolMap)

const nonBaseSymbolMap = setProto ({
 ' ': auth | _e.query | _e.hash,
 '<': auth | _e.query | _e.hash,
 '>': auth | _e.query | _e.hash,
 '`': creds | _e.hash,
 '"': creds | _e.query | _e.hash,
 '#': creds | _e.query,
 '{': creds,
 '}': creds,
}, symbolMap)

const _p = n => 
  String.fromCharCode((n < 10 ? 48 : 55) + n)

const _pct = byte =>
  `%${_p (byte >> 4)}${_p (byte & 0b1111)}`

const _encode = ({ ascii=false, percentCoded=false, special=false, nonbase=false } = { }) => (v, k) => {
  if (v == null) return null
  const out = []
  const escapeSet = (k in escapeSets ? escapeSets [k] : 0)
  const symbolMap_ = nonbase ? nonBaseSymbolMap : special ? specialSymbolMap : symbolMap
  for (let char of String (v)) {
    let c = char.codePointAt (0)

    if (!percentCoded && char === '%')
      out.push (...(utf8 (c) .map (_pct)))

    else if (ascii && c > 127)
      out.push (...(utf8 (c) .map (_pct)))

    else {
      const basicLatin = 32 <= c && c <= 126
      const escape = basicLatin && (char in symbolMap_ ? symbolMap_[char] : 0)
      const c0_del_c1 = c <= 31 || c >= 127 && c <= 159
      const surrogate = 0xD800 <= c && c <= 0xDFFF
      const nonchar = 0xFDD0 <= c && c <= 0xFDEF || 
        (c <= 0x10FFFF && ((c >> 1) & 0x7FFF) === 0x7FFF)
      if (escape & escapeSet || c0_del_c1 || surrogate || nonchar)
        out.push (... (utf8 (c) .map (_pct)))
      else 
        out.push (char)
    }
  }
  return out.join ('')
}

// Percent Decoding
// ----------------

const PERCENT = /%([0-9a-fA-F]{2})/g

function decode (value, k) {
  if (value == null) return null
  value = wtf8 .encode (value) .replace (PERCENT, pct => String.fromCharCode (parseInt (pct.substr(1), 16)))
  value = wtf8 .decode (value)
  return value
}


// Url Parsing
// ===========

const specialSchemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
}

const raw = String.raw
const opt = _ => `(?:${_})?`

let parsers; {
  const scheme = raw `([a-zA-Z][A-Za-z0-9+\-.]*):`
  const auth   = raw `[/]{2}([^/#?]*)`
  const sauth  = raw `[/\\]{2}([^/\\#?]*)`
  const root   = raw `([/])`
  const sroot  = raw `([/\\])`
  const path   = raw `([^?#]*)`
  const query  = raw `\?([^#]*)`
  const hash   = raw `#(.*)`
  const tail   = `${path}${opt(query)}${opt(hash)}`
  parsers =
    { splitScheme: new RegExp (`^${opt(scheme)}(.*)$`)
    , relativeUrl: new RegExp (`^${opt(auth)}${opt(root)}${tail}$`)
    , specialRelativeUrl: new RegExp (`^${opt(sauth)}${opt(sroot)}${tail}$`)
  }
}

let authExp; {
  const user  = `([^:]*)`
  const pass  = `:(.*)`
  const creds = `${user}${opt(pass)}@`
  const host  = `([^@:]*)` // TODO ':' IS allowed within brackets
  const port  = `:([^@]*)`
  const auth  = raw `${opt(creds)}${host}${opt(port)}`
  authExp = new RegExp (`^${auth}$`)
}

const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]+/g
const DRIVE = /^[a-zA-Z][:|]$/

function parseAuth (input) {
  let [_, user = null, pass = null, host, port = null] = authExp.exec (input)
  if (/^[0-9]+$/.test (port)) try { port = validators.port (port) } catch (e) {}
  return { user, pass, host, port }
}

function parseUrl (input, type) {
  let [_, scheme, rest] = parsers.splitScheme.exec (input.replace (TRIM, ''))
  type = scheme ? scheme.toLowerCase () : type != null ? type.toLowerCase () : null
  const special = type in specialSchemes
  const urlExp = special ? parsers.specialRelativeUrl : parsers.relativeUrl
  const pathSep = special ? /[/\\]/ : /[/]/
  let [__, auth, root, path, query, hash] = urlExp.exec (rest)
  let dirs = (path || '') .split (pathSep), drive

  // drive detection
  if (type === 'file') {
    if (auth && DRIVE.test (auth))
      [auth, drive] = [null, auth]
    else if (dirs.length && DRIVE.test (dirs[0]))
      [drive, root] = [dirs.shift (), dirs.length ? '/' : null]
  }

  root = root && '/'
  let file = dirs.pop () || null
  const { user, pass, host, port } = auth != null ? parseAuth (auth) : { }
  return { scheme, user, pass, host, port, drive, root, dirs, file, query, hash }
}


Url.Url = Url
module.exports = Url

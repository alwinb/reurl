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

  constructor (input, { percentCoding = 'preserve', parser = 'http' } = { }) {
    const _decoded = { preserve:false, decode:true } [percentCoding]
    if (_decoded == null) throw new Error ('ERR_INVALID_SETTINGS')

    if (typeof input === 'string') {
      input = parseUrl (input, parser)
      return Url.fromIterable (_decoded ? map (input, decode) : entries (input), { _decoded })
    }

    if (input instanceof Url)
      return Url.fromIterable (map (input, _decoded ? decode : encode), { _decoded })

    if (typeof input === 'object' && input !== null)
      return Url.assemble ([], { percentCoded }) .set (input)

    this._scheme = null
    this._decoded = _decoded
    this.query = this.file = this.dirs = this.root =
    this.drive = this.port = this.host = this.user = 
    this.pass = this.scheme = null
  }

  static fromIterable (fields, { _decoded = false } = { }) {
    const r = assemble (fields, new Url ())
    if (!r.root && Url.needsRoot (r)) assign (r, 'root', '/') // sets implicit root
    r._scheme = r.scheme ? r.scheme.toLowerCase () : null
    r._decoded = _decoded
    Url.enforceConstraints (r)
    assign (r, 'href', r.toString ())
    return r
  }

  static fromString (input) {
    return new Url (String (input))
  }

  toString () {
    const enc = this._decoded ? encode : encodeAdditional
    const pre = { user:'//', pass:':', host:'//', port:':', drive:'/', query:'?', hash:'#' }
    const post = { scheme:':', dir:'/'}
    let out = '' /* now consume the iterator for its side effect */
    Array.from (map (this, printToken))
    return out
    /* where */
    function printToken (v, k) {
      if (v == null) return
      if (k === 'user') pre.host = '@'
      out += `${ pre[k] || '' }${ enc (v, k) }${ post[k] || '' }`
    }
  }

  toASCII () {
    // TODO so I'm left with two toString methods; ASCII/WhatWG and WhatWG/unicode
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


  // ### PercentCoding
  
  percentDecoded () {
    if (this._decoded) return this
    return Url.fromIterable (map (this, decode), { _decoded:true })
  }

  percentEncoded () {
    const enc = this._decoded ? encode : encodeAdditional
    return Url.fromIterable (map (this, enc), { _decoded:false })
  }

  parseHost () {
    let host = this.host
    if (!host) return this
    if (host[0] === '[' && host.substr(-1) === ']') {
      // TODO support for ipv6
      return this
    }
    else {
      host = punycode.toUnicode (this._decoded ? host : decode (host))
      try { host = ip4.print (ip4.parse (host)) }
      catch (e) { }
      // TODO how to store the 'parsedHost' metadata?
      let { user, pass, port} = this
      return this.set ({ user, pass, host, port, parsedHost:true })
    }
  }

  // ### Operations

  set (patch) {

    // The patch may contain a setting: percentCoded to signify
    // that the values are 'raw' and may contain percent escape codes. 
    // percentCoded defaults to true in 'preserve' mode and to false in 'decode' mode. 

    const { percentCoded = !this._decoded } = patch

    // First the components of the patch are converted/
    // validated, by passing it through the validators defined below. 

    try {  patch = assemble (map (patch, validators)) }
    catch (e) { throw e }

    // The encoding has to be reconciled with the percentDecoded mode
    // of the Url object if the patch is encoded and the Url isn't, or vice versa. 

    if (this._decoded === percentCoded)
      patch = assemble (map (patch, this._decoded ? decode : encode))

    // If the patch contains a host, all auth components will be reset;
    // if it contains a username, the password will be reset, before the patch is applied. 

    const reset = 'host' in patch
      ? { user:null, pass:null, port:null }
      : 'user' in patch ? { pass:null } : { }

    const r = Url.fromIterable (entries (patch, reset, this), this)

    // Root may have been added implicitly, so check if
    // it was explicitly removed via the patch and if so, err. 

    if ('root' in patch && r.root !== patch.root)
      throw new Error ('ERR_NEEDSROOT')

    return r
  }

  goto (url) { // AKA extend
    if (!(url instanceof Url)) url = new Url (url)
    if (this._decoded !== url._decoded)
      url = this._decoded ? url.percentDecoded () : url.percentEncoded ()
    return Url.fromIterable (_resolve (url, this), this)
  }

  resolve (base) {
    if (!(base instanceof Url)) base = new Url (base)
    if (this._decoded !== base._decoded)
      base = this._decoded ? base.percentDecoded () : base.percentEncoded ()
    return Url.fromIterable (_resolve (this, base), this)
  }


  // Force-coerce an URL to a base URL according to the whatWG URL Standard. 
  // REVIEW should this indeed throw?

  force () {
    if (!this.scheme) throw new Error ('FORCE_ERR_NOSCHEME')
    if (Url.hasSubstantialAuth (this)) return this
    if (this._scheme === 'file') return this.set ({ host:'', root:true })
    // REVIEW Should it be generalised? ie. not check for specialSchemes? => What about drives?
    if (this._scheme in specialSchemes && !this.drive) {
      const url = Url.fromIterable (_force (this), this)
      if (Url.hasSubstantialAuth (url)) return url
      else throw new Error ('FORCE_FAILED')
    }
    return this
  }

  normalize () {
    const scheme = this._scheme
    const auth = Url._normalizeAuth (this, scheme)
    const path = Url._normalizePath (this, scheme)
    const root = scheme in specialSchemes && auth.host != null ? '/' : path.root
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

  static enforceConstraints ({ scheme, user, pass, host, port, drive, _scheme }) {
    if ((!host || _scheme === 'file') && (user != null || port != null))
      throw new Error ('ERR_NOAUTH')

    else if (user == null && pass != null)
      throw new Error ('ERR_NOCREDS')

    if (drive && scheme && _scheme !== 'file')
      throw new Error ('ERR_NONFILE_DRIVE')
  }

  // Private

  static _normalizeAuth ({ user, pass, host, port }, scheme_) {
    if (port === '') port = null
    if (pass === '') pass = null
    if (user === '' && pass === null) user = null
    if (host === 'localhost' && scheme_ === 'file') host = ''
    else if (port != null && scheme_ && port === specialSchemes[scheme_]) port = null
    return { user, pass, host, port }
  }

  static _normalizePath ({ drive, root, dirs, file }, scheme_) {
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
    if (scheme_ === 'file') root = (!drive && !dirs2.length && !file) ? '/' : root // REVIEW root normalisation for file URLs
    return { drive, root, dirs:dirs2.length ? dirs2 : null, file }
  }

}


Url.fromTokens = Url.fromIterable


// ### Input validation

const schemeExp = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const driveExp = /^[a-zA-Z][:|]?$/
const MAX_PORT = Math.pow (2, 16) - 1

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
    v = typeof v !== 'number' && /^[0-9]+$/.test (v) ? +String (v) : v
    if (isNaN (v) || v < 0 || v > MAX_PORT) throw new Error ('ERR_INVALID_PORT')
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

// (record, record) -> tokens
function* _resolve (input, base) {
  if (input._scheme && base._scheme === input._scheme) {
    base = Object.setPrototypeOf ({ scheme:input.scheme }, base)
    input = Object.setPrototypeOf ({ scheme:null }, input)
  }
  const type = Url.leastType (input)
  for (let [k, v] of base.tokens ()) {
    const c = compareType (k, type)
    if (c < 0 || c === 0 && k === 'dir') yield [k, v]
    else break
  }
  yield* input.tokens ()
}

function* _force (url) {
  const tokens = url.tokens ()
  // NB assumes tokens does not contain an auth or drive. 
  for (let [k,v] of tokens)
    if (k === 'scheme') yield [k,v]
    else if (k === 'dir' && v !== '' || k === 'file') {
      yield ['auth', parseAuth (v)]
      yield ['root', '/']
      yield* tokens
    }
}


// Percent Coding
// ==============

//const nonUrl = (...C0, ...DEL, ...C1, ' "#%<>[\\]^`{|}')
// NB new standard defines component encode set with $%&+, added

const c0  = '\x00-\x1F'
const del = '\0x7F'
const c1  = '\0x80-\x9F'
const nonchar = '\uFDD0-\uFDEF'
const nonASCII = '[^\x00-0x7F]'

// TODO: also escape additional nonchars and surrogates
// Question: how do regexps behave on mismatched surrogates?

const escapeSets = 
  { c0:    /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF]+/g // c0, del, c1, nonchar,
  , user:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?{}/\\:@[\];=^|]+/g
  , pass:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?{}/\\:@[\];=^|]+/g
  , host:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF   <>#?  /\\:@[\]  ^ ]+/g
  , file:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?{}/]+/g
  , dir:   /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?{}/]+/g
  , query: /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF  "<>#]+/g
  , hash:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>]+/g
  }
  escapeSets.dir = escapeSets.file

const specialEscapes = setProto (
  { file:  /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?/\\{}]+/g // adds (\)
  , dir:   /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF `"<>#?/\\{}]+/g // adds (\)
  , query: /%|[\x00-\x1F\x7F-\x9F\uFDD0-\uFDEF '"<>#]+/g // adds (')
  }, escapeSets)

const PERCENT = /%([0-9a-fA-F]{2})/g

function decode (value, k) {
  if (value == null) return null
  value = wtf8 .encode (value) .replace (PERCENT, pct => String.fromCharCode (parseInt (pct.substr(1), 16)))
  value = wtf8 .decode (value)
  return value
}

// Does encode % => %25
function encode (v, k = 'c0') {
  return v != null && k in escapeSets ?
      String (v) .replace (escapeSets[k], _replacer) : v
}

// Does not touch % characters
function encodeAdditional (v, k = 'c0') {
  return v != null && k in escapeSets ?
    String (v) .replace (escapeSets[k], c => c === '%' ? c : _replacer (c)) : v
}

function _replacer (span, { additional = false, special = false } = { }) {
  const buff = wtf8.encode (span), out = []
  for (let i=0, l=buff.length; i<l; i++) {
    if (additional && span === '%' || special && span === '\\')
      out.push (c)
    else {
      const c = buff.charCodeAt (i)
      out.push ((c > 0xf ? '%' : '%0') + c.toString (16) .toUpperCase ())
    }
  }
  return out.join ('')
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

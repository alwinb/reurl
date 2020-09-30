"use strict"
const punycode = require ('punycode')
const { parseHost } = require ('./host')
const { utf8, encode, decode } = require ('./pct')
const log = console.log.bind (console)
const setProto = Object.setPrototypeOf

// URLs
// ====

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

function assemble (entries, onto = { percentCoded: false }) {
  for (let [k, v] of entries) {
    if (k === 'dir') {
      if (!onto.dirs) assign (onto, 'dirs', [v])
      else onto.dirs.push (v)
    }
    else if (k === 'auth') assemble (Object.entries (v), onto) // expand auth
    else assign (onto, k, v)
  } return onto
}

function assign (obj, k, value, enumerable = value != null) {
  if (value == null) value = null
  return Object.defineProperty (obj, k, { value, enumerable, configurable:true, writable:false })
}

function build (fields, url) {
  const r = assemble (fields, url)

  if (!url.root && Url.needsRoot (url))
    assign (url, 'root', '/') // sets implicit root

  if (url.scheme)
    assign (url, '_scheme', url.scheme.toLowerCase (), false)

  if (url.dirs && !url.dirs.length)
    assign (url, 'dirs', null)

  Url.enforceConstraints (url)
  return url
}

function mkAuth (obj = { }) {
  const r = {}
  for (let k of ['user', 'pass', 'host', 'port'])
    assign (r, k, obj[k]) // this just to hide the nulls in debug...
  return r
}

const R_DOT    = /^(?:\.|%2e)$/i
const R_DOTS   = /^(?:\.|%2e){2}$/i
const MAX_PORT = 2 ** 16 - 1


// Immutable Url Object
// ====================

class Url {

  constructor (input, { _rawUrl = false, parser = 'http' } = { }) {
    for (let k of fieldNames) assign (this, k, null)
    assign (this, 'percentCoded', _rawUrl)
    assign (this, '_scheme', null)

    if (input == null)
      return this

    if (typeof input === 'object' && !(input instanceof Url))
      return this.set (input)

    if (typeof input === 'string')
      input = parseUrl (input, parser)

    const coded = input.percentCoded === this.percentCoded
      ? entries (input) : map (input, this.percentCoded ? encode () : decode)
    return build (coded, this)
  }

  static fromIt (it) {
    return build (it, new this (null))
  }

  static fromString (input, conf = { }) {
    return new this (String (input), conf)
  }

  toString ({ ascii = false } = { }) {
    const { percentCoded } = this
    const special = Url.isSpecial (this)
    const nonbase = Url.cannotBeBase (this) // 'nonbase' URLs have less characters escaped in path
    const enc = encode ({ percentCoded, special, nonbase, ascii })
    const pre = { user:'//', pass:':', host:'//', port:':', drive:'/', query:'?', hash:'#' }
    const post = { scheme:':', dir:'/'}
    const disamb = this.host == null && this.dirs && this.dirs[0] === ''
    let out = '' /* now consume the iterator for its side effect */
    this.forEach (printItem, this)
    return out
    /* where */
    function printItem (v, k, i) {
      if (v == null) return
      if (k === 'user') pre.host = '@'
      // REVIEW just clean this up at some point
      if (disamb && i == 0 && k === 'dir') v = './' + enc (v, k)
      else if (k !== 'host') v = enc (v, k)
      else if (k === 'host') v
        = v[0] === '[' && v.substr(-1) === ']' ? v
        : special && ascii ? punycode.toASCII (v) .toLowerCase ()
        : !special ? enc (v, k)
        : v
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
      else if (k === 'auth' && this.host != null)
        yield [k, mkAuth (this)]
      else if (this[k] != null) yield [k, this[k]]
    }
  }

  // ## Operations

  // - The patch may contain a setting: percentCoded to signify
  //   that the values may contain percent escape sequences.
  //   Defaults to true in preserve mode and to false in 'decode' mode. 
  // - If the patch contains a host, all auth components will be reset. 
  //   If it contains a username, the password will be reset. 

  set (patch) {
    const { percentCoded = this.percentCoded } = patch
    if (!('percentCoded' in patch))
      patch = setProto ({ percentCoded }, patch)

    // validate schem, drive, root, port, file
    try { patch = assemble (map (patch, validate), { percentCoded }) }
      catch (e) { throw e }

    if (percentCoded !== this.percentCoded) // reconcile percentCoding
      patch = assemble (map (patch, this.percentCoded ? encode () : decode ), { percentCoded: this.percentCoded })

    if ('host' in patch && patch.host != null) {
      // TODO should opaque-hosts be parsed in normalise after updates? Or always?
      try {
        const _scheme = 'scheme' in patch ? patch.scheme.toLowerCase () : this._scheme
        const v = parseHost (patch.host, { percentCoded:this.percentCoded, opaque:Url.isSpecial ({ _scheme }) })
        patch = setProto ({ host:String (v) }, patch)
      }
        catch (e) { throw e }
    }

    const reset = 'host' in patch
      ? { user:null, pass:null, port:null }
      : 'user' in patch ? { pass:null } : { }

    const result = this.constructor.fromIt (entries (patch, reset, this))
    if (result.root && 'root' in patch && !patch.root)
      throw new Error ('ERR_NEEDSROOT') // implied root cannot be removed

    return result
  }

  goto (url) {
    url = new this.constructor (url, { parser:this._scheme })
    return this.constructor.fromIt (_goto (this, url))
  }

  resolve (base) {
    base = new this.constructor (base)
    if (!base.scheme || Url.cannotBeBase (base) && !{ scheme:1, hash:1 } [Url.leastType (this)])
      throw new Error ('ERR_NOT_A_BASE_URL')
    return this.constructor.fromIt (_goto (base, this))
  }

  // Force-coerce an URL to a base URL according to the whatWG URL Standard. 
  // REVIEW should this indeed throw?

  force () {
    if (!this.scheme) throw new Error ('ERR_FORCE_NOSCHEME')
    if (Url.hasSubstantialAuth (this)) return this
    if (this._scheme === 'file') return this.set ({ host:'' })
    // REVIEW Should it be generalised? ie. not check for specialSchemes? => What about drives?
    if (this._scheme in specialSchemes && !this.drive) {
      const result = this.constructor.fromIt (_force (this))
      if (Url.hasSubstantialAuth (result)) return result
      else throw new Error ('ERR_FORCE_FAILED')
    }
    return this
  }

  normalize () {
    const scheme = this._scheme
    const auth = Url._normalizeAuth (this)
    const path = Url._normalizePath (this)
    const root = (scheme in specialSchemes && auth.host != null && !path.drive) ? '/' : path.root
    return this.constructor.fromIt (entries ({ scheme, root }, auth, path, this))
  }

  normalise () {
    return this.normalize ()
  }

  // ## Helpers

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

  static enforceConstraints ({ user, pass, host, port, drive, _scheme }) {
    if ((!host || _scheme === 'file') && (user != null || port != null))
      throw new Error ('ERR_NOAUTH')

    else if (user == null && pass != null)
      throw new Error ('ERR_NOCREDS')

    if (drive && _scheme && _scheme !== 'file')
      throw new Error ('ERR_NONFILE_DRIVE')
  }

  // ## Private

  static _normalizeAuth ({ user, pass, host, port, _scheme, percentCoded }) {
    if (port === '') port = null
    if (pass === '') pass = null
    if (user === '' && pass === null) user = null
    if (host == 'localhost' && _scheme === 'file') host = ''
    else if (port != null && _scheme && port === specialSchemes[_scheme]) port = null
    // host = host == null ? null : parseHost (host, { percentCoded, opaque:_scheme === 'file' || !(_scheme in specialSchemes) , percentCoded })
    return { user, pass, host, port }
  }

  static _normalizePath ({ drive, root, dirs, file, _scheme, percentCoded }) {
    // NB if decoded then don't interpret `%2e%2e` and alike as `..`
    const dirs2 = []
    if (drive) drive = drive [0] + ':'
    for (let x of dirs || []) {
      const dirDots = _dots (x, percentCoded)
      if (dirDots === '..') dirs2.pop ()
      else if (dirDots !== '.') dirs2.push (x)
    }
    const fileDots = file && _dots (file, percentCoded)
    if (fileDots === '.') file = null
    else if (fileDots === '..') {
      dirs2.pop ()
      file = null
    }
    return { drive, root, dirs:dirs2.length ? dirs2 : null, file }
  }

}

// sigh
function _dots (str, percentCoded) {
  if (!percentCoded) return str
  else if (str.length > 6) return str
  else return decode (str)
}


// Raw Url
// =======

class RawUrl extends Url {

  constructor (input, { parser } = { }) {
    super (input, { _rawUrl:true, parser })
  }

}




// ## Input validation

const schemeExp = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const driveExp = /^[a-zA-Z][:|]?$/

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
    if (v === '') return null
    if (typeof v === 'string' && /^[0-9]+$/ .test (v)) v = +v
    if (typeof v !== 'number' || isNaN (v) || v < 0 || v > MAX_PORT)
      throw new Error ('ERR_INVALID_PORT')
    return v
  },

  root (v) { return v ? '/' : null },
  file (v) { return v === '' ? null : v }
}

// ### Generators and implementation details

// Map; expands dirs (but it does not matter)

function* map (obj, fn) {
  for (let [k,v] of entries (obj)) {
    if (k === 'dirs' && v)
      yield ['dirs', v.map (d => fn (d, 'dir', obj))]
    else yield [k, fn (v, k, obj)]
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
      yield ['auth', parseAuth (v, url)]
      if (k === 'dir') yield ['root', '/']
      yield* tokens
    }
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
  const user  = raw `([^:]*)`
  const pass  = raw `:(.*)`
  const creds = raw `${user}${opt(pass)}@`
  const braks = raw `\[[^@\]]*\]`
  const host  = raw `((?:${braks}|[^\[@:]+)*|[^@:]*)` // `([^@:]*)`
  const port  = raw `:([^@]*)`
  const auth  = raw `${opt(creds)}${host}${opt(port)}`
  authExp = new RegExp (`^${auth}$`)
}

const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]+/g
const DRIVE = /^[a-zA-Z][:|]$/

function parseAuth (input) {
  if (input == null) return { }
  let [_, user, pass, host, port] = authExp.exec (input)
  return { user, pass, host, port }
}

function parseUrl (input, type) {
  // log ('parseUrl', {input, type})
  input = input.replace (TRIM, '')
  let [_, scheme, rest] = parsers.splitScheme.exec (input)
  const _scheme = scheme ? scheme.toLowerCase ()
    : type != null ? type.toLowerCase () : null

  const special = _scheme in specialSchemes
  const urlExp = special ? parsers.specialRelativeUrl : parsers.relativeUrl
  const pathSep = special ? /[/\\]/ : /[/]/

  let [__, auth, root, path, query, hash] = urlExp .exec (rest)
  let dirs = (path || '') .split (pathSep)

  // drive detection
  let drive = null
  if (_scheme === 'file') {
    if (auth && DRIVE.test (auth))
      [auth, drive] = [null, auth]
    else if (dirs.length && DRIVE.test (dirs[0]))
      [drive, root] = [dirs.shift (), dirs.length ? '/' : null]
  }

  const file = dirs.pop () || null
  root = root && '/'
  let { user, pass, host, port } = parseAuth (auth)
  const url = { scheme, user, pass, host, port, drive, root, dirs, file, query, hash, percentCoded:true }

  Url.enforceConstraints (url) // Structural constraints
  try { // Content constraints
    url.port = port == null ? null : validators.port (port)
    url.host = host == null ? null : String (parseHost (host, { percentCoded:true, opaque:!(_scheme in specialSchemes) }))
  }
  catch (e) { throw e }
  return url
}

module.exports = { Url, RawUrl }
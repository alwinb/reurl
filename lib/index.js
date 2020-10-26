"use strict"
const punycode = require ('punycode')
const { parseHost } = require ('./host')
const { utf8, encode, decode } = require ('./pct')
const { defineProperty:define, setPrototypeOf:setProto } = Object
const log = console.log.bind (console)
const raw = String.raw

// URLs
// ====

const specialSchemes =
  { ftp: 21, file: null, http: 80, https: 443, ws: 80, wss: 443 }

// In my 'theory of URLs' I have modeled URLs as sequences of tokens,
// where tokens are tuples [type, value] with a natural order on types. 

const tokenTypes = ['scheme', 'auth', 'drive', 'root', 'dir', 'file', 'query', 'hash']
const typeOrd    = { scheme:1, auth:2, drive:3, root:4, dir:5, file:6, query:7, hash:8 }

function compareType (t1, t2) {
  const i1 = typeOrd [t1], i2 = typeOrd [t2]
  return i1 < i2 ? -1 : i1 > i2 ? 1 : 0
}

// There is another representation of URLs as records with nullable fields;
//  where 'dirs', if present, is an array of strings. 

const fieldNames = ['scheme', 'user', 'pass', 'host', 'port', 'drive', 'root', 'dirs', 'file', 'query', 'hash']
const fields = { scheme:1, user:1, pass:1, host:1, port:1, drive:1, root:1, dirs:1, file:1, query:1, hash:1 }


// Immutable Url Object
// ====================

const NO_INIT = Symbol ('NO_INIT')
const RAW_URL = Symbol ('RAW_URL')

class Url {

  // ## Constructors

  constructor (input, { _type, parser = 'http' } = { }) {
    define (this, 'percentCoded', { value:_type === RAW_URL })
    if (input === NO_INIT) return this
    const t = input && typeof input
    return this._init (t === 'string' ? parseUrl (input, parser) : t === 'object' ? input : { })
  }

  static fromString (input, conf = { }) {
    return new this (String (input), conf)
  }

  static fromObject (object) {
    return new this (NO_INIT) ._init (object)
  }

  static fromObjects (...objects) {
    return new this (NO_INIT) ._init (...objects)
  }

  // ## Init

  _init (...objects) {
    const enc = encode ()
    const r = this
    for (let k of fieldNames) { let o, v
      for (let i=0, l=objects.length; i<l; i++)
        if ((o = objects[i]) && (v = o[k]) !== undefined) break
      if (v !== undefined) {
        const { percentCoded = r.percentCoded } = o
        if (!(o instanceof Url) && !isValid.has (o)) v = validate (v, k)
        if (percentCoded !== r.percentCoded) v = percentCoded ? decode (v, k) : enc (v, k)
      }
      else v = null
      define (r, k, { value:v, enumerable:v !== null, configurable:k === 'root' })
    }
    return Core.enforceConstraints (r)
  }

  get _scheme () {
    return this.scheme ? this.scheme.toLowerCase () : null
  }

  // ## Conversions

  get href () {
    return this.toString ({ ascii:true })
  }

  tokens () {
    return Core.tokens (this)
  }

  toString ({ ascii = false } = { }) {
    const { percentCoded } = this
    const special = Core.isSpecial (this)
    const nonbase = Core.cannotBeBase (this) // 'nonbase' URLs have less characters escaped in path
    const enc = encode ({ percentCoded, special, nonbase, ascii })
    const pre = { user:'//', pass:':', host:'//', port:':', drive:'/', query:'?', hash:'#' }
    const post = { scheme:':', dir:'/'}
    const disamb = this.host == null && this.dirs && this.dirs[0] === ''

    let out = '', v
    for (let k of fieldNames) if ((v = this[k]) != null) {
      if (k === 'dirs') for (let i=0, l=v.length; i<l; i++)
        out += printItem (v[i], 'dir', i)
      else
        out += printItem (v, k)
    }
    return out
    /* where */
    function printItem (v, k, i) {
      if (k === 'user') pre.host = '@'
      // REVIEW just clean this up at some point
      if (disamb && i == 0 && k === 'dir') v = './' + enc (v, k)
      else if (k !== 'host') v = enc (v, k)
      else if (k === 'host') v
        = v[0] === '[' && v.substr(-1) === ']' ? v
        : special && ascii ? punycode.toASCII (v) .toLowerCase ()
        : !special ? enc (v, k)
        : v
      return `${ pre[k] || '' }${ v }${ post[k] || '' }`
    }
  }

  toASCII () {
    return this.toString ({ ascii:true })
  }

  toJSON () {
    return this.toString ({ ascii:true })
  }

  // ## Operations

  // - The patch may contain a setting: percentCoded to signify
  //   that the values may contain percent escape sequences.
  //   Defaults to true in preserve mode and to false in 'decode' mode. 
  // - If the patch contains a host, all auth components will be reset. 
  //   If it contains a username, the password will be reset. 

  set (patch) {
    const { percentCoded = this.percentCoded } = patch

    const reset = 'host' in patch
      ? markValid ({ user:null, pass:null, port:null })
      : 'user' in patch ? markValid ({ pass:null }) : { }

    // TODO should opaque-hosts be parsed in normalise after updates? Or always?
    if ('host' in patch && patch.host != null) {
      try {
        const _scheme = 'scheme' in patch ? patch.scheme.toLowerCase () : this._scheme
        // For the time being, leave hosts as opaque in relative URLs
        const v = parseHost (patch.host, { percentCoded, opaque:!_scheme || !Core.isSpecial ({ _scheme }) })
        patch = setProto ({ host:String (v) }, patch)
      }
      catch (e) { throw e }
    }

    const r = new this.constructor (NO_INIT) ._init (patch, reset, this)
    if (r.root && 'root' in patch && !patch.root)
      throw new Error ('ERR_NEEDSROOT') // implied root cannot be removed
    return r
  }

  goto (url2, { strict = false } = { }) {
    const r = markValid ({ })
    let url = this
    url2 = new this.constructor (url2, { parser:this._scheme })

    if (!strict && url2._scheme && url._scheme === url2._scheme) {
      url = setProto ({ scheme:url2.scheme }, url)
      url2 = setProto ({ scheme:null }, url2)
    }
    const ord = Core.orderOf (url2)
    for (let [k, v] of Core.tokens (url)) {
      const c = compareType (k, ord)
      if (c < 0 || c === 0 && k === 'dir') Core.addToken (r, k, v)
      else break
    }
    for (let [k, v] of Core.tokens (url2)) Core.addToken (r, k, v)
    return this.constructor.fromObject (r)
  }

  resolve (base) {
    let resolved
    if (base == null)
      resolved = this.force ()
    else {
      base = new this.constructor (base)
      if (!Core.cannotBeBase (base) || Core.orderOf (this) === 'hash')
        resolved = base .goto (this)
      else resolved = this.force ()
    }
    if (!{ scheme:1, hash:1 } [Core.orderOf (resolved)])
      throw new Error ('ERR_CANNOT_RESOLVE')
    return resolved
  }

  // Force-coerce an URL to a base URL according to the whatWG URL Standard. 
  // REVIEW should this indeed throw?

  force () {
    if (!this.scheme) throw new Error ('ERR_FORCE_NOSCHEME')
    if (Core.hasSubstantialAuth (this)) return this
    if (this._scheme === 'file') return this.constructor.fromObjects (markValid ({ host:'' }), this)

    // REVIEW Should it be generalised? ie. not check for specialSchemes? => What about drives?
    if (this._scheme in specialSchemes && !this.drive) {
      const r = markValid ({ })
      const tokens = Core.tokens (this)
      for (let [k,v] of tokens) {
        if (k === 'scheme') Core.addToken (r, k, v)
        else if (k === 'dir' && v !== '' || k === 'file') {
          Core.addToken (r, 'auth', parseAuth (v, this))
          if (k === 'dir') Core.addToken (r, 'root', '/')
          for (let [k, v] of tokens) Core.addToken (r, k, v)
        }
      }
      if (Core.hasSubstantialAuth (r))
        return this.constructor.fromObject (r)
      else throw new Error ('ERR_FORCE_FAILED')
    }
    return this
  }

  normalize () {
    const scheme = this._scheme
    const auth = markValid (Core.normalizeAuth (this))
    const path = markValid (Core.normalizePath (this))
    const root = (scheme in specialSchemes && auth.host != null && !path.drive) ? '/' : path.root
    return this.constructor.fromObjects (markValid ({ scheme, root }), auth, path, this)
  }

  normalizeAuth () {
    return this.constructor.fromObjects (markValid (Core.normalizeAuth (this)), this)
  }

  normalizePath () {
    return this.constructor.fromObjects (markValid (Core.normalizePath (this)), this)
  }

}

const proto = Url.prototype
Object.defineProperties (proto, {
  normalise : Object.getOwnPropertyDescriptor (proto, 'normalize'),
  normaliseAuth : Object.getOwnPropertyDescriptor (proto, 'normalizeAuth'),
  normalisePath : Object.getOwnPropertyDescriptor (proto, 'normalizePath'),
})


// Raw Url
// =======

class RawUrl extends Url {

  constructor (input, { parser } = { }) {
    super (input, { _type:RAW_URL, parser })
  }

}


// Url Core methods
// ================

class Core {

  // ## Conversions

  static *tokens (record) {
    for (let k of tokenTypes) {
      if (k === 'dir') yield* (record.dirs||[]) .map (_ => ['dir', _])
      else if (k === 'auth' && record.host != null) {
        const auth = { }
        for (let k of ['user', 'pass', 'host', 'port'])
          if (record [k] != null) auth[k] = record[k]
        yield [k, auth]
      }
      else if (record[k] != null) yield [k, record[k]]
    }
  }

  static addToken (record, t, v) {
    if (t === 'dir') {
      if (!record.dirs) record.dirs = [v]
      else record.dirs.push (v)
    }
    else if (t === 'auth') {
      for (let k of ['user', 'pass', 'host', 'port'])
        if (v[k] != null) record[k] = v[k]
        else delete record[k]
    }
    else if (t in typeOrd)
      record [t] = v
    return record
  }

  static enforceConstraints (obj) {
    const { user, pass, host, port, drive, _scheme } = obj
    const root = obj.root || Core.needsRoot (obj) ? '/' : null
    Object.defineProperty (obj, 'root', { value:root, enumerable:!!root })

    if ((!host || _scheme === 'file') && (user != null || port != null))
      throw new Error ('ERR_NOAUTH')

    else if (user == null && pass != null)
      throw new Error ('ERR_NOCREDS')

    if (drive && _scheme && _scheme !== 'file')
      throw new Error ('ERR_NONFILE_DRIVE')

    return obj
  }

  // ## Predicates

  static orderOf (url) {
    for (const [k] of Core.tokens (url)) return k
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
    return host == null && !root
  }

  static isSpecial ({ _scheme }) {
    return _scheme == null || _scheme in specialSchemes
  }
  
  // ## Operations

  static normalizeAuth ({ user, pass, host, port, _scheme, percentCoded }) {
    if (port === '') port = null
    if (pass === '') pass = null
    if (user === '' && pass === null) user = null
    if (host == 'localhost' && _scheme === 'file') host = ''
    else if (port != null && _scheme && port === specialSchemes[_scheme]) port = null
    // host = host == null ? null : parseHost (host, { percentCoded, opaque:_scheme === 'file' || !(_scheme in specialSchemes) , percentCoded })
    return { user, pass, host, port }
  }

  static normalizePath ({ drive, root, dirs:dirs0, file, percentCoded }) {
    if (drive) drive = drive [0] + ':'
    if (root) root = '/'
    const dirs = []
    for (let x of dirs0 || []) {
      // if decoded then don't interpret `%2e%2e` as 'move up'. 
      const dirDots = _dots (x, percentCoded)
      if (dirDots === '..') dirs.pop ()
      else if (dirDots !== '.') dirs.push (x)
    }
    const fileDots = file && _dots (file, percentCoded)
    if (fileDots === '.') file = null
    else if (fileDots === '..') {
      dirs.pop ()
      file = null
    }
    return { drive, root, dirs:dirs.length ? dirs : null, file }
  }
}

// sigh
function _dots (str, percentCoded) {
  if (!percentCoded) return str
  else if (str.length > 6) return str
  else return decode (str)
}


// Input validation
// ================

const schemeExp = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const driveExp = /^[a-zA-Z][:|]?$/
const portExp =  /^[0-9]*$/
const MAX_PORT = 2 ** 16 - 1

const isValid = new WeakSet ()
const markValid = o => (isValid.add (o), o)

const validate = (v, k, obj) =>
  v == null ? null : !(k in validators) ? v
  : validators [k] (v, k, obj)

const validators = {

  scheme (v) {
    const match = schemeExp.exec (v)
    if (match) return match[1]
    else throw new Error ('ERR_INVALID_SCHEME')
  },

  drive (v) {
    if (driveExp.exec (v)) return (v + ':') .substr (0,2)
    else throw new Error ('ERR_INVALID_DRIVE')
  },

  port (v) {
    if (v === '') return ''
    if (typeof v === 'string' && portExp.test (v)) v = +v
    if (typeof v === 'number' && !isNaN (v) && 0 <= v && v <= MAX_PORT) return v
    else throw new Error ('ERR_INVALID_PORT')
  },

  dirs (v) { return Array.isArray (v) && v.length ? v : null },
  root (v) { return v ? '/' : null },
  file (v) { return v === '' ? null : v }
}



// Url Parsing
// ===========

const TRIM = /^[\x00-\x1F\x20]+|[\x00-\x1F\x20]+$|[\t\n\r]+/g
const SCHEME = /^(?:([a-zA-Z][A-Za-z0-9+\-.]*)[:])?(.*)$/
const DRIVE = /^[a-zA-Z][|:]$/

let REL, SREL, AUTH; {
  const opt  = _ => '(?:' + _ + ')?'
  const authStr  = raw `[/]{2}([^/#?]*)`
  const sauthStr = raw `[/\\]{2}([^/\\#?]*)`
  const user     = '([^:]*)'
  const pass     = '[:](.*)'
  const creds    = user + opt(pass) + '[@]'
  const host     = raw `(\[[^@]*\]|[^@:]*)`
  const port     = '[:]([^@]*)'
  const root     = raw `([/])`
  const sroot    = raw `([/\\])`
  const path     = `([^?#]*)`
  const query    = `[?]([^#]*)`
  const hash     = `[#](.*)`
  const tail     = path + opt (query) + opt (hash)
  REL  = new RegExp ('^' + opt( authStr) + opt( root) + tail + '$')
  SREL = new RegExp ('^' + opt(sauthStr) + opt(sroot) + tail + '$')
  AUTH = new RegExp ('^' + opt(creds) + host + opt(port)  + '$')
}

function parseAuth (input) {
  const parts = input == null ? [] : AUTH.exec (input)
  const [_, user = null, pass = null, host, port = null] = parts
  return { user, pass, host, port }
}

function parseUrl (input, type) {
  // log ('parseUrl', {input, type})
  input = input.replace (TRIM, '')
  const [_, scheme = null, rest] = SCHEME.exec (input)
  const _scheme = scheme ? scheme.toLowerCase ()
    : type != null ? type.toLowerCase () : null

  const [urlExp, pathSep] = _scheme in specialSchemes
    ? [SREL, /[/\\]/] : [REL , /[/]/]

  let [__, authStr, root, path, query, hash] = urlExp .exec (rest) .map (_ => _ == null ? null : _)
  let dirs = (path || '') .split (pathSep)

  // drive detection
  let drive = null
  if (_scheme === 'file') {
    if (authStr && DRIVE.test (authStr))
      [authStr, drive] = [null, authStr]
    else if (dirs.length && DRIVE.test (dirs[0]))
      [drive, root] = [dirs.shift (), dirs.length ? '/' : null]
  }

  const file = dirs.pop () || null
  dirs = !dirs.length ? null : dirs
  let { user, pass, host, port } = parseAuth (authStr)
  const url = { scheme, user, pass, host, port, drive, root, dirs, file, query, hash, percentCoded:true }

  try {
    // For the time being, leave hosts as opaque in relative URLs
    url.host = host == null ? null : String (parseHost (host, { percentCoded:true, opaque:!_scheme || !(_scheme in specialSchemes) }))
    url.port = port == null ? null : validators.port (port)
    //Core.enforceConstraints (url)
  }
  catch (e) { throw e }
  return markValid (url)
}


module.exports = { Url, RawUrl, parseUrl }
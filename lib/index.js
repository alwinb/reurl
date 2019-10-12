const wtf8 = require ('wtf-8')
const { printAuth, parseAuth, printUrl, parseUrl, specialSchemes, tokenTypes, compareType } = require ('./core')
const { AUTH, DIR, ROOT } = require ('./core')
const log = console.log.bind (console)

//
//  Immutable Url Object
//

class Url {

  // TODO add 'preEncodedValues' option

  constructor (input = null, options) {
    const store = input instanceof MutableUrl ? input : new MutableUrl
    options = options instanceof UrlConfig ? options : new UrlConfig (options)

    if (typeof input === 'string')
      store.addTokens (parseUrl (input, options))

    else if (input && typeof input === 'object' && !(input instanceof MutableUrl))
      store.set (input)

    Object.defineProperty (this, 'options', { value: options })
    Object.defineProperty (this, 'store', { value: store })
    Object.defineProperty (this, 'href', { value: String (store), writable:false, enumerable:true })
  }

  static fromString (input, conf) {
    return new Url (String (input), conf)
  }

  static fromObject (patch, conf) {
    return new Url (null, conf) .set (patch)
  }

  static fromTokens (tokens, conf) {
    return new Url (new MutableUrl () .addTokens (tokens), conf)
  }

  // Getters

  get scheme () { return this.store.scheme }
  get user   () { return this.store.user   }
  get pass   () { return this.store.pass   }
  get host   () { return this.store.host   }
  get port   () { return this.store.port   }
  get drive  () { return this.store.drive  }
  get root   () { return this.store.root   || this.store.needsRoot () ? '/' : null }
  get file   () { return this.store.file   }
  get query  () { return this.store.query  }
  get hash   () { return this.store.hash   }

  get directory () { return [...this.store.dirs ] }
  get authority () { const { user, pass, host, port } = this.store; return { user, pass, host, port } }

  // Setters

  set (patch = { }) {
    return new Url (this.store.clone () .set (patch), this.options)
  }

  setDirectory (...dirs) {
    const mutable = this.store.clone ()
    mutable.dirs = []
    for (let x of dirs) mutable.dirs.push (String (x))
    return new Url (mutable, this.options)
  }


  // Operations

  goto (url2) { // TODO: (optional) add strict mode via conf { strict:true }
    if (!(url2 instanceof Url)) {
      const { backslashes, drive } = this.options
      url2 = new Url (url2, { backslashes, drive, scheme:this.scheme })
    }
    const leastType = url2.store.getLeastType ({ ignoreScheme: this.scheme })
    const mutableUrl = new MutableUrl ()
    for (let token of this) {
      let [k] = token
      const c = compareType (k, leastType)
      if (c < 0 || c === 0 && k === DIR) mutableUrl .addToken (token)
      else break
    }
    mutableUrl.addTokens (url2)
    return new Url (mutableUrl, this.options)
  }

  normalize () {
    const mutable = new MutableUrl ()
    let { scheme, port } = this.store
    scheme = scheme != null ? scheme.toLowerCase () : null
    port = port != null && /^[0-9]+$/.test (port) ? +port : port == '' ? null : port

    const { user, pass, host, drive, root, dirs, file, query, hash } = this.store
    mutable.scheme = scheme
    mutable.pass = pass === '' ? null : pass
    mutable.user = user === '' && mutable.pass == null ? null : user
    mutable.host = scheme === 'file' && host === 'localhost' ? '' : host
    mutable.port = scheme in specialSchemes && port === specialSchemes [scheme] ? null : port
    mutable.drive = drive != null ? drive[0] + ':' : null

    for (let x of dirs) {
      // TODO interpret %2e too
      if (x == '..') mutable.dirs.pop ()
      else if (x !== '.') mutable.dirs.push (x)
    }
    if (file === '..') {
      mutable.dirs.pop ()
      mutable.file = null
    }
    else if (file !== '.')
      mutable.file = file

    mutable.root
      = scheme === 'file' ? (!mutable.drive && !mutable.dirs.length && !mutable.file) || root
      : scheme in specialSchemes && host != null || root

    mutable.query = query
    mutable.hash = hash
    return new Url (mutable, this.options)
  }

  force () {
    if (!this.store.scheme) return this
    // throw new TypeError (`cannot force a schemeless URL ${this}`)
    let scheme = this.store.scheme.toLowerCase ()

    //log ('--- force', ...this, this.store.host == null, this.set ({ host:'' }))
    if (scheme === 'file')
      return this.store.host == null ? this.set ({ host:'' }) : this

    if (scheme in specialSchemes && !this.store.hasSubstantialAuth ()) {
      const dirs = this.store.dirs.concat () // TODO cleanup
      while (dirs.length && dirs[0] === '') dirs.shift ()

      if (dirs.length) {
        const { user, pass, host, port } = parseAuth (dirs.shift ())
        return this.set ({ user, pass, host, port, directory:dirs })
      }

      else if (this.file) {
        const { user, pass, host, port } = parseAuth (this.file)
        return this.set ({ user, pass, host, port, file:null })
      }
    }

    return this
  }

  // Representations

  tokens () {
    return this.store.tokens ()
  }

  [Symbol.iterator] () {
    return this.store.tokens ()
  }

  toString () {
    return this.href
  }

  valueOf () {
    return this.href
  }

  toJSON () {
    return this.href
  }

}

Url.prototype.join = Url.prototype.goto
Url.prototype.normalise = Url.prototype.normalize



//
//  URL configuration object
//

class UrlConfig {

  constructor (obj) {
    obj = typeof obj === 'string' ? { scheme: obj } : obj == null || typeof obj !== 'object' ? {} : obj
    this.scheme = 'scheme' in obj ? obj.scheme : null
    this.backslashes = UrlConfig.wrap (obj.backslashes, UrlConfig.backslashesDefault)
    this.drive = UrlConfig.wrap (obj.drive, UrlConfig.driveDefault)
  }

  static backslashesDefault (scheme) {
    return scheme == null || scheme in specialSchemes
  }
  
  static driveDefault (scheme) {
    return scheme === 'file'
  }

  static wrap (input, fallback) {
    const type = typeof input
    if (type === 'boolean') return scheme => input
    else if (type === 'function') return scheme => {
      const bool = input (scheme)
      return bool === true || bool === false ? bool : fallback (scheme)
    }
    else return fallback
  } 

}



//
//  MutableUrl, internals
//

const _R_SCHEME = /^([A-Za-z][A-Za-z0-9+\-.]*)[:]?$/
const _R_DRIVE = /^([a-zA-Z])([:|])?$/
const _MAX_PORT = Math.pow (2, 16) - 1

const ERR_INVALID = Symbol ('ERR_INVALID')
const ERR_NOAUTH = Symbol ('ERR_NOAUTH')
const ERR_NOUSER = Symbol ('ERR_NOUSER')
const ERR_HASROOT = Symbol ('ERR_HASROOT')

const _patchKeys = ['scheme', 'host', 'port', 'user', 'pass', 'drive', 'file', 'query', 'hash', 'root']

function* _dirit (arg) {
  if (arg == null) return
  if (arg != null && typeof arg !== 'string' && (Symbol.iterator in arg))
    for (let x of arg) yield String (x)
  else yield String (arg)
}


class MutableUrl {
  
  constructor () {
    this.scheme = null
    this.user = null
    this.pass = null
    this.host = null
    this.port = null
    this.drive = null
    this.root = null
    this.dirs = []
    this.file = null
    this.query = null
    this.hash = null
  }

  getLeastType ({ ignoreScheme = null } = { }) {
    if (ignoreScheme != null) ignoreScheme = ignoreScheme.toLowerCase ()
    for (let token of this) if (token[0] !== 'scheme' || ignoreScheme !== token[1].toLowerCase ()) return token[0]
    return 'hash'
  }

  hasSubstantialAuth () {
    return this.host || this.user || this.pass || (this.port != null && this.port != '')
  }

  needsRoot () {
    return (this.host != null || this.drive) && (this.dirs.length || this.file)
  }

  clone (patch = { }) {
    const mutable = new MutableUrl ()
    for (let k of Object.keys (this)) mutable [k] = this [k]
    mutable.dirs = [...mutable.dirs]
    return mutable
  }

  set (patch = { }) {
    if ('host' in patch) this.user = this.pass = this.port = null
    else if ('user' in patch) this.pass = null

    for (let k of _patchKeys) if (k in patch)
      this [k] = this.validateKey (k, patch [k])

    if ('directory' in patch)
      this.dirs = [..._dirit (patch.directory)]

    return this
  }

  addTokens (tokens) {
    for (let token of tokens) this.addToken (token)
    return this
  }

  addToken ([k, v]) {
    if (k === AUTH) {
      const { user = null, pass = null, host, port = null } = v
      Object.assign (this, { user, pass, host, port })
    }
    else if (k === DIR)
      this.dirs.push (v)
    else if (k !== 'dirs' && Object.hasOwnProperty.call (this, k))
      this [k] = v
    return this
  }

  validateKey (k, v) {
    const result = v == null && k !== 'root' ? null : this._validateKey (k, v)
    if (result === ERR_INVALID) throw new TypeError (`invalid ${k} value: ${JSON.stringify (v)}`)
    if (result === ERR_NOAUTH)  throw new TypeError (`cannot set { ${k}: ${JSON.stringify (v)} } on hostless URL <${this}>`) 
    if (result === ERR_NOUSER)  throw new TypeError (`cannot set password without setting username, on URL <${this}>`)
    if (result === ERR_HASROOT) throw new TypeError (`cannot remove path-root from URL <${this}>`)
    return result
  }

  _validateKey (k, v) { switch (k) {
    case 'scheme':
      v = _R_SCHEME.exec (v)
      return v == null ? ERR_INVALID : v [1]

    case 'user':
      return this.host == null ? ERR_NOAUTH : String (v)

    case 'pass':
      return this.host == null ? ERR_NOAUTH : this.user == null ? ERR_NOUSER : String (v)

    case 'port':
      if (this.host == null) return ERR_NOAUTH
      v = typeof v !== 'number' ? +String (v) : v
      return v !== v || v < 0 || v > _MAX_PORT ? ERR_INVALID : v

    case 'drive':
      v = _R_DRIVE.exec (v)
      return v == null ? ERR_INVALID : v [1] + (v [2] || ':')

    case 'root':
      v = v === false ? null : v === true ? '/' : v == null ? null : v
      return v !== null && v !== '/' ? ERR_INVALID : !v && this.needsRoot () ? ERR_HASROOT : v

    case 'dir':
    case 'file':
      v = String (v)
      return !v.length ? ERR_INVALID : v

    default:
      return String (v)
  }}

  *tokens () {
    for (let k of tokenTypes) switch (k) {
      case AUTH:
        if (this.host != null) {
          const { user, pass, host, port } = this
          yield [AUTH, { user, pass, host, port }] }
        break

      case DIR:
        for (let dir of this.dirs) yield [DIR, dir]
        break

      case ROOT:
        if (this.root || this.needsRoot ()) yield [ROOT, '/']
        break

      default:
        if (this [k] != null) yield [k, this [k]]
    }
  }

  [Symbol.iterator] () {
    return this.tokens ()
  }

  toString () {
    return printUrl (this)
  }

}

module.exports = Url
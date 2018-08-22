"use strict"
const core = require ('./core')
const { SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG, select } = core
const log = console.log.bind (console)


// Parse individual components

const _R_SCHEME = /^[A-Za-z][A-Za-z0-9+\-.]*$/
const _R_DRIVE = /^[a-zA-Z][:|]?$/
const _MAX_PORT = Math.pow (2, 16) - 1

function coerceScheme (v) {
  if (typeof v != 'string' || !_R_SCHEME.test (v))
    throw new TypeError ('invalid scheme string: ' + JSON.stringify (v))
  return v
}

function coercePort (v) {
  const n = parseInt (v, 10)
  if (n !== n || n < 0 || n > _MAX_PORT)
    throw new TypeError ('invalid port: '+ JSON.stringify (v))
  return n
}

function coerceDrive (v) {
  if (typeof v !== 'string' || !_R_DRIVE.test (v)) 
    throw new TypeError ('invalid drive string: ' + JSON.stringify (v))
  return (v + ':') .substr (0, 2)
}

function coerceFile (v) {
  if (typeof v !== 'string' || v === '') 
    throw new TypeError ('invalid file string: ' + JSON.stringify (v))
  return v
}

function coerceCredentials (name, pass) {
  if (name == null) throw new TypeError ('credentials require a username')
  if (pass != null) pass = String (pass)
  return { user: String (name), pass: pass }
}

function coerceHost (name, port) {
  if (name == null) throw new TypeError ('host requires a hostname')
  if (port != null) port = coercePort (port)
  return { host: String (name), port }
}



// ReUrl API
// ---------

class ReUrl {

  constructor (url, conf) {
    if (arguments.length) {
      this._tokens = url == null ? []
        : url instanceof ReUrl ? url._tokens
        : core.parse (String (url), conf)
      this._href = core.print (this._tokens)
      this._conf = conf
    }
  }

  // Conversions

  static fromString (string, conf) {
    return new ReUrl (string, conf)
  }

  static fromArray (tokens, conf) {
    const r = new ReUrl ()
    r._tokens = tokens
    r._href = core.print (tokens)
    r._conf = conf
    return r
  }

  fromArray (tokens) {
    return ReUrl.fromArray (tokens, this._conf)
  }

  get href () {
    return this._href
  }

  valueOf () {
    return this._href
  }

  toString () {
    return this._href
  }

  toJSON () {
    return this._href
  }

  toArray () {
    // TODO return a deep copy?
    return this._tokens
  }

  // Private helpers
  _set (type, fn_or_value) {
    return ReUrl.fromArray (core.select (this._tokens, type) .set (fn_or_value), this._conf)
  }
  
  _select (type) {
    return core.select (this._tokens, type)
  }

  // Getters

  get scheme () {
    return select (this._tokens, SCHEME) .value
  }
  
  get username () {
    return select (this._tokens, AUTH) .get (_ => _.user)
  }
  
  get password () {
    return select (this._tokens, AUTH) .get (_ => _.pass)
  }
  
  get hostname () {
    return select (this._tokens, AUTH) .get (_ => _.host)
  }

  get port () {
    return select (this._tokens, AUTH) .get (_ => _.port)
  }

  get root () {
    return select (this._tokens, ROOT) .found ? '/' : null
  }

  get drive () {
    return select (this._tokens, DRIVE) .value
  }

  get file () {
    return select (this._tokens, FILE) .value
  }

  get query () {
    return select (this._tokens, QUERY) .value
  }
  
  get fragment () {
    return select (this._tokens, FRAG) .value
  }

  // get path () {
  //   return ReUrl.fromArray (core._path (this._tokens))
  // }
  // get directory
  // get unixPath

  // 'Setters'

  withScheme (v) { 
    return this._set (SCHEME, coerceScheme (v))
  }

  withCredentials (name, pass) {
    if (this.hostname == null)
      throw new TypeError ('Cannot add credentials to <'+this.href+'> (URL has no authority component)')
    const creds = coerceCredentials (name, pass)
    return this._set (AUTH, _ => Object.assign (_, creds))
  }

  withHost (name, port) { // alias withAuthority
    const next = this._select (AUTH) .next ()
    if (this.hostname == null && next && (next.type === FILE || next.type === DIR))
      throw new TypeError ('Cannot add host to <'+this._href+'> (URL has a relative path)')
    const host = coerceHost (name, port)
    return this._set (AUTH, _ => Object.assign (_||{}, host))
  }

  withPort (port) {
    if (this.hostname == null)
      throw new TypeError ('Cannot set the port of <'+this.href+'> (URL has no authority component)')
    port = coercePort (port)
    return this._set (AUTH, _ => Object.assign (_, { port }))
  }

  withDrive (v) { 
    const next = this._select (DRIVE) .next ()
    if (!this.drive && next && (next.type === FILE || next.type === DIR))
      throw new TypeError ('Cannot add drive to <'+this.href+'> (URL has a relative path)')
    v = coerceDrive (v)
    return this._set (DRIVE, v)
  }

  withRoot () {
    return this._set (ROOT, '/')
  }

  withFile (v) {
    v = coerceFile (v)
    const file = this._select (FILE)
      , prev = file.prev ()
    if (prev && (prev.type === DRIVE || prev.type === AUTH))
      throw new TypeError ('Cannot add file to <'+this.href+'> (URL has no path root)')
    return this.fromArray (file .set (v))
  }

  withQuery (v) {
    if (v == null) v = ''
    return this._set (QUERY, String (v))
  }

  // TODO with path, directory
  // withPath (path) {
  // }
  // withDirectory (v) {
  //  return this._set (DIR, String (v))
  // }

  // TODO file path conversions
  // withUnixPath (v) {
  //   // dir separator: /[/]+/
  //   // (do my own parse)
  // }

  withFragment (v) { 
    if (v == null) v = ''
    return this._set (FRAG, String (v))
  }


  // 'Unsetters'

  dropScheme () {
    return this._set (SCHEME, null)
  }

  dropCredentials () {
    return this._set (AUTH, _ => Object.assign (_, { user:null, pass:null }))
  }

  dropAuthority () { // Alias, dropHost
    return this._set (AUTH, null)
  } 

  dropPort () {
    return this._set (AUTH, _ => Object.assign (_, { port:null }))
  }

  dropDrive () {
    return this._set (DRIVE, null)
  }

  dropRoot () {
    const s = this._select (ROOT)
    const p = s.prev (), n = s.next ()
    if (!p || !n || p.type !== AUTH && p.type !== DRIVE || n.type !== DIR && n.type !== FILE)
      return this._set (ROOT, null)
    else throw new TypeError ('Cannot drop the root from <'+this._href+'>; required by the '+p.type+'.')
  }

  dropDirectory () {
    return this._set (DIR, null)
  }

  dropFile () {
    return this._set (FILE, null)
  }

  dropQuery () {
    return this._set (QUERY, null)
  }

  dropFragment () {
    return this._set (FRAG, null)
  }
  
  // dropPath?


  // Operations

  goto (other) {
    other = other instanceof ReUrl ? other : new ReUrl (other, this._conf)
    return other.fromArray (core.join (this._tokens, other._tokens))
  }

  normalize () {
    return this.fromArray (core.normalize (this._tokens))
  }

  resolve (base) {
    base = base instanceof ReUrl ? base : new ReUrl (base, this._conf)
    return this.fromArray (core.resolve (this._tokens, base._tokens))
  }
  
  force () {
    return this.fromArray (core.force (this._tokens))
  }

  forceResolve (base) {
    base = base instanceof ReUrl ? base : new ReUrl (base, this._conf)
    return this.fromArray (core.forceResolve (this._tokens, base._tokens))
  }

  // toFilePath: function () {},
  // changeRoot: function () {},
  // relativeTo: function () {},

  // Validation, for the time being..
  get failure () {
    // TODO: The check on the credentials should be done before normalize? in the auth parser.. ?
    let p = this.port, s = this.scheme
    let validPort = p == null || typeof p === 'number' && p <= Math.pow (2, 16) - 1
    let validAuth = s !== 'file' || (this.username == null && p == null)
    let validCreds = this.username == null || this.hostname !== ''
    let validHostname = (!(s in core.specialSchemes) || s === 'file') || this.hostname !== ''
    return !(validPort && validCreds && validAuth && validHostname)
  }

}

// Aliases

ReUrl.prototype.join = ReUrl.prototype.goto
ReUrl.prototype.normalise = ReUrl.prototype.normalize

ReUrl.prototype.dropHost = ReUrl.prototype.dropAuthority
ReUrl.prototype.dropAuth = ReUrl.prototype.dropAuthority
ReUrl.prototype.withAuthority = ReUrl.prototype.withHost
ReUrl.prototype.withAuth = ReUrl.prototype.withHost


// Exports

module.exports = ReUrl
if (typeof window !== 'undefined') window.ReUrl = ReUrl
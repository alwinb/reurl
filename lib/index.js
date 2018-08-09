"use strict"
const core = require ('./core')
const { SCHEME, AUTH, DRIVE, ROOT, DIR, FILE, QUERY, FRAG, select } = core
const log = console.log.bind (console)


// Parse individual components

const _R_SCHEME = /^[A-Za-z][A-Za-z0-9+\-.]*$/
const _R_DRIVE = /^[a-zA-Z][:|]?$/
const _MAX_PORT = Math.pow (2, 16) - 1
const _ROOT_VALUE = '/'

function coerceScheme (v) {
  if (typeof v != 'string' || !_R_SCHEME.test (v))
    throw new TypeError ('invalid scheme string: ' + JSON.stringify (v))
  return v
}

function coercePort (v) {
  const n = +v
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
  return { hostname: String (name), port: coercePort (port) }
}



// ReUrl API
// ---------
// The ReUrl object is just an object wrapper around the core library,
// to provide a more typical, javascript-y API. 

class ReUrl {
  
  constructor (url, conf) {
    if (arguments.length) {
      this._tokens
        = url == null ? []
        : url instanceof ReUrl ? url._tokens
        : typeof url === 'string' ? core.parse (url, conf)
        : core.parse (String (url), conf)
        this._href = core.print (this._tokens)
    }
  }


  // Conversions

  static fromArray (tokens) {
    const r = new ReUrl ()
    r._tokens = tokens
    r._href = core.print (tokens)
    return r
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
    return ReUrl.fromArray (core.select (this._tokens, type) .set (fn_or_value))
  }

  // Getters

  get scheme () {
    return select (this._tokens, SCHEME) .value
  }
  
  get username () {
    return select (this._tokens, AUTH) .get (_ => _.name)
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
    return select (this._tokens, ROOT) .found ? _ROOT_VALUE : null
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
  // get directory, get root?

  // 'Setters'

  withScheme (v) { 
    return this._set (SCHEME, coerceScheme (v))
  }

  withCredentials (name, pass) {
    const creds = coerceCredentials (name, pass)
    return this._set (AUTH, _ => Object.assign (_, creds))
  }

  withHost (name, port) { // alias withAuthority
    const host = coerceHost (name, port)
      , auth = select (this._tokens, AUTH)
      , next = auth.next ()
    if (next && (next.type === FILE || next.type === DIR))
      throw new TypeError ('Cannot add host to <'+this._href+'>; URL has a relative path.')
    return ReUrl.fromArray (auth .set (_ => Object.assign (_, host)))
  }

  withPort (port) {
    port = coercePort (port)
    return this._set (AUTH, _ => Object.assign (_, { port }))
  }

  withDrive (v) { 
    v = coerceDrive (v)
    const drive = select (this._tokens, DRIVE)
      , next = drive.next ()
    if (next && (next.type === FILE || next.type === DIR))
      throw new TypeError ('Cannot add drive to <'+this._href+'>; URL has a relative path.')
    return ReUrl.fromArray (drive .set (v))
  }

  withRoot () {
    log (select (this._tokens, ROOT))
    return this._set (ROOT, _ROOT_VALUE)
  }

  withFile (v) {
    // TODO: question, should root be added implicitly?
    v = coerceFile (v)
    const file = select (this._tokens, FILE)
      , prev = file.prev ()
    if (prev && (prev.type === DRIVE || prev.type === AUTH))
      throw new TypeError ('Cannot add file to <'+this._href+'>; URL has no path root.')
    return ReUrl.fromArray (file .set (v))
  }

  withQuery (v) {
    if (v == null) v = ''
    return this._set (QUERY, String (v))
  }

  withFragment (v) { 
    if (v == null) v = ''
    return this._set (FRAG, String (v))
  }

  // withPath (path) {
  // }
  // withDirectory ?

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

  dropRoot () { // ignored if required
    const s = select (this._tokens, ROOT)
    const p = s.prev (), n = s.next ()
    if (!p || !n || p.type !== AUTH && p.type !== DRIVE || n.type !== DIR && n.type !== FILE)
      return this._set (ROOT, null)
    else throw new TypeError ('Cannot drop the root from <'+this._href+'>; required by the '+p.type+'.')
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
  
  //dropDirectory () {
  //  return this._set (DIR, null)
  //}
  // dropPath?


  // Operations

  goto (other) {
    // TODO store conf and use that? 
    // TODO parse PATH instead of URL?
    const _other = typeof other === 'string'
      ? core.parse (other, this.scheme)
      : other._tokens
    return ReUrl.fromArray (core.join (this._tokens, _other))
  }

  normalize () {
    return ReUrl.fromArray (core.normalize (this._tokens))
  }

  force (scheme) {
    return ReUrl.fromArray (core.force (this._tokens, scheme))
  }

  resolve (other) {
    // TODO, store conf and use that ?
    const _other = typeof other === 'string'
      ? core.parse (other, this.scheme)
      : other._tokens
    return ReUrl.fromArray (core.resolve (this._tokens, _other))
  }

  // toFilePath: function () {},
  // changeRoot: function () {},
  // relativeTo: function () {},

  // Validation
  // get failure () {
  //   // For the time being..
  //   // TODO: The check on the credentials should be done before normalize?
  //   // e.g. in the auth parser..
  //   let p = this.port, s = this.scheme
  //   let validPort = p == null || typeof p === 'number' && p <= Math.pow (2, 16) - 1
  //   let validAuth = s !== 'file' || (this.username == null && p == null)
  //   let validCreds = this.username == null || this.hostname !== ''
  //   let validHostname = (!(s in core.specialSchemes) || s === 'file') || this.hostname !== ''
  //
  //   return !(validPort && validCreds && validAuth && validHostname)
  // }

}

// Aliases

ReUrl.prototype.join = ReUrl.prototype.goto
ReUrl.prototype.dropHost = ReUrl.prototype.dropAuthority
ReUrl.prototype.withAuthority = ReUrl.prototype.withHost



module.exports = ReUrl
if (typeof window !== 'undefined') window.ReUrl = ReUrl


var u = new ReUrl ('foo://localhost').join('/bar/../foo').normalize ()
//log (u.withCredentials ('me', '').withPort(129).dropCredentials().dropPort().goto('/baz/bee/boo').withScheme('b00').dropHost().dropScheme().withDrive('C'))
log(new ReUrl ('foo://use@bee:10').withRoot().withDrive('d').withFile('asfdf').dropRoot())


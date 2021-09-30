import * as core from 'spec-url'
const log = console.log.bind (console)
const { setPrototypeOf:setProto, freeze } = Object

// ReUrl API
// =========

// A very thin wrapper around spec-url!
// However, I do want to add set, and percentCodied

class Url {

  constructor (obj = {}, { parser = 'http' } = { }) {
    const r = prepare (obj, this, parser)
    return r instanceof Url ? r : url ({}, this) .set (r)
  }

  get href () {
    return this.toString ({ ascii:true }) }

  get percentCoded () {
    return false }

  // ### Goto

  goto (other) {
    other = prepare (other, this, this.scheme)
    return url (core.goto (this, other), this) }

  // ### Base URLs

  isBase () {
    return core.isBase (this) }

  forceAsFileUrl () {
    const r = core.forceAsFileUrl (this)
    return r === this ? this : url (r, this) }

  forceAsWebUrl () {
    const r = core.forceAsWebUrl (this)
    return r === this ? this : url (r, this) }

  force () {
    const r = core.force (this)
    return r === this ? this : url (r, this) }

  // ### Reference Resolution

  genericResolve (base) {
    base = prepare (base, this)
    return url (core.genericResolve (this, base), this) }

  legacyResolve (base) {
    base = prepare (base, this)
    return url (core.legacyResolve (this, base), this) }

  WHATWGResolve (base) {
    base = prepare (base, this)
    return url (core.WHATWGResolve (this, base), this) }

  resolve (base) {
    base = prepare (base, this)
    return url (core.resolve (this, base), this) }

  // ### Normalisation

  normalise () {
    return url (core.normalise (this), this) }

  normalize () {
    return url (core.normalise (this), this) }

  // ### Percent Coding (Url <--> RawUrl)

  percentEncode ({ ascii = true } = { }) {
    const options = { ascii, incremental:this.percentCoded }
    return url (core.percentEncode (this, options), { percentCoded:true }) }

  percentDecode () {
    return this }

  // ### Printing

  toString ({ ascii = false } = { }) {
    const options = { ascii, incremental:this.percentCoded }
    return core.print (core.percentEncode (this, options)) }

  toURI () {
    if (!core.isBase (this))
      throw new TypeError (`Cannot convert <${this}> to an URI because it has no scheme`)
    return this.toString ({ ascii:true }) }

  toASCII () {
    return this.toString ({ ascii:true }) }

  toJSON () {
    return this.toString ({ ascii:true }) }

  // ### Url.set

  set (patch) {
    // Add reset for user, pass, port on new host; pass on new user
    if ('host' in patch) {
      const { user = null, pass = null, port = null } = patch
      patch = setProto ({ user, pass, port }, patch)
    }
    else if ('user' in patch && !('pass' in patch))
      patch = setProto ({ pass:null }, patch)

    // Reconcile percentCoding
    const { percentCoded = this.percentCoded } = patch
    if (percentCoded !== this.percentCoded)
      patch = percentCoded ? core.percentDecode (patch) : core.percentEncode (patch, { incremental:false })

    // Validate and apply patch
    const r = {};
    let errs = []
    const setters = settersFor (r, errs, this.percentCoded)
    for (let k in setters)
      if (k in patch) {
        if (patch[k] != null) setters[k] (patch[k]) }
      else if (k in this)
        r[k] = k === 'dirs' ? [...this.dirs] : this[k]

    // Assert patch to be valid
    if (errs.length)
      throw new TypeError (`Invalid patch:\n\t- ${errs.join ('\n\t- ')}\n`)

    // Add implicit path-root, remove if null or err
    if (!r.root) {
      if ((r.host != null || r.drive) && (r.dirs || r.file)) {
        if (r.root === null) throw new Error ('Cannot unset path-root')
        else r.root = '/'
      }
      else delete r.root
    }

    // Assert structural constraints
    errs = structErrors (r)
    if (errs.length) {
      // const type = ['generic', 'file', 'web'] [core.modeFor (this)]
      throw new TypeError (`\t- ${errs.join ('\n\t- ')}\n`) //  to ${type} URL <${this}>
    }

    return url (r, { percentCoded:this.percentCoded })
  }

}


// RawUrl
// ======

class RawUrl extends Url {
  
  get percentCoded () {
    return true }

  percentDecode () {
    return url (core.percentDecode (this), { percentCoded:false }) }

}


// Private
// -------

// ### instantiation - unsafe
// Mutates obj into an Url or RawUrl instance

function url (obj, { percentCoded = false } = { }) {
  if (obj.dirs) freeze (obj.dirs)
  return freeze (setProto (obj, (percentCoded ? RawUrl : Url).prototype))
}

// ### 'prepare' - unsafe
// Used for parsing and/or reconciling percentCoding, and/or importing.
// NB. Returns obj itself if no parsing or reconciliation is needed.

function prepare (obj, { percentCoded = false } = { }, scheme = 'http') {
  if (typeof obj === 'string') {
    obj = core.parse (obj, core.modeFor ({ scheme }))
    return percentCoded ? obj : core.percentDecode (obj)
  }
  else if (obj && typeof obj === 'object') { // TODO cleanup
    obj = obj instanceof Url ? obj : Url.prototype.set.call ({}, obj)
    if (obj.percentCoded === percentCoded) return obj
    else return percentCoded ? core.percentEncode (obj, { incremental:false }) : core.percentDecode (obj)
  }
  return { }
}


// ### For Url.set

const settersFor = (r, errs, coded) => ({

  scheme: v => {
    if ((v = String (v)) && /^[a-zA-Z][a-zA-Z0-9.+-]*$/.test (v)) r.scheme = v
    else errs.push ('Invalid scheme string')
  },

  user: v => r.user = String (v),
  pass: v => r.pass = String (v),
  host: v => r.host = core.parseHost (String (v), core.modeFor (r), coded),

  port: v => {
    if (v === '') r.port = v
    else if ((v = +v) < 2**16) r.port = v
    else errs.push ('Invalid port')
  },

  drive: v => {
    if ((v = String (v)) && /^[a-zA-Z][|:]?$/.test (v))
      r.drive = (v.length > 1 ? v : v + ':')
    else errs.push ('Invalid drive string')
  },

  // NB root may temporarily be set to null as a trick to preserve key-order. 
  // It will either be removed or replaced with '/' by the set method. 

  root: v => r.root = v ? '/' : null,

  dirs: v => {
    if (v && typeof v === 'object' && (Symbol.iterator in v)) {
      const dirs = []
      for (let x of v) dirs [dirs.length] = String (x)
      if (dirs.length) r.dirs = dirs
    }
    else errs.push ('Invalid dirs array')
  },

  file: v => {
    if (v = String (v)) r.file = v
    else errs.push ('Invalid file string')
  },

  query: v => r.query = String (v),
  hash:  v => r.hash = String (v),
})


const structErrors = r => {
  const errs = []
  const isFile = !r.scheme && r.drive || (r.scheme && core.modeFor (r) === core.modes.file)

  if ((r.host == null || isFile) && (r.user != null || r.pass != null || r.port != null))
    errs.push (isFile
      ? `A file-URL cannot have credentials or a port`
      : `A host-less URL cannot have credentials or a port`)

  else if (r.pass != null && r.user == null)
    errs.push (`A URL without username cannot have a password`)

  if (!isFile && r.drive)
    errs.push (`A non-file URL cannot have a drive`)

  // REVIEW move to core? If so, also check the path-root constraint
  return errs
}



// Exports
// -------
const version = '1.0.0-rc.2'
export { version, Url, RawUrl }
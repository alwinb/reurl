"use strict"
const core = require ('./core')
const _iterator = Symbol !== undefined
  ? Symbol.iterator : '@iterator'

const log = console.log.bind (console)

// TODO list:
//
// - [X] New, small parser
// - [X] Segments '..' and '.' should never be FILE? (leave it as is)
// - [X] Authority parser
// - [X] Implement 'promotePathToHost' on resolve level
// - [X] Empty path root should not replace drive letter
// - [X] Handle implicit path-root at once for auth|drive followed by dir|file
// - [X] Join with empty should drop the hash
// - [X] Figure out what to do with 'patch' (keep it private)
// - [X] Make force configurable? (No, leave it. This implements nonstandard WhatWG behaviour.)
// - [X] Rename project?
// - [X] Separate project on github
//
// - [-] Stable API
// - [-] API Docs
// - [ ] Additional operations on URLs and paths (chroot, relto, toFilePath (unix, win))
// - [-] Add setters for individual components
// - [-] Integrate Auth parser (and solve issues with file / e.a.)
// - [ ] Clean up configurations, esp. make conf records per scheme
// - [ ] Solve design issue with component encodings


function ReUrl (url, conf) {
  if (url instanceof ReUrl)
    this._tokens = url._tokens.concat ([])

  else if (typeof url === 'string')
    this._tokens = core.url (url, conf)

  else
    this._tokens = []

  this.__defineGetter__ ('scheme', _get (this, core.SCHEME))
  this.__defineGetter__ ('username', _get (this, core.AUTH, _ => _.user))
  this.__defineGetter__ ('password', _get (this, core.AUTH, _ => _.pass))
  this.__defineGetter__ ('host', _get (this, core.AUTH, _ => _.host))
  this.__defineGetter__ ('port', _get (this, core.AUTH, _ => _.port))
  this.__defineGetter__ ('drive', _get (this, core.DRIVE))
  this.__defineGetter__ ('path', _getPath (this))
  this.__defineGetter__ ('file', _get (this, core.FILE))
  this.__defineGetter__ ('query', _get (this, core.QUERY))
  this.__defineGetter__ ('fragment', _get (this, core.FRAG))
  //
  this.__defineGetter__ ('href', _ => this.toString ())
}


const _keys = ['scheme', 'fragment', 'query', 'drive', 'file', 'authority']

ReUrl.prototype = {

  toString: function () {
    return core.print (this._tokens)
  },
  
  toArray: function () {
    return [].concat (this._tokens)
  },

  // TODO: what if dropping e.g. the drive from file:///c:/d:/foo
  // And what about setting scheme from 'http://d:/foo' to file, and other such things..?

  withScheme: _set (core.SCHEME),
  // withAuthority
  // withUser
  // withPassword
  // withPath
  withDrive: _set (core.DRIVE),
  withFile: _set (core.FILE),
  withQuery: _set (core.QUERY),
  withFragment: _set (core.FRAGMENT),

  with: function (changes) {
    const r = new ReUrl ()
    const rec = core._toRec (this._tokens)
    if ('path' in changes) {
      // TODO, parse path, not URL
      const p = core._toRec (new ReUrl (changes.path) .path ._tokens)
      for (var a in p) rec [a] = p [a]
    }
    _keys.forEach (k => { if (k in changes) rec[k] = changes[k] })
    r._tokens = core._fromRec (rec)
    return r
  },

  join: function (other) {
    const _other = typeof other === 'string'
      ? core.url (other, this.scheme)
      : other._tokens
    const r = new ReUrl ()
    r._tokens = core.join (this._tokens, _other)
    return r
  },
  
  normalize: function () {
    const r = new ReUrl ()
    r._tokens = core.normalize (this._tokens)
    return r
  },

  force: function (scheme) {
    const r = new ReUrl ()
    r._tokens = core.force (this._tokens, scheme)
    return r
  },

  resolve: function (other) {
    const _other = typeof other === 'string'
      ? core.url (other, this.scheme)
      : other._tokens
    const r = new ReUrl ()
    r._tokens = core.resolve (this._tokens, _other)
    return r
  },

  // toFilePath: function () {},
  // changeRoot: function () {},
  // relativeTo: function () {},
}

ReUrl.prototype.goto = ReUrl.prototype.join
ReUrl.prototype.toJSON = ReUrl.prototype.toString
ReUrl.prototype.valueOf = ReUrl.prototype.toString


function _get (url, type, fn) { return function () {
  const toks = url._tokens.filter (_ => _[0] === type)
  return toks.length ? (fn ? fn (toks[0][1]) : toks[0][1]) : null
} }

// TODO guards for (a.o) scheme setter
function _set (type) { return function (value) {
  const r = new ReUrl ()
  const rec = core._toRec (this._tokens)
  rec [type] = value
  r._tokens = core._fromRec (rec)
  return r
} }


// TODO this should probably be cached
function _getPath (url) { return function () {
  const parts = url._tokens.filter (_ => _[0] === core.DRIVE || _[0] === core.ROOT || _[0] === core.DIR || _[0] === core.FILE)
  if (parts.length) {
    const r = new ReUrl ()
    r._tokens = parts
    return r
  }
  return null
} }


module.exports = ReUrl
if (typeof window !== 'undefined') window.ReUrl = ReUrl







log (new ReUrl ('http://foo@host/baz/bac').username )
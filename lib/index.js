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
// - [ ] Add setters for individual components
// - [ ] Integrate Auth parser (and solve issues with file / e.a.)
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
  // username
  // password
  // host
  // port
  this.__defineGetter__ ('drive', _get (this, core.DRIVE))
  this.__defineGetter__ ('path', _getPath (this))
  this.__defineGetter__ ('query', _get (this, core.QUERY))
  this.__defineGetter__ ('fragment', _get (this, core.FRAG))

  // add setters... eeh 
  // withScheme (?), withQuery, withFragment.. ?
}


ReUrl.prototype = {

  toString: function () {
    return core.print (this._tokens)
  },
  
  toArray: function () {
    return [].concat (this._tokens)
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
ReUrl.prototype [_iterator] = ReUrl.prototype.tokens


function _get (url, type) { return function () {
  const toks = url._tokens.filter (_ => _[0] === type)
  return toks.length ? toks[0][1] : null
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
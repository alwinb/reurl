"use strict"
const core = require ('./core')
const _iterator = Symbol !== undefined
  ? Symbol.iterator : '@iterator'

const log = console.log.bind (console)

// TODO list:
// - [X] New, small parser
// - [X] Segments '..' and '.' should never be FILE? (leave it as is)
// - [ ] Authority parser
// - [X] Implement 'promotePathToHost' on resolve level
// - [ ] UTF/ encoding / decoding / design API
// - [-] Stable API
// - [-] API Docs
// - [X] Empty path root should not replace drive letter
// - [X] Handle implicit path-root at once for auth|drive followed by dir|file
// - [ ] Additional operations on URLs and paths (chroot, relto)
// - [X] Join with empty should drop the hash
// - [X] Figure out what to do with 'patch' (keep it private)
// - [X] Make force configurable? (No, leave it. This implements nonstandard WhatWG behaviour.)
// - [ ] Force on nonspecial schemes/ opaque paths?
// - [X] Rename project?
// - [X] Separate project on github


function Url (url, conf) {
  if (typeof url === 'string')
    this._parts = core.url (url, conf)

  else if (url instanceof (Url))
    this._parts = url._parts.concat ([])
  
  else
    this._parts = []

  this.__defineGetter__ ('scheme', _get (this, core.SCHEME))
  this.__defineGetter__ ('drive', _get (this, core.DRIVE))
  // this.__defineGetter__ ('path', _path)
  // this.__defineGetter__ ('file', _get (this, core.FILE))
  this.__defineGetter__ ('query', _get (this, core.QUERY))
  this.__defineGetter__ ('fragment', _get (this, core.FRAG))
  // add getter for path
  // and host, but that depends on host-parser
  
  // add setters... eeh 
  // withScheme (?), withQuery, withFragment
}


Url.prototype = {

  toString: function () {
    return core.print (this._parts)
  },

  join: function (other) {
    const _other = typeof other === 'string'
      ? core.url (other, this.scheme)
      : other._parts
    const r = new Url ()
    r._parts = core.join (this._parts, _other)
    return r
  },
  
  normalize: function () {
    const r = new Url ()
    r._parts = core.normalize (this._parts)
    return r
  },

  force: function (scheme) {
    const r = new Url ()
    r._parts = core.force (this._parts, scheme)
    return r
  },

  resolve: function (other) {
    const _other = typeof other === 'string'
      ? core.url (other, this.scheme)
      : other._parts
    const r = new Url ()
    r._parts = core.resolve (this._parts, _other)
    return r
  },

  tokens: function () {
    let i = 0
    const parts = this._parts
    function next () {
      return i < parts.length ?
        { done:false, value:parts[i++] } :
        { done:true }
    }
    return { next:next }
  }

  // toFilePath: function () {},
  // changeRoot: function () {},
  // relativeTo: function () {},
}

Url.prototype.goto = Url.prototype.join
Url.prototype.toJSON = Url.prototype.toString
Url.prototype [_iterator] = Url.prototype.tokens


function _get (url, type) { return function () {
  const toks = url._parts.filter (_ => _[0] === type)
  return toks.length ? toks[0][1] : null
} }


module.exports = Url
if (typeof window !== 'undefined') window.ReUrl = Url



"use strict"
const log = console.log.bind (console)

const core = require ('./core')
const _iterator = Symbol !== undefined
  ? Symbol.iterator : '@iterator'

// TODO list:
// - [X] New, small parser
// - [X] Segments '..' and '.' should never be FILE? (leave it as is)
// - [ ] Authority parser
// - [X] Implement 'promotePathToHost' on resolve level
// - [ ] UTF/ encoding issues
// - [ ] Stable API
// - [ ] API Docs
// - [X] Empty path root should not replace drive letter
// - [ ] Handle implicit path-root at once for auth|drive followed by dir|file
// - [ ] Additional operations on URLs and paths (chroot, relto)
// - [X] Join with empty should drop the hash
// - [X] Figure out what to do with 'patch' (keep it private)
// - [ ] Make force configurable?
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

  // add getter for path
  // and for scheme, host, query, etc too?
}


Url.prototype = {
  
  toString: function () {
    return core.str (this._parts)
  },

  join: function (other) {
    const r = new Url ()
    r._parts = core.join (this._parts, other._parts)
    return r
  },
  
  normalize: function () {
    const r = new Url ()
    r._parts = core.normalize (this._parts)
    return r
  },

  force: function (scheme) {
    const r = new Url ()
    r._parts = core.force (this._parts, scheme||'')
    return r
  },

  resolve: function (other) {
    const r = new Url ()
    r._parts = core.normalize (core.force (core.join (this._parts, other._parts)))
    return r
  },
  
  // chroot: function () {},
  // relativeTo: function () {},
}

Url.prototype [_iterator] = function () {
  let i = 0
  const parts = this._parts
  function next () {
    return i < parts.length ?
      { done:false, value:parts [i++] } :
      { done:true }
  }
  return { next:next }
}

// Join with empty should drop the hash
//var a = new Url ('http://foo/bar#hash')
//var b = new Url ('http:nohash')
//var c = a.join (b)
//log (String (c))

// Empty path root should not replace drive letter
var a = new Url ('c|/dir/file', 'file')
var b = new Url ('/dir')
var c = a.join (b).normalize ()
log (String (c))


// Opaque paths should not be escaped?
// var sample = 'a: foo.com'
// compose (trace, url) (sample)










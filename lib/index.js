"use strict"
const log = console.log.bind (console)

const core = require ('./core')
const _iterator = Symbol !== undefined
  ? Symbol.iterator : '@iterator'

// TODO list
// - [X] New, small parser
// - [ ] Segments '..' and '.' should never be FILE? (parser)
// - [ ] Authority parser
// - [X] Implement 'promotePathToHost' on resolve level
// - [ ] UTF/ encoding issues
// - [ ] Stable API
// - [ ] API Docs
// - [ ] Empty path root should not replace drive letter
// - [ ] Additional operations on URLs and paths (chroot, relto)
// - [ ] Join with empty should drop the hash?
// - [ ] Figure out what to do with 'patch'
// - [ ] Make force configurable, 
// - [ ] Force on nonspecial schemes/ opaque paths?
// - [X] Rename project?
// - [ ] Separate project on github


function Url (url, conf) {
  if (typeof url === 'string')
    this._parts = core.url (url, conf)

  else if (url instanceof (Url))
    this._parts = url._parts.concat ([])

  // add getter for path
  // and for scheme, host, query, etc too?
}


Url.prototype = {
  toString: function () { return core.str (this._parts) },
  join: function (other) { return core.join (this._parts, other._parts ) },
  normalize: function () { const r = new Url (); r._parts = core.normalize (this._parts); return r },
  // resolve: function (other) {},
  // chroot: function () {},
  // relativeTo: function () {},
  // toBaseUrl: function () {}
}

Url.prototype [_iterator] = function () {
  return this._parts.values ()
}


//

var u = new Url ('http://foo/bar/./baz?quu#has')
log (u.normalize()+'')
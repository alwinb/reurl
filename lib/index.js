"use strict"
const core = require ('./core')

const log = console.log.bind (console)

// TODO list:
//
// - [X] New, small parser
// - [X] Segments '..' and '.' should never be FILE? (leave it as is)
// - [X] Authority parser
// - [X] Implement 'promotePathToHost' ('steal') on resolve level
// - [X] Empty path root should not replace drive letter
// - [X] Handle implicit path-root at once for auth|drive followed by dir|file
// - [X] Join with empty should drop the hash
// - [X] Figure out what to do with 'patch' (keep it private)
// - [X] Make force configurable? (No, leave it. This implements nonstandard WhatWG behaviour.)
// - [X] Rename project?
// - [X] Separate project on github
//
// - [-] Stable API, clean up index.js (switch to records?)
// - [-] API Docs
// - [-] Add setters for individual components
// - [X] Integrate Auth parser (and solve issues with file / e.a.)
// - [ ] Clean up configurations, esp. make conf records per scheme
// - [ ] Solve design issue with component encodings
// - [X] Additional operations: chroot, relto, toFilePath (postponed). 
// - [X] Use CO encode set on 'cannot be a base url' paths.. that is ? nonspecial scheme and no root?
// - [ ] (Maybe a 'makeValid' method, and validation / failure reports?)


// ReUrl API
// ---------
// The ReUrl object is just an object wrapper around the core library,
// to provide a more typical, javascript-y API. 

function ReUrl (url, conf) {
  if (url instanceof ReUrl)
    this._tokens = url._tokens.concat ([])

  else if (typeof url === 'string')
    this._tokens = core.parse (url, conf)

  else
    this._tokens = []

  this.__defineGetter__ ('scheme', _get (this, core.SCHEME))
  this.__defineGetter__ ('username', _get (this, core.AUTH, _ => _.name))
  this.__defineGetter__ ('password', _get (this, core.AUTH, _ => _.pass))
  this.__defineGetter__ ('hostname', _get (this, core.AUTH, _ => _.host))
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

  // Question: what if dropping e.g. the drive from file:///c:/d:/foo
  // and setting scheme from 'http://d:/foo' to file, and other such things..?
  // Answer: No, I think of these operations as working on parsed URL-strings, 
  // so I will not re-detect drives. 
  // TODO in that case, be sure to serialize as 'd%3a'

  withScheme: _set (core.SCHEME),
  // withUsername
  // withPassword
  // withHostname
  // withPort
  // withPath
  withDrive: _set (core.DRIVE),
  withFile: _set (core.FILE),
  withQuery: _set (core.QUERY),
  withFragment: _set (core.FRAGMENT),

  with: function (changes) {
    const rec = core._toRecord (this._tokens)
    if ('path' in changes) {
      // TODO, parse path, not URL
      const p = core._toRecord (new ReUrl (changes.path) .path ._tokens)
      for (var a in p) rec [a] = p [a]
    }
    _keys.forEach (k => { if (k in changes) rec[k] = changes[k] })
    return _wrap (core._fromRecord (rec))
  },

  join: function (other) {
    const _other = typeof other === 'string'
      ? core.parse (other, this.scheme)
      : other._tokens
    return _wrap (core.join (this._tokens, _other))
  },
  
  normalize: function () {
    return _wrap (core.normalize (this._tokens))
  },

  force: function (scheme) {
    return _wrap (core.force (this._tokens, scheme))
  },

  resolve: function (other) {
    const _other = typeof other === 'string'
      ? core.parse (other, this.scheme)
      : other._tokens
    return _wrap (core.resolve (this._tokens, _other))
  },

  // toFilePath: function () {},
  // changeRoot: function () {},
  // relativeTo: function () {},
}

ReUrl.prototype.goto = ReUrl.prototype.join
ReUrl.prototype.toJSON = ReUrl.prototype.toString
ReUrl.prototype.valueOf = ReUrl.prototype.toString


function _wrap (tokens) {
  const r = new ReUrl ()
  r._tokens = tokens
  return r
}

function _get (url, type, fn) { return function () {
  const toks = url._tokens.filter (_ => _[0] === type)
  return toks.length ? (fn ? fn (toks[0][1]) : toks[0][1]) : null
} }

// TODO guards for (a.o) scheme, drive setters
function _set (type) { return function (value) {
  const r = new ReUrl ()
  const rec = core._toRecord (this._tokens)
  rec [type] = value
  r._tokens = core._fromRecord (rec)
  return r
} }


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
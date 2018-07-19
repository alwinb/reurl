const wtf8 = require ('wtf-8')
const log = console.log.bind (console)

// Authority parser
// ----------------

// the last @ is the userinfo-host separator
// the first : before the userinfo-host separator is the username-password separator
// the first : after the userinfo-host separator is the host-port separator

function parseAuth (string) {
  let last_at = -1
  let port_col = -1
  let first_col = -1
  let bracks = false

  for (let i=0, l=string.length; i<l; i++) {
    let c = string [i]
    if (c === '@')
      last_at = i
    else if (c === ':' && !bracks) {
      first_col = first_col < 0 ? i : first_col
      port_col = port_col <= last_at ? i : port_col
    }
    else if (c === '[')
      bracks = true
    else if (c === ']')
      bracks = false
  }

  const auth = { _auth:string, user:null, pass:null, host:'', port:null }

  if (last_at >= 0) {
    if (0 <= first_col && first_col < last_at) {
      auth.user = string.substring (0, first_col)
      auth.pass = string.substring (first_col + 1, last_at)
    }
    else
      auth.user = string.substring (0, last_at)
  }
  if (port_col > last_at) {
    auth.host = string.substring (last_at + 1, port_col)
    auth.port = string.substr (port_col + 1)
  }
  else
    auth.host = string.substr (last_at + 1)

  return auth
}


// Normalize auth
// --------------

const specialSchemes = 
  { ftp: 21
  , file: null 
  , gopher: 70
  , http: 80
  , https: 443
  , ws: 80
  , wss: 443 }

const HOST_ESC = /[\x00-\x1F\x7F-\xFF]/g
const USER_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}/:;=@\[\\\]^|]/g

function _userinfo_esc (v) {
  return wtf8.encode (v) .replace (USER_ESC, _esc)
}

function _esc (char) {
  var b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}


// NB. File Auths, cannot have userinfo or ports. However, 
// the WhatWG behaviour is to fail on file hosts that 
// contain '@' or ':' characters, so there is no danger 
// in parsing them with the default auth parser, as long as  
// we check 'on time' (TODO: when?) if they end up having non-null 
// userinfo or ports, and throwing then.  

function normalize (auth, scheme) {
  const r = { user:null, pass:null, host:auth.host, port:null }
  r.user = auth.user ? auth.user : null
  r.pass = auth.pass ? auth.pass : null
  const _port = /^[0-9]+$/.test (auth.port) ? parseInt (auth.port, 10) : auth.port
  r.port = scheme in specialSchemes && _port === specialSchemes [scheme] ? null : _port
  if (r.port != null) r.port += ''
  if (scheme === 'file' && auth.host === 'localhost') r.host = ''
  r._auth = printAuth (r)
  //log ('normalizeAuth', auth, r)
  return r
}


function printAuth (auth) {
  let r = wtf8.encode (auth.host) .replace (HOST_ESC, _esc)
  let userinfo = ''

  if (auth.port != null && auth.port !== '')
    r += ':' + auth.port

  if (auth.user)
    userinfo += _userinfo_esc (auth.user)
  if (auth.pass)
    userinfo += ':' + _userinfo_esc (auth.pass)

  return userinfo ? userinfo + '@' + r : r
}


// Exports
// -------

module.exports = { parse:parseAuth, print:printAuth, normalize:normalize }
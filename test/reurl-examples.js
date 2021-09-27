import { inspect } from 'util'
import { Url, RawUrl } from '../lib/index.js'
const raw = String.raw
const log = console.log.bind (console)

// import assert from 'assert/strict'
//   assert.equals = assert.equal
//   assert.deepEquals = assert.deepEqual

// Quick
// -----

var r = new RawUrl ('http://\x1F!"$&\'()*+,-.;=_`{}~/')
pr (r)

var r = new Url ('http:www.example.com') .force ()
pr (r)

var r = new Url ('http://🌿🌿🌿/{braces}/hʌɪ')
pr (r)

var r = new Url ('//foo:80\\bar')
pr (r)

var r = new Url ('non-spec:/.//') .normalize ()
pr (r)

var r = new Url ('http://example.com/foo/bar/baz?q#h')
pr (r)

var r = new Url ('.') .resolve ('http://www.example.com/test') .force () //.normalize ()
pr (r)

var r = new Url ('http://@www.example.com/') .normalise()
pr (r)

// Quick test for port parser
var r = new Url ('http://example.com:80')
pr (r)

// Quick test for spaces
var r = new Url ('http://example.com:80/a/ /b')
pr (r)

// Quick test for normalize to add a root to special urls
var r = new Url ('http://example.com') .normalize ()
pr (r)

// Testing percentcoded vs decoded mode parsing
var r = new Url ('http://%66%6F%6f')
pr (r)

var r = new RawUrl ('http://%66%6F%6f')
pr (r)

// See if special url parsing works on file
var r = new Url (raw `file:\\c:\foo`)
pr (r)

// See if special url parsing works on http
var r = new Url (raw `http:\\host:8080\foo`)
pr (r)

// See if special url parsing does not work on others
var r = new Url (raw `nonspecial:\\host:8080\foo`)
pr (r)

// See how relative urls are parsed by default
var r = new Url (raw `\\host:8080\foo`)
pr (r)

var url = new Url ({ drive:'c', dirs:['foo', 'buzz'], file:'b%61r', percentCoded:true })
pr (url)

var a = new Url ('//foo/🌿🦍/%42?%F0%9F%8C%BF')
pr (a)

var b = new RawUrl ('//foo/🌿🦍/%42?%F0%9F%8C%BF')
pr (b)

var c = new RawUrl (a)
pr (c)

var d = new Url (b)
pr (d)

var f = c.set ({ host:'🌿%26🌿' })
pr (f)

var e = d.set ({ host:'🌿%26🌿', percentCoded:true })
pr (e)

// Non-decoded url, set encoded file, non-encoded hash
var a = new RawUrl ('http://foo/🌿🦍/%42?%F0%9F%8C%BF')
  .set ({ file:'%66%6f%6f', percentCoded:true })
  .set ({ hash:'host.contains.a.%.sign', percentCoded:false })
pr (a)

// Decoded url, set encoded file, non-encoded hash
var b = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF')
  .set ({ file:'%66%6f%6f', percentCoded:true })
  .set ({ hash:'host.contains.a.%.sign', percentCoded:false })
pr (b)


// --------

const samples = [
  ':#',
  '?⌣',
  'foo//?query#hash',
  'foo/bar?query#hash',
  'foo?query',
  'ftp://example.com/',
  'http:#',
  'http://example.org/foo/bar',
  'http://example\t.\norg',
  'https://%e2%98%83',
  'https://faß.ExAmPlE/',
  'sc://ñ',
  'foo:\\\\\\D|\\\\foo\\\\\\bar\\\\\\bax?que#foo?que',
  '//foo',
  '//foo///bar///bax#foo',
  '//foo?query',
]

const samples2 = [
  '///c:/d:/host/abc',
  '///c:/host/abc',
  '///cs/d:/host/abc',
  '//C|/foo/bar',
  '//c:/d:/host/abc',
  '//c:/host/abc',
  '//cs/d:/host/abc',
  '/c:/d:/host/abc',
  '/c:/host/abc',
  '/cs/d:/host/abc',
  'C|',
  'C|/',
  'C|/foo/bar',
  'C|?query',
  'c:/d:/host/abc',
  'c:/host/abc',
  'cs/d:/host/abc',
  'c|/d:/host/abc',
  'c|/host/abc',
  'file:///c:/d:/host/abc',
  'file:///c:/host/abc',
  'file:///cs/d:/host/abc',
  'file:///d:/dir/file',
  'file://c:\\foo\\bar.html',
  'file://d:/dir/file',
  'file://foo/d:/dir/file',
  'file://host/c:\\foo\\bar.html',
  'file:/D:#hash',
  'file:/D:',
  'file:/D:/#hash',
  'file:/D://foo///bar///bax#foo',
  'file:/c:\\foo\\bar.html',
  'file:/d:/dir/file',
  'file:c:\\foo\\bar.html',
  'file:d:/',
  'file:d:/dir/file',
  'file:d|',
]


// Quick print
// -----------

function pr (url, conf = {}) {
  let string = url
  if (typeof url === 'string') url = new Url (url, conf)
  else string = String (url)
  var title = inspect (string)
  if (Object.entries (conf) .length)
    title = `${title}, ${inspect (conf)}`
  log (title)
  log (title.replace (/./g, '-'))
  log (url)
  // log ('Tokens', [...url.tokens()])
  log ()
}


// Running the samples
// -------------------

//*
samples .forEach (pr)
const conf = { parser:'file' }
samples2 .forEach (x => pr (x, conf))
//*/

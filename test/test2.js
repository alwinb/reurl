const assert = require ('assert').strict
  assert.equals = assert.equal
  assert.deepEquals = assert.deepEqual
const Url = require ('../lib/urlregex.js')
const log = console.log.bind (console)
const raw = String.raw

// Testing
// =======

// var r = new Url ('http://foo') .set ({ drive:'d' })
// log (r)
// throws

// var r = new Url ('file:/D:/') .set ({ scheme: 'http' })
// log (r)
// throws


var r = new Url ('.') .resolve ('http://www.example.com/test') .force () // .normalize ()
log (r)


var r = new Url ('http://@www.example.com/').normalise()
log (r)

log ('quick test for port parser')
var r = new Url ('http://example.com:80')
log (r)

log ('quick test for spaces')
var r = new Url ('http://example.com:80/a/ /b')
log (r)


log ('quick test for normalize to add a root to special urls')
var r = new Url ('http://example.com') .normalize ()
log (r)


log ('testing percentdecoded mode parsing')
var r = new Url ('http://%66%6F%6f', { percentCoding:'decode' })
log (r)


//log ('testing setting drive letters')
var r = new Url ('//foo/D:') .set ({ drive:'x' })
assert.equals (r.drive, 'x:')

r = r.set ({ drive:'x|' })
assert.equals (r.drive, 'x|')

r = r.set ({ drive:'x:' })
assert.equals (r.drive, 'x:')

assert.throws ($ => r.set ({ drive:'xs' }), /ERR_INVALID_DRIVE/)

// throws
// var r = new Url ('http://foo')
//   .set ({ drive:'x' })
// log (r)


log ('testing percent decoded mode')
var r = new Url (null, { percentEncoding:'decode'}) 
  .set ({ host: '%66%6f%6f', percentCoded:true })
  .set ({ file: 'file-with-%-sign' })
log (r)


log ('testing percent preserve mode')
var r = new Url (null, { percentEncoding:'preserve'}) 
  .set ({ host: '%66%6f%6f' })
  .set ({ file: 'file-with-%-sign', percentCoded:false })
log (r)


/*
log (new Url ('file://foo/d:/dir/file'))
log (new Url ('file:///d:/dir/file'))
log (new Url ('file://d:/dir/file'))
log (new Url ('file:/d:/dir/file'))
log (new Url ('file:d:/dir/file'))
log (new Url ('file:d:/'))
log (new Url ('file:d|'))
*/




log ('testing the host parser')
var r = new Url ('http://0.0.256/dir/')
log (r.parseHost())

var r = new Url ('http://🦍/dir/')
log (r.parseHost())


// log ('testing the authority parser')
// var sample = '[a:b]:c'
// log (parseAuth (sample))



///


log ('See if special url parsing works on file')
var r = new Url (raw `file:\\c:\foo`)
log (r)

log ('See if special url parsing works on http')
var r = new Url (raw `http:\\host:8080\foo`)
log (r)

log ('See if special url parsing does not work on others')
var r = new Url (raw `nonspecial:\\host:8080\foo`)
log (r)

log ('see how relative urls are parsed by default')
var r = new Url (raw `\\host:8080\foo`)
log (r)

/*
log ('non-decoded url, set encoded file, non-encoded host')
var a = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF')
  .set ({ file:'%66%6f%6f', percentEncoded:true })
  .set ({ host:'host.contains.a.%.sign', percentEncoded:false })
log (a)
log('')

log ('decoded url, set encoded file, non-encoded host')
var b = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF') .percentDecoded ()
  .set ({ file:'%66%6f%6f', percentEncoded:true })
  .set ({ host:'host.contains.a.%.sign', percentEncoded:false })
log (b)
log ()
//*/

// log ('see if the the user,pass,port reset works on setting a new host')
var r = new Url ('http://jack:pass@host:80/dir1') .set ({ host:'bar' })
assert.equals (r.user, null)
assert.equals (r.pass, null)
assert.equals (r.host, 'bar')
assert.equals (r.port, null)

// log ('see if the the pass reset works')
var r = new Url ('http://jack:secret@host:80/dir1') .set ({ user:'joe' })
assert.equals (r.user, 'joe')
assert.equals (r.pass, null)
assert.equals (r.host, 'host')
// assert.equals (r.port, 80) // TODO

// See if resolve works
var r = new Url ('http:file.txt') .resolve ('http://host/')
assert.equal (r.href, 'http://host/file.txt')

// See if it works with different percentCoding settings' // FIXME
// var r = new Url ('http:with-%25-sign.txt', { percentCoding:'decode' }) .resolve ('http://%66%6f%6f')
// assert.equal (r.href, 'http://foo/with-%25-sign.txt')

var r = new Url ('http:/with-%25-sign.d/%66%6f%6f.txt', { percentCoding:'preserve' })
  .resolve (new Url('http://%66-%25-%6f%6f', { percentCoding:'decode' })) // FIXME
assert.equal (r.percentCoded, true)
// assert.equal (r.href, 'http://f-%25-oo/with-%25-sign.d/%66%6f%6f.txt')
// assert.equal (r.host, 'f-%25-oo')


// ... And respects schemes
var r = new Url ('http:file.txt') .resolve ('file://host/')
assert.equal (r.href, 'http:file.txt')

// ... And works with host-relative Urls
var r = new Url ('htTP:file.txt#hash') .resolve ('HTtp://host/dir/')
assert.equal (r.href, 'htTP://host/dir/file.txt#hash')

//log ('see if setting port on a hostless url fails')
assert.throws ($ => new Url ('http:file.txt') .set ({ user:'joe' }), /ERR_NOAUTH/)

// log ('see if force works')
var r = new Url ('http:foo/bar/baz'). force ()
assert.equals (r.host, 'foo')
assert.deepEquals (r.dirs, ['bar'])
assert.equals (r.file, 'baz')

var r = new Url ('http:/jack@foo/bar/baz'). force ()
assert.equals (r.user, 'jack')
assert.equals (r.pass, null)
assert.equals (r.host, 'foo')
assert.deepEquals (r.dirs, ['bar'])
assert.equals (r.file, 'baz')

var r = new Url ('http:////jack@foo/'). force ()
assert.equals (r.user, 'jack')
assert.equals (r.pass, null)
assert.equals (r.host, 'foo')

var r = new Url ('http:////jack@foo'). force ()
assert.equals (r.user, 'jack')
assert.equals (r.pass, null)
assert.equals (r.host, 'foo')

// should fail!
assert.throws ($ => new Url ('http:////'). force (), /FORCE_FAILED/)

// log ('see if empty host components are present as null')
var r = new Url ('http:/dir')
assert.equals (r.user, null)
assert.equals (r.pass, null)
assert.equals (r.host, null)
assert.equals (r.port, null)

var r = new Url ('http://jack@host:80/dir') .set ({ host:null })
assert.equals (r.user, null)
assert.equals (r.pass, null)
assert.equals (r.host, null)
assert.equals (r.port, null)

// log ('see if adding root works')
var r = new Url ('http://host').set ({ root:1 })
assert.equals (r.root, '/')

// log ('see if removing root works')
var r = new Url ('http://host/').set ({ root:0 })
assert.equals (r.root, null)

//log ('see if the the implied root works')
var r = new Url ('http://host').set ({ file:'file.txt' })
assert.equals (r.root, '/')

var r = new Url ('http://host/d:').set ({ file:'file.txt' })
assert.equals (r.root, '/')

//log ('see if invalid root fails')
assert.throws ($ => new Url ('http://host') .set ({ file:'file.txt', root:false }), /ERR_NEEDSROOT/)

// log ('see if the authority constraints are held')
assert.throws ($ => new Url ('http:file') .set ({ port:80 }), /ERR_NOAUTH/)
assert.throws ($ => new Url ('http:file') .set ({ user:'joe' }), /ERR_NOAUTH/)
assert.throws ($ => new Url ('http:file') .set ({ pass:'foo' }), /ERR_NOCREDS/)

// log ('see if the userinfo constraints are held')
assert.throws ($ => new Url ('http://file') .set ({ pass:'foo' }), /ERR_NOCREDS/)

// log ('see if the authority constraints are held')
assert.throws ($ => new Url ('http://file') .set ({ user:'joe', host:null }), /ERR_NOAUTH/)



// Testing the decoding

// var r = new Url () .percentDecoded () .goto ('foo/bar-with-%25-baz?%F0%9F%8C%BF')
// log (r)

//var b = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF') .percentDecoded ()
//var c = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF') .percentDecoded () .percentEncoded ()


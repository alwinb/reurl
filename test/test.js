const Url = require ('../lib')
const log = console.log.bind (console)
const samples = require ('./samples')
const Tests = require ('./testset')

// Set up tests

const init = test => {
  let output
  if (typeof test.url === 'function') {
    test._url = test.url + ''
    output = test.url ()
  }
  else if (typeof test.url === 'string')
    output = new Url (test.url)
  else output = test.url

  return output
}

//

const checkHref = (test, output) =>
  'href' in test ? output.href == test.href : true

const checkScheme = (test, output) =>
  'scheme' in test ? output.scheme == test.scheme : true

const checkPass = (test, output) =>
  'pass' in test ? output.pass == test.pass : true

const checkDrive = (test, output) =>
  'drive' in test ? output.drive == test.drive : true

const checkHostname = (test, output) =>
  'host' in test ? output.host == test.host : true

const checkPort = (test, output) =>
  'port' in test ? output.port == test.port : true

const checkRoot = (test, output) =>
  'root' in test ? output.root == test.root : true

const checkFile = (test, output) =>
  'file' in test ? output.file == test.file : true

const checkError = (test, output, error) =>
  !test.error || error // && error.message === test.error


const testset = new Tests (samples, init)
  . assert ('checkHref', checkHref)
  . assert ('checkScheme', checkScheme)
  . assert ('checkPass', checkPass)
  . assert ('checkHostname', checkHostname)
  . assert ('checkPort', checkPort)
  . assert ('checkDrive', checkDrive)
  . assert ('checkRoot', checkRoot)
  . assert ('checkFile', checkFile)
  . assert ('checkError', checkError)


testset.compactInput = function (inp) {
  return inp.url.href
}

if (testset.run () !== true)
  process.exit (1)


// Other tests/ disabled for now
// url: () => new Url ('file:') .set ({ user: 'joe' })
// url: () => new Url ('file://foo') .set ({ user: 'joe' })


// Idea for path API?
/*
var r = new Url ('//foo/bar/../baz/bee/boo?qu')
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
r = r.dropDirectory ()
log (r.href)
//r = r.withDirectory ('one')
//log (r.href)
//r = r.withDirectory ('two')
//log (r.href)
//r = r.withDirectory ('three')
//log (r.href)
//*/


// Quick 'test's, just run
// log (new Url ('c:/host/abc', 'file'))
// log (new Url ('c:/d:/host/abc', 'file'))
// log (new Url ('c|/host/abc', 'file'))
// log (new Url ('c|/d:/host/abc', 'file'))
// log (new Url ('cs/d:/host/abc', 'file'))
// log (new Url ('/c:/host/abc', 'file'))
// log (new Url ('/c:/d:/host/abc', 'file'))
// log (new Url ('/cs/d:/host/abc', 'file'))
// log (new Url ('//c:/host/abc', 'file'))
// log (new Url ('//c:/d:/host/abc', 'file'))
// log (new Url ('//cs/d:/host/abc', 'file'))
// log (new Url ('///c:/host/abc', 'file'))
// log (new Url ('///c:/d:/host/abc', 'file'))
// log (new Url ('///cs/d:/host/abc', 'file'))
// log (new Url ('file:///c:/host/abc', 'file'))
// log (new Url ('file:///c:/d:/host/abc', 'file'))
// log (new Url ('file:///cs/d:/host/abc', 'file'))
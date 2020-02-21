const Url = require ('../')
const log = console.log.bind (console)


// Quick test

function test (string, conf = {}) {
  log (string)
  log (string.replace (/./g, '='))
  log ([... Url.fromString (string, conf)])
  log ()
}

//*
test ('http:#')
test ('file:/D:')
test ('file:/D:/#hash')
test ('file:/D:#hash')
test ('file:/D://foo///bar///bax#foo')
test ('//foo///bar///bax#foo')
test ('//foo')
test ('//foo?query')
test ('foo?query')
test ('foo/bar?query#hash')
test ('foo//?query#hash')
test ('foo:\\\\\\D|\\\\foo\\\\\\bar\\\\\\bax?que#foo?que', { backslashes:false })
// Add these to qtests!
test ('http://example\t.\norg')
test ('http://example.org/foo/bar')
test ('http://example.org/foo/bar')
test ('file:c:\\foo\\bar.html')
test ('file:/c:\\foo\\bar.html') // TODO is this correct?
test ('file://c:\\foo\\bar.html')
test ('file://host/c:\\foo\\bar.html')
test ('C|/foo/bar', 'file')
test ('C|/', 'file')
test ('C|', 'file')
test ('C|?query', 'file')
test ('//C|/foo/bar', 'file')
test ('C|', { drive:true })
//*/

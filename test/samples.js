const Url = require ('../lib/urlregex')
const myconf = scheme => ({ convertSlashes: /^http\+/.test (scheme) ? true : null })

module.exports = samples = [


  // Nonstrict goto tests

  {
    url: () => new Url ('http://foo') .goto ('bar'),
    href:'http://foo/bar',
  },
  {
    url: () => new Url ('httP://foo') .goto ('Http:bar'),
    href:'Http://foo/bar',
  },
  {
    url: () => new Url ('http://foo') .goto ('http:bar'),
    href:'http://foo/bar',
  },
  {
    url: () => new Url ('http://foo') .goto ('#bar'),
    href:'http://foo#bar',
  },
  {
    url: () => new Url ('foo#boo') .goto (''),
    href:'foo',
  },


  // setHost tests

  {
    url: () => new Url ('file:') .set ({ host:'localhost' }),
    href: 'file://localhost',
    scheme: 'file',
    host: 'localhost',
  },
  {
    url: () => new Url ('file://localhost') .set ({ host:'foo' }),
    href: 'file://foo',
    scheme: 'file',
    host: 'foo',
  },
  {
    url: () => new Url ('file:/') .set ({ host:'foo', file: 'fi' }),
    href: 'file://foo/fi',
    scheme: 'file',
    host: 'foo',
    file: 'fi',
  },


  // setPort tests

  {
    url: () => new Url ('http://foo') .set ({ port:0 }),
    href: "http://foo:0",
    scheme: "http",
    host: "foo",
    port: 0,
  },

  {
    url: () => new Url ('http://foo') .set ({ port:'1' }),
    href: "http://foo:1",
    scheme: "http",
    host: "foo",
    port: 1,
  },
  {
    url: () => new Url ('http://foo') .set ({ port:'1' }) .set ({ port:'2' }),
    href: "http://foo:2",
    scheme: "http",
    host: "foo",
    port: 2,
    drive: null,
    root: null,
  },

  // setDrive tests

  {
    url: () => new Url ('file:'),
    href: "file:",
    scheme: "file",
    host: null,
    drive: null,
    root: null,
    file: null,
  },
  {
    url: () => new Url ('file:') .set ({ drive:'d' }),
    href: "file:/d:",
    scheme: "file",
    host: null,
    drive: "d:",
    root: null,
    file: null,
  },
  {
    url: () => new Url ('file:') .set ({ drive:'e|' }),
    href: "file:/e|",
    scheme: "file",
    host: null,
    drive: "e|",
    root: null,
    file: null,
  },
  {
    url: () => new Url ('file:') .set ({ drive:'f:' }),
    href: "file:/f:",
    scheme: "file",
    host: null,
    drive: 'f:',
    root: null,
    file: null,
  },
  {
    // TODO is indeed /d| the serialization I like for [[DRIVE, 'd|']] ?
    // NB currently all of `d|`, `/d|`, `//d|` are parsed as such. 
    url: () => new Url () .set ({ drive:'d|' }), // implies root:true
    href: "/d|",
    scheme: null,
    host: null,
    drive: 'd|',
    root: null,
  },
  {
    // TODO: Should this raise an error, or require a detectDrive option?
    url: () => new Url ('foo.txt') .set ({ drive:'d|' }), // implies root:true
    href: "/d|/foo.txt",
    scheme: null,
    host: null,
    drive: 'd|',
    root: '/',
  },
  {
    url: () => new Url ('file:') .set ({ drive:'g|d' }),
    error: 'ERR_INVALID_DRIVE',
  },


  // setFile tests

  {
    url: () => new Url ('file://foo') .set ({ file:'foo.txt' }),
    href: 'file://foo/foo.txt',
    scheme: 'file',
    host: 'foo',
    drive: null,
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file://c:') .set ({ file:'foo.txt' }),
    href: 'file:/c:/foo.txt',
    scheme: 'file',
    host: null,
    drive: 'c:',
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file:/c:') .set ({ file:'foo.txt' }),
    href: 'file:/c:/foo.txt',
    scheme: 'file',
    host: null,
    drive: 'c:',
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file://c:') .set ({ root:true, file:'foo.txt' }),
    href: 'file:/c:/foo.txt',
    scheme: 'file',
    host: null,
    drive: 'c:',
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file:/c:') .set ({ root:true, file:'foo.txt' }),
    href: 'file:/c:/foo.txt',
    scheme: 'file',
    host: null,
    drive: 'c:',
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file:///') .set ({ file:'foo.txt' }),
    href: 'file:///foo.txt',
    scheme: 'file',
    host: '',
    drive: null,
    root: '/',
    file: 'foo.txt',
  },
  {
    url: () => new Url ('file:///') .set ({ file:'foo.txt' }) .set ({ file:'boo.txt' }),
    href: 'file:///boo.txt',
    scheme: 'file',
    host: '',
    drive: null,
    root: '/',
    file: 'boo.txt',
  },

  // Drive letter tests
  // REVIEW: parsing //c: as /c:

  {
    url: 'C|',
    scheme: null,
    drive: null,
    root: null,
    host: null,
    file: 'C|'
  },
  {
    url: 'file:C|',
    scheme: 'file',
    drive: 'C|',
    root: null,
    host: null,
    file: null
  },
  {
    url: () => new Url ('C|', { parser:'file' }),
    scheme: null,
    drive: 'C|',
    root: null,
    host: null,
    file: null
  },
  {
    url: 'http://C|',
    drive: null,
    root: null,
    host: 'C|',
    file: null
  },
  {
    url: () => new Url ('/D:/') .goto ('http:C|/'),
    drive: null,
    root: null,
    host: null,
    file: null
  },
  {
    url: 'http://foo@localhost/D:/',
    drive: null,
    root: '/',
    host:'localhost',
    file: null
  },


  // Auth parser tests

  {
    url: 'http://[foo]',
    user: null,
    pass: null,
    host: '[foo]',
    port: null
  },
  {
    url: 'httP://[as]@foo:1',
    user: '[as]',
    pass: null,
    host: 'foo',
    port: 1
  },
  {
    url: () => new Url ('http://f:/c'),
    scheme: 'http',
    host: 'f',
    port: null
  },


  // TODO
  /*
  {
    url: 'http://[as@foo:1]:1',
    host: '',
    user: '',
    pass: '',
    port: ''
  },
  {
    url: 'http://[as:foo@:1]:0',
    host:'',
    user:'',
    pass:'',
    port:''
  },
  {
    url: 'http://[as:foo:0',
    host:'',
    user:'',
    pass:'',
    port:''
  },
  {
    url: 'http://[as:f]@oo:19=0@bii',
    host:'',
    user:'',
    pass:'',
    port:''
  },
  */

  // Relative URL default configuration test
  
  { url: '//host/c:/dir/file'
  , drive: null
  },

  { url: '//host:80\\file'
  , file: 'file'
  },

  // Absolute URL default configuration test

  { url: 'http:\\\\host:80\\file'
  , file: 'file'
  , host: 'host'
  },


  { url: 'http://example.com\\\\foo\\\\bar/'
  , href: 'http://example.com//foo//bar/'
  },


  // Other tests

  {
    url: () => new Url ('//[user@foo]@foo/boo') .set ({ port:'iii' }),
    error: 'ERR_INVALID_PORT',
  },
  {
    url: () => new Url ('#foo') .set ({ port:'1' }),
    error: 'ERR_NOAUTH',
  },
  {
    url: '//[user@foo]@foo/boo',
    drive: null,
    root: '/',
    host: 'foo',
    port: null,
    file: 'boo'
  },
  {
    url: '//[0:0:0:0:0:0:13.1.68.3]@host/foo',
    drive: null,
    root: '/',
    host: 'host',
    port: null,
    file: 'foo'
  },


  // Normalization tests

  {
    url: () => new Url ('http://host:80/dir') .normalize (),
    scheme: 'http',
    root: '/',
    host: 'host',
    port: null,
  },


  // 'Force' tests
  
  {
    url: () => new Url ('http:www.example.com') .force (),
    href: 'http://www.example.com' // Question, should force also add root?
  },


  // PercentCoding Tests
  
  {
    url: () =>
      new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF', { percentCoding:'decode' })
      .set ({ hash:'%43' }),
    file: 'B',
    hash: '%2543',
    query: '🌿'
  },
  {
    url: () => {
      var r = new Url ('http://foo/🌿🦍/%42?%F0%9F%8C%BF', { percentCoding:'decode' })
      return new Url (r, { percentCoding:'preserve' }) .set ({ hash: '%43' })
    },
    file: 'B',
    hash: '%43',
    query: '🌿'
  },
  {
    url: () => 
      new Url (null, { percentCoding:'decode' }) 
        .set ({ host: '%66%6f%6f', percentCoded:true })
        .set ({ file: 'file-with-%-sign' }),
    host: 'foo',
    file: 'file-with-%-sign',
    href: '//foo/file-with-%25-sign',
    percentCoded: false,
  },
  {
    url: () => new Url (null, { percentCoding:'preserve'}) 
      .set ({ host: '%66%6f%6f' })
      .set ({ file: 'file-with-%-sign', percentCoded:false }),
    host: '%66%6f%6f',
    file: 'file-with-%25-sign',
    href: '//%66%6f%6f/file-with-%25-sign',
    percentCoded: true,
  },

  
  // Resolve tests

  {
    _: 'See if resolve works',
    url: () => new Url ('http:file.txt') .resolve ('http://host/'),
    href: 'http://host/file.txt'
  },
  {
    _: 'See if it works with different percentCoding settings',
    url: () => new Url ('http:with-%25-sign.txt') .resolve ('http://%66%6f%6f'),
    href: 'http://foo/with-%25-sign.txt'
  },
  {
    url: () => new Url ('http:/with-%25-sign.d/%66%6f%6f.txt', { percentCoding: 'preserve' }) .resolve (new Url('http://%66-%25-%6f%6f')),
    href: 'http://f-%25-oo/with-%25-sign.d/%66%6f%6f.txt',
    percentCoded: true,
    host: 'f-%25-oo'
  },
  {
    _: '... And respects schemes',
    url: () => new Url ('http:file.txt') .resolve ('file://host/'),
    href: 'http:file.txt'
  },
  {
    _: '... And works with host-relative URLs',
    url: () => new Url ('htTP:file.txt#hash') .resolve ('HTtp://host/dir/'),
    href: 'htTP://host/dir/file.txt#hash',
  },


  // Force tests
  
  {
    url: ( ) => new Url ('http:www.example.com') .force (),
    href: 'http://www.example.com' // Force does not add root!
  },
  {
    url: () => new Url ('http:foo/bar/baz'). force (),
    host: 'foo',
    dirs: ['bar'],
    file: 'baz',
  },
  {
    url: () => new Url ('http:/jack@foo/bar/baz'). force (),
    user: 'jack',
    pass: null,
    host: 'foo',
    dirs: ['bar'],
    file: 'baz',
  },
  {
    url: () => new Url ('http:////jack@foo/'). force (),
    user: 'jack',
    pass: null,
    host: 'foo',
  },
  {
    url: () => new Url ('http:////jack@foo'). force (),
    user: 'jack',
    pass: null,
    host: 'foo',
  },
  {
    url: () => new Url ('http:////'). force (),
    error: 'ERR_FORCE_FAILED',
  },
]
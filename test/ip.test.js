const log = console.log.bind (console)
const assert = require ('assert').strict
  assert.equals = assert.equal
  assert.deepEquals = assert.deepEqual

// IPv4 samples
{
const { normalize } = require ('../lib/ipv4')
  
var samples = `
192.0x00A80001
0xc0.0250.01
0xc0.0250.01.
192.168.257
256
999999999
4294967295
0x.0x.0
0xfffffff`
  . split ('\n')
  . filter (_ => _ != '')
 

samples. map (s => log ('\n', s, '\n', s.replace (/./g, '='), '\n',
normalize (s)))
}

//*/

{
const { parse, print, normalize } = require ('../lib/ipv6.js')

assert.throws ($ => parse ('0::0::0'))
assert.throws ($ => parse ('::1.2.3.'))

//*
var samples = `
1:0::
0:1:0:1:0:1:0:1
::127.0.0.1
2001:DB8:0:0:8:800:200C:417A
FF01:0:0:0:0:0:0:101
0:0:0:0:0:0:0:1
0:0:0:0:0:0:0:0
2001:DB8::8:800:200C:417A
0:0:0:0:0:0:13.1.68.3
::13.1.68.3
0:0:0:0:0:FFFF:129.144.52.38
::FFFF:129.144.52.38
FF01::101
::1
::` .split ('\n').filter (_ => _.length)

samples. map (s => log ('\n', s, '\n', s.replace (/./g, '='), '\n', normalize (s)))
}//*/

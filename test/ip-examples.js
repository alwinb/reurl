import { ipv4, ipv6 } from '../lib/host'
import assert from 'assert/strict'
assert.equals = assert.equal
assert.deepEquals = assert.deepEqual
const log = console.log.bind (console)

const head = s => {
  log ('\n' + s)
  log (new Array (s.length+1).join ('-'), '\n') }


// IPv4 Examples
// -------------

const ip4Samples = `
192.0x00A80001
0xc0.0250.01
0xc0.0250.01.
192.168.257
256
999999999
4294967295
0x.0x.0
0xfffffff
`.split ('\n') .filter (_ => _ != '')


function testIp4 () {
  head ('Ipv4 examples')
  ip4Samples.forEach (s => log (
    ' >', s,
    '\n=>', ipv4.normalise (s), '\n'
  ))
}

// IPv6 Examples
// -------------

const ip6Samples = `
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

function testIp6 () {
  head ('Ipv6 examples')
  const { parse, print, normalise } = ipv6

  assert.throws ($ => parse ('0::0::0'))
  assert.throws ($ => parse ('::1.2.3.'))

  ip6Samples.forEach (s => log (
    ' >', s,
    '\n=>', normalise (s), '\n'
  ))
}


// Run examples
// ------------

testIp4 ()
testIp6 ()

import testset from './reurl-assert.js'
import testSet from './web-assert.js'
const log = console.log.bind (console)

log ('           Reurl tests            ')
log ('==================================')
const a = testset.run ()
log ('\n')

log ('      Web Platform URL Tests      ')
log ('==================================')
const b = testSet.run ()
log ('\n')

process.exit (a && b ? 0 : 1)
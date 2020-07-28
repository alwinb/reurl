const log = console.log.bind (console)


log ('           Reurl tests            ')
log ('==================================')
const a = require ('./reurl-assert') .run ()
log ('\n')

log ('      Web Platform URL Tests      ')
log ('==================================')
const b = require ('./web-assert') .run ()
log ('\n')

process.exit (a && b ? 0 : 1)
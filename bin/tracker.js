#!/usr/bin/env node

const { startTracker } = require('../src/composition')

const port = process.argv[2] || 30300
const ip = process.argv[3] || '127.0.0.1'
const maxNeighborsPerNode = process.argv[4] || 4
const id = `tracker-${port}`

startTracker(ip, port, id, maxNeighborsPerNode)
    .then((tracker) => {
        setInterval(async () => {
            console.log(await tracker.getMetrics())
        }, 5000)
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

if (process.env.checkUncaughtException === 'true') {
    process.on('uncaughtException', (err) => console.error((err && err.stack) ? err.stack : err))
}


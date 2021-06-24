const { format } = require('util')
const { Benchmark } = require('benchmark')

// eslint-disable-next-line import/no-unresolved
const StreamrClient = require('../../dist')
const clientOptions = require('../integration/config')

// note this is not the number of messages, just the start number
let count = 100000 // pedantic: use large initial number so payload size is similar
const Msg = () => {
    count += 1
    return {
        value: `msg${count}`
    }
}

function createClient(opts) {
    return new StreamrClient({
        ...clientOptions,
        ...opts,
    })
}

async function setupClientAndStream(clientOpts, streamOpts) {
    const client = createClient(clientOpts)
    await client.connect()
    await client.session.getSessionToken()

    const stream = await client.createStream({
        id: `/test-stream-${client.id}`,
        ...streamOpts,
    })
    return [client, stream]
}

const BATCH_SIZES = [
    1,
    32,
    512,
    1024,
]

const log = (...args) => process.stderr.write(format(...args) + '\n')

async function run() {
    const account1 = StreamrClient.generateEthereumAccount()
    const [client1, stream1] = await setupClientAndStream({
        auth: {
            privateKey: account1.privateKey,
        },
        publishWithSignature: 'always',
    })

    const account2 = StreamrClient.generateEthereumAccount()
    const [client2, stream2] = await setupClientAndStream({
        auth: {
            privateKey: account2.privateKey,
        },
        publishWithSignature: 'never',
    })

    const account3 = StreamrClient.generateEthereumAccount()
    const [client3, stream3] = await setupClientAndStream({
        auth: {
            privateKey: account3.privateKey,
        },
        publishWithSignature: 'always',
    }, {
        requiresEncryption: true,
    })

    const suite = new Benchmark.Suite()

    async function publish(stream, batchSize) {
        const msgs = []
        for (let i = 0; i < batchSize; i++) {
            msgs.push(Msg())
        }

        await Promise.all(msgs.map((msg) => stream.publish(msg)))
        return msgs
    }

    function test(client, stream, batchSize) {
        return async function Fn(deferred) {
            this.BATCH_SIZE = batchSize
            const received = []
            let msgs
            const sub = await client.subscribe(stream.id, (msg) => {
                received.push(msg)
                if (msgs && received.length === msgs.length) {
                    // eslint-disable-next-line promise/catch-or-return
                    sub.unsubscribe().then(() => deferred.resolve(), () => deferred.resolve())
                }
            })
            msgs = await publish(stream, batchSize)
        }
    }

    BATCH_SIZES.forEach((batchSize) => {
        suite.add(`client subscribing in batches of ${batchSize} with signing`, {
            defer: true,
            fn: test(client1, stream1, batchSize)
        })

        suite.add(`client subscribing in batches of ${batchSize} without signing`, {
            defer: true,
            fn: test(client2, stream2, batchSize)
        })

        suite.add(`client subscribing in batches of ${batchSize} with encryption`, {
            defer: true,
            fn: test(client3, stream3, batchSize)
        })
    })

    function toStringBench(bench) {
        const { error, id, stats } = bench
        let { hz } = bench
        hz *= bench.BATCH_SIZE // adjust hz by batch size
        const size = stats.sample.length
        const pm = '\xb1'
        let result = bench.name || (Number.isNaN(id) ? id : '<Test #' + id + '>')
        if (error) {
            return result + ' Error'
        }

        result += ' x ' + Benchmark.formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) + ' ops/sec ' + pm
            + stats.rme.toFixed(2) + '% (' + size + ' run' + (size === 1 ? '' : 's') + ' sampled)'
        return result
    }

    suite.on('cycle', (event) => {
        log(toStringBench(event.target))
    })

    suite.on('complete', async () => {
        log('Disconnecting clients')
        const tasks = [
            client1.disconnect(),
            client2.disconnect(),
            client3.disconnect(),
        ]
        await Promise.allSettled(tasks)
        await Promise.all(tasks)
        log('Clients disconnected')
    })

    suite.run()
}

run()

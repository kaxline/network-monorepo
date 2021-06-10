import { StreamrClient } from '../../src/StreamrClient'
import { Stream, StreamProperties } from '../../src/stream'
import { uid } from '../utils'
// import { StorageNode } from '../../src/stream/StorageNode'

import config from './config'
// import { log } from 'util'

jest.setTimeout(15000)

const createClient = (opts = {}) => new StreamrClient({
    ...config.clientOptions,
    autoConnect: false,
    autoDisconnect: false,
    ...opts,
})

describe('Stream', () => {
    let client: StreamrClient
    let testProps: StreamProperties
    let streamId: string
    // let stream: Stream

    beforeAll(async () => {
        client = createClient()
        await client.connect()
        const randompath = '/' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10)
        testProps = {
            name: uid('stream-integration-test'),
            path: randompath
        }
        streamId = await (await client.ethereum.getAddress()).toLowerCase() + randompath
        // await stream.addToStorageNode(StorageNode.STREAMR_DOCKER_DEV)
    })

    afterAll(async () => {
        await client.disconnect()
    })

    describe('onchainStreams', () => {
        it('createStream', async () => {
            console.log(streamId)

            const stream : Stream = await client.createStream(testProps)
            expect(stream.name).toEqual(testProps.name)
            expect(stream.id).toEqual(streamId)
        })
        it('getStreamById', async () => {
            console.log(streamId)
            const stream : Stream = await client.getStream(streamId)
            expect(stream.id).toEqual(streamId)
            expect(stream.name).toEqual(testProps.name)
        })
    })

    // describe('detectFields()', () => {
    //     it('does detect primitive types', async () => {
    //         const msg = {
    //             number: 123,
    //             boolean: true,
    //             object: {
    //                 k: 1,
    //                 v: 2,
    //             },
    //             array: [1, 2, 3],
    //             string: 'test',
    //         }
    //         const publishTestMessages = getPublishTestMessages(client, {
    //             streamId: stream.id,
    //             waitForLast: true,
    //             createMessage: () => msg,
    //         })
    //         await publishTestMessages(1)

    //         expect(stream.config.fields).toEqual([])
    //         await stream.detectFields()
    //         const expectedFields = [
    //             {
    //                 name: 'number',
    //                 type: 'number',
    //             },
    //             {
    //                 name: 'boolean',
    //                 type: 'boolean',
    //             },
    //             {
    //                 name: 'object',
    //                 type: 'map',
    //             },
    //             {
    //                 name: 'array',
    //                 type: 'list',
    //             },
    //             {
    //                 name: 'string',
    //                 type: 'string',
    //             },
    //         ]

    //         expect(stream.config.fields).toEqual(expectedFields)
    //         const loadedStream = await client.getStream(stream.id)
    //         expect(loadedStream.config.fields).toEqual(expectedFields)
    //     })

    // it('skips unsupported types', async () => {
    //     const msg = {
    //         null: null,
    //         empty: {},
    //         func: () => null,
    //         nonexistent: undefined,
    //         symbol: Symbol('test'),
    //         // TODO: bigint: 10n,
    //     }
    //     const publishTestMessages = getPublishTestMessages(client, {
    //         streamId: stream.id,
    //         waitForLast: true,
    //         createMessage: () => msg,
    //     })
    //     await publishTestMessages(1)

    //     expect(stream.config.fields).toEqual([])
    //     await stream.detectFields()
    //     const expectedFields = [
    //         {
    //             name: 'null',
    //             type: 'map',
    //         },
    //         {
    //             name: 'empty',
    //             type: 'map',
    //         },
    //     ]

    //     expect(stream.config.fields).toEqual(expectedFields)

    //     const loadedStream = await client.getStream(stream.id)
    //     expect(loadedStream.config.fields).toEqual(expectedFields)
    // })
    // })
})

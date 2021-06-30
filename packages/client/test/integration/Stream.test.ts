import { StreamrClient } from '../../src/StreamrClient'
import { Stream, StreamPermission, StreamProperties } from '../../src/stream'
import { uid } from '../utils'
// import { StorageNode } from '../../src/stream/StorageNode'

import config from './config'
import { EthereumAddress } from '../../src'
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
    let userAddress: EthereumAddress
    // let stream: Stream

    beforeAll(async () => {
        client = createClient()
        // await client.connect()
        const randompath = '/' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10)
        testProps = {
            name: uid('stream-integration-test'),
            path: randompath
        }
        userAddress = (await client.ethereum.getAddress()).toLowerCase()
        streamId = await userAddress + randompath
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
        it('getAllPermissionsForStream', async () => {
            console.log(streamId)
            const stream : Stream = await client.getStream(streamId)
            expect(stream.id).toEqual(streamId)
            expect(stream.name).toEqual(testProps.name)
            const permissions : StreamPermission[] = await stream.getMyPermissions()
            // expect(permissions[0].operation).toEqual(StreamOperation.STREAM_EDIT)
            // expect(permissions[1].operation).toEqual(StreamOperation.STREAM_DELETE)
            // expect(permissions[2].operation).toEqual(StreamOperation.STREAM_SUBSCRIBE)
            // expect(permissions[3].operation).toEqual(StreamOperation.STREAM_PUBLISH)
            // expect(permissions[4].operation).toEqual(StreamOperation.STREAM_SHARE)
            for (const permission of permissions) {
                // const directpermission: StreamPermission = permission as StreamPermission
                expect(permission.user.toLowerCase()).toEqual(userAddress)
            }
        })
        it('listStreams', async () => {
            // console.log(streamId)
            setTimeout(async () => {
                const res = await client.listStreams({})
                console.log(res)
                let containsTestStream = false
                for (const stream of res) {
                    if (stream.id === streamId) {
                        containsTestStream = true
                        break
                    }
                }
                expect(containsTestStream).toEqual(true)
            }, 5000)

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

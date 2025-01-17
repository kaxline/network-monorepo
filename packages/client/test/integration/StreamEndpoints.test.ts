import { Wallet } from 'ethers'
import { v4 as uuid } from 'uuid'

import { clientOptions, uid, createTestStream, until, fakeAddress, createRelativeTestStreamId, getPrivateKey } from '../utils'
import { NotFoundError } from '../../src/authFetch'
import { StreamrClient } from '../../src/StreamrClient'
import { Stream, StreamPermission } from '../../src/Stream'
import { storageNodeTestConfig } from './devEnvironment'
import { SearchStreamsOptions } from '../../src/StreamRegistry'

jest.setTimeout(40000)

const getName = () => uid('test-stream/slashes')

/**
 * These tests should be run in sequential order!
 */
describe('StreamEndpoints', () => {

    let client: StreamrClient
    let wallet: Wallet
    let createdStream: Stream
    let otherWallet: Wallet
    let storageNodeAddress: string

    beforeAll(async () => {
        wallet = new Wallet(await getPrivateKey())
        otherWallet = new Wallet(await getPrivateKey())
        client = new StreamrClient({
            ...clientOptions,
            auth: {
                privateKey: wallet.privateKey,
            },
        })
    })

    beforeAll(async () => {
        createdStream = await createTestStream(client, module, {
            name: getName(),
            requireSignedData: true,
            requireEncryptedData: false,
        })
        const storageNodeWallet = new Wallet(storageNodeTestConfig.privatekey)
        // const storageNodeClient = new StreamrClient({
        //     ...clientOptions,
        //     auth: {
        //         privateKey: storageNodeWallet.privateKey,
        //     },
        // })
        // await storageNodeClient.setNode(storageNodeTestConfig.url)
        storageNodeAddress = storageNodeWallet.address
        // storageNode = await client.getStorageNode(await storageNodeWallet.getAddress())
    })

    describe('createStream', () => {
        it('creates a stream with correct values', async () => {
            const name = getName()
            const id = await createRelativeTestStreamId(module)
            const stream = await client.createStream({
                id,
                name,
                requireSignedData: true,
                requireEncryptedData: true,
            })
            await until(async () => { return client.streamExistsOnTheGraph(stream.streamId) }, 100000, 1000)
            expect(stream.id).toBeTruthy()
            return expect(stream.name).toBe(name)
        })

        it('valid id', async () => {
            const newId = `${wallet.address.toLowerCase()}/StreamEndpoints-createStream-newId-${Date.now()}`
            const newStream = await client.createStream({
                id: newId,
            })
            await until(async () => { return client.streamExistsOnTheGraph(newId) }, 100000, 1000)
            expect(newStream.id).toEqual(newId)
        })

        it('valid path', async () => {
            const newPath = `/StreamEndpoints-createStream-newPath-${Date.now()}`
            const expectedId = `${wallet.address.toLowerCase()}${newPath}`
            const newStream = await client.createStream({
                id: newPath,
            })
            await until(async () => { return client.streamExistsOnTheGraph(expectedId) }, 100000, 1000)
            expect(newStream.id).toEqual(expectedId)
        })

        it('invalid id', async () => {
            await expect(async () => client.createStream({ id: 'invalid.eth/foobar' })).rejects.toThrow()
        })
    })

    describe('getStream', () => {
        it('get an existing Stream', async () => {
            const stream = await createTestStream(client, module)
            const existingStream = await client.getStream(stream.id)
            expect(existingStream.id).toEqual(stream.id)
        })

        it('get a non-existing Stream', async () => {
            const streamid = `${wallet.address.toLowerCase()}/StreamEndpoints-nonexisting-${Date.now()}`
            return expect(() => client.getStream(streamid)).rejects.toThrow(NotFoundError)
        })

        it('get all Streams', async () => {
            const streams = await client.getAllStreams()
            const streamsPagesize2 = await client.getAllStreams(1)
            expect(streams).toEqual(streamsPagesize2)
        })
    })

    describe('getOrCreate', () => {
        it('existing Stream by id', async () => {
            const existingStream = await client.getOrCreateStream({
                id: createdStream.id,
            })
            expect(existingStream.id).toBe(createdStream.id)
            return expect(existingStream.name).toBe(createdStream.name)
        })

        it('new Stream by id', async () => {
            const newId = `${wallet.address.toLowerCase()}/StreamEndpoints-getOrCreate-newId-${Date.now()}`
            const newStream = await client.getOrCreateStream({
                id: newId,
            })
            return expect(newStream.id).toEqual(newId)
        })

        it('new Stream by path', async () => {
            const newPath = `/StreamEndpoints-getOrCreate-newPath-${Date.now()}`
            const newStream = await client.getOrCreateStream({
                id: newPath,
            })
            expect(newStream.id).toEqual(`${wallet.address.toLowerCase()}${newPath}`)

            // ensure can get after create i.e. doesn't try create again
            const sameStream = await client.getOrCreateStream({
                id: newPath,
            })
            expect(sameStream.id).toEqual(newStream.id)
        })

        it('fails if stream prefixed with other users address', async () => {
            // can't create streams for other users
            const otherAddress = `0x${fakeAddress()}`
            const newPath = `/StreamEndpoints-getOrCreate-newPath-${Date.now()}`
            // backend should error
            await expect(async () => {
                await client.getOrCreateStream({
                    id: `${otherAddress}${newPath}`,
                })
            }).rejects.toThrow(`stream id "${otherAddress}${newPath}" not in namespace of authenticated user "${wallet.address.toLowerCase()}"`)
        })
    })

    describe('searchStreams', () => {
        it('filters by given criteria (match)', async () => {
            const result = await client.searchStreams(createdStream.id)
            expect(result.length).toBe(1)
            return expect(result[0].id).toBe(createdStream.id)
        })

        it('escaped char', async () => {
            const description = 'searchStreams.escapedChar"' + Date.now()
            await createTestStream(client, module, {
                description
            })
            // the content is escaped twice because it is stored in a JSON field ("description")
            // in a strigifyed JSON ("metadata" object)
            const result = await client.searchStreams(description.replace('"', '\\\\"'))
            expect(result.length).toBe(1)
        })

        it('filters by given criteria (no match)', async () => {
            const result = await client.searchStreams(`non-existent-${Date.now()}`)
            return expect(result.length).toBe(0)
        })

        /* eslint-disable no-await-in-loop */
        it('max and offset', async () => {
            const streamIds = []
            const searchTerm = `searchStreams-${Date.now()}`
            for (let i = 0; i < 3; i++) {
                const orderSuffix = uuid()
                const path = await createRelativeTestStreamId(module, orderSuffix)
                const stream = await client.createStream({
                    id: path,
                    description: searchTerm
                })
                streamIds.push(stream.id)
            }
            streamIds.sort()
            await until(async () => {
                const streams = await client.searchStreams(searchTerm)
                return streams.length === streamIds.length
            }, 20000, 1000)

            const searchStreamsIds = async (query: SearchStreamsOptions) => {
                const streams = await client.searchStreams(searchTerm, {
                    order: 'asc',
                    ...query
                })
                return streams.map((s) => s.id)
            }

            const resultList1 = await searchStreamsIds({
                max: 2
            })
            expect(resultList1).toEqual([streamIds[0], streamIds[1]])
            const resultList2 = await searchStreamsIds({
                max: 2,
                offset: 1
            })
            expect(resultList2).toEqual([streamIds[1], streamIds[2]])
        })
    })

    describe('getStreamLast', () => {
        it('does error if has no storage assigned', async () => {
            await expect(async () => {
                await client.getStreamLast(createdStream.id)
            }).rejects.toThrow()
        })

        it('does not error if has storage assigned', async () => {
            const stream = await client.createStream({
                id: await createRelativeTestStreamId(module),
            })
            await stream.addToStorageNode(storageNodeAddress)
            await until(async () => { return client.isStreamStoredInStorageNode(stream.id, storageNodeAddress) }, 100000, 1000)
            const result = await client.getStreamLast(stream.id)
            expect(result).toEqual([])
        })
    })

    describe('getStreamPublishers', () => {
        it('retrieves a list of publishers', async () => {
            const publishers = await client.getStreamPublishers(createdStream.id)
            const address = await client.getAddress()
            return expect(publishers).toEqual([address])
        })
        it('retrieves a list of publishers, pagination', async () => {
            await createdStream.grantUserPermission(StreamPermission.PUBLISH, fakeAddress())
            await createdStream.grantUserPermission(StreamPermission.PUBLISH, fakeAddress())
            const allPublishers = await client.getStreamPublishers(createdStream.id, 1000)
            const pagedPublishers = await client.getStreamPublishers(createdStream.id, 2)
            return expect(pagedPublishers).toEqual(allPublishers)
        })
    })

    describe('isStreamPublisher', () => {
        it('returns true for valid publishers', async () => {
            const address = await client.getAddress()
            const valid = await client.isStreamPublisher(createdStream.id, address)
            return expect(valid).toBeTruthy()
        })
        it('returns trow error for invalid udseraddress', async () => {
            return expect(() => client.isStreamPublisher(createdStream.id, 'some-invalid-address')).rejects.toThrow()
        })
        it('returns false for invalid publishers', async () => {
            const valid = await client.isStreamPublisher(createdStream.id, fakeAddress())
            return expect(!valid).toBeTruthy()
        })
    })

    describe('getStreamSubscribers', () => {
        it('retrieves a list of subscribers', async () => {
            const subscribers = await client.getStreamSubscribers(createdStream.id)
            const address = await client.getAddress()
            return expect(subscribers).toEqual([address])
        })
        it('retrieves a list of subscribers, pagination', async () => {
            await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, fakeAddress())
            await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, fakeAddress())
            const allSubscribers = await client.getStreamPublishers(createdStream.id, 1000)
            const pagedSubscribers = await client.getStreamPublishers(createdStream.id, 2)
            return expect(pagedSubscribers).toEqual(allSubscribers)
        })
    })

    describe('isStreamSubscriber', () => {
        it('returns true for valid subscribers', async () => {
            const address = await client.getAddress()
            const valid = await client.isStreamSubscriber(createdStream.id, address)
            return expect(valid).toBeTruthy()
        })
        it('returns trow error for invalid udseraddress', async () => {
            return expect(() => client.isStreamSubscriber(createdStream.id, 'some-invalid-address')).rejects.toThrow()
        })
        it('returns false for invalid subscribers', async () => {
            const valid = await client.isStreamSubscriber(createdStream.id, fakeAddress())
            return expect(!valid).toBeTruthy()
        })
    })

    describe('Stream.update', () => {
        it('can change stream name', async () => {
            createdStream.name = 'Newname'
            await createdStream.update()
            await until(async () => {
                try {
                    return (await client.getStream(createdStream.id)).name === createdStream.name
                } catch (err) {
                    return false
                }
            }, 100000, 1000)
            const stream = await client.getStream(createdStream.id)
            return expect(stream.name).toEqual(createdStream.name)
        })
    })

    describe('Stream permissions', () => {
        const INVALID_USER_IDS = [
            '',
            0,
            1,
            /regex/,
            {},
            false,
            true,
            Symbol('test'),
            function test() {},
            new Date(0),
            Infinity,
            Number.NaN,
            new Error('invalid')
            // null, undefined are the public user.
        ]

        it('Stream.getPermissions', async () => {
            const stream = await createTestStream(client, module)
            await stream.grantPublicPermission(StreamPermission.PUBLISH)
            const permissions = await stream.getPermissions()
            return expect(permissions).toEqual({
                [wallet.address.toLowerCase()]: [
                    StreamPermission.EDIT,
                    StreamPermission.DELETE,
                    StreamPermission.PUBLISH,
                    StreamPermission.SUBSCRIBE,
                    StreamPermission.GRANT
                ],
                public: [StreamPermission.PUBLISH]
            })
        })

        describe('Stream.hasPermission', () => {
            it('gets permission', async () => {
                expect(await createdStream.hasUserPermission(StreamPermission.GRANT, wallet.address)).toBeTruthy()
                expect(await createdStream.hasUserPermission(StreamPermission.GRANT, otherWallet.address)).not.toBeTruthy()
            })

            it('errors if invalid userId', async () => {
                for (const invalidId of INVALID_USER_IDS) {
                    // eslint-disable-next-line no-await-in-loop, no-loop-func
                    await expect(async () => {
                        // @ts-expect-error should require userId, this is part of the test
                        await createdStream.hasUserPermission(StreamPermission.GRANT, invalidId)
                    }).rejects.toThrow()
                }
            })
        })

        describe('Stream.grantPermission', () => {
            it('creates public permissions when passed undefined', async () => {
                await createdStream.grantPublicPermission(StreamPermission.SUBSCRIBE) // public read
                expect(await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)).toBeTruthy()
            })

            it('creates user permissions when passed user id', async () => {
                await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address) // user read
                expect(await createdStream.hasUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)).toBeTruthy()
            })

            it('sets Permissions for multiple users in one transaction', async () => {
                const userA = fakeAddress()
                const userB = fakeAddress()
                const permissionA = {
                    canEdit: true,
                    canDelete: true,
                    canPublish: true,
                    canSubscribe: true,
                    canGrant: true
                }
                const permissionB = {
                    canEdit: false,
                    canDelete: false,
                    canSubscribe: false,
                    canPublish: false,
                    canGrant: false
                }

                await createdStream.setPermissions([userA, userB], [permissionA, permissionB]) // user read
                expect(await createdStream.hasUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)).toBeTruthy()
            })

            // it('does not error if creating multiple permissions in parallel', async () => {
            //     await Promise.all([
            //         createdStream.grantUserPermission(StreamPermission.SHARE, otherWallet.address),
            //     ])
            //     expect(await createdStream.hasUserPermission(StreamPermission.SHARE, otherWallet.address)).toBeTruthy()
            // })

            // it('does not error or create duplicates if creating multiple identical permissions in parallel', async () => {
            //     await createdStream.revokeAllUserPermissions(otherWallet.address)
            //     await Promise.all([
            //         createdStream.grantUserPermission(StreamPermission.PUBLISH, otherWallet.address),
            //         createdStream.grantUserPermission(StreamPermission.PUBLISH, otherWallet.address),
            //         createdStream.grantUserPermission(StreamPermission.PUBLISH, otherWallet.address),
            //         createdStream.grantUserPermission(StreamPermission.PUBLISH, otherWallet.address),
            //     ])
            //     expect(await createdStream.hasUserPermission(StreamPermission.PUBLISH, otherWallet.address)).toBeTruthy()
            //     expect(await createdStream.getUserPermissions(otherWallet.address)).toHaveLength(1)
            // })

            it('does not grant multiple permissions for same permission + user', async () => {
                await createdStream.grantPublicPermission(StreamPermission.SUBSCRIBE) // public read
                const previousPermissions = await createdStream.getPermissions()
                await createdStream.grantPublicPermission(StreamPermission.SUBSCRIBE) // public read
                const permissions = await createdStream.getPermissions()
                expect(permissions).toEqual(previousPermissions)
            })

            it('errors if invalid userId', async () => {
                for (const invalidId of INVALID_USER_IDS) {
                    // eslint-disable-next-line no-await-in-loop, no-loop-func
                    await expect(async () => {
                        // @ts-expect-error should require userId, this is part of the test
                        await createdStream.grantUserPermission(StreamPermission.GRANT, invalidId)
                    }).rejects.toThrow()
                }
            })
        })

        describe('Stream.revokePermission', () => {
        //     it('removes permission by id', async () => {
        //         const publicRead = await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)
        //         await createdStream.revokeUserPermission(publicRead!.id)
        //         expect(await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)).not.toBeTruthy()
        //     })

            it('does not error if not found', async () => {
                await createdStream.grantPublicPermission(StreamPermission.SUBSCRIBE) // public read
                await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)
                await createdStream.revokePublicPermission(StreamPermission.SUBSCRIBE)
                expect(await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)).not.toBeTruthy()
            })

            it('errors if invalid permission id', async () => {
                const INVALID_PERMISSION_IDS = [
                    '',
                    -1,
                    1.5,
                    /regex/,
                    {},
                    false,
                    true,
                    Symbol('test'),
                    function test() {},
                    new Date(0),
                    Infinity,
                    -Infinity,
                    Number.NaN,
                    new Error('invalid')
                ]

                for (const invalidId of INVALID_PERMISSION_IDS) {
                    // eslint-disable-next-line no-await-in-loop, no-loop-func
                    await expect(async () => {
                        // @ts-expect-error should require valid id, this is part of the test
                        await createdStream.revokeUserPermission(invalidId)
                    }).rejects.toThrow()
                }
            })
        })

        // describe('Stream.revokePublicPermission', () => {
        //     it('removes permission', async () => {
        //         await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE)
        //         await createdStream.revokePublicPermission(StreamPermission.SUBSCRIBE)
        //         expect(await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)).not.toBeTruthy()
        //     })
        // })

        describe('Stream.revokeUserPermission', () => {
            it('removes permission', async () => {
                await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)
                await createdStream.revokeUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)
                expect(await createdStream.hasPublicPermission(StreamPermission.SUBSCRIBE)).not.toBeTruthy()
            })

            it('fails if no user id provided', async () => {
                await expect(async () => {
                    // @ts-expect-error should require userId, this is part of the test
                    await createdStream.revokeUserPermission(StreamPermission.SUBSCRIBE, undefined)
                }).rejects.toThrow()
            })
        })

        describe('Stream.grantUserPermission', () => {
            it('creates permission for user', async () => {
                await createdStream.revokeUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)
                await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address) // public read
                expect(await createdStream.hasUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)).toBeTruthy()
            })

            it('fails if no user id provided', async () => {
                await expect(async () => {
                    // @ts-expect-error should require userId, this is part of the test
                    await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, undefined)
                }).rejects.toThrow()
            })
        })

        describe('Stream.{grant,revoke,has}UserPermissions', () => {
            // it('creates & revokes permissions for user', async () => {
            //     await createdStream.revokeAllUserPermissions(otherWallet.address)
            //     expect(
            //         await createdStream.hasUserPermissions([StreamPermission.SUBSCRIBE, StreamPermission.GET], otherWallet.address)
            //     ).not.toBeTruthy()

            //     await createdStream.grantUserPermissions([StreamPermission.GET, StreamPermission.SUBSCRIBE], otherWallet.address)

            //     expect(
            //         await createdStream.hasUserPermissions([StreamPermission.SUBSCRIBE, StreamPermission.GET], otherWallet.address)
            //     ).toBeTruthy()

            //     // revoke permissions we just created
            //     await createdStream.revokeUserPermissions([StreamPermission.GET, StreamPermission.SUBSCRIBE], otherWallet.address)

            //     expect(
            //         await createdStream.hasUserPermissions([StreamPermission.SUBSCRIBE, StreamPermission.GET], otherWallet.address)
            //     ).not.toBeTruthy()
            // })

            it('fails if no user id provided', async () => {
                await expect(async () => {
                    // @ts-expect-error should require userId, this is part of the test
                    await createdStream.revokeUserPermissions([StreamPermission.SUBSCRIBE], undefined)
                }).rejects.toThrow()
            })
        })

        describe('Stream.revokeAllUserPermissions', () => {
            it('revokes all user permissions', async () => {
                await createdStream.grantUserPermission(StreamPermission.SUBSCRIBE, otherWallet.address)
                expect((await createdStream.getUserPermissions(otherWallet.address)).canSubscribe).toBe(true)
                await createdStream.revokeAllUserPermissions(otherWallet.address)
                expect(await createdStream.getUserPermissions(otherWallet.address)).toEqual(
                    {
                        canDelete: false,
                        canEdit: false,
                        canPublish: false,
                        canGrant: false,
                        canSubscribe: false
                    }
                )
            })

            it('does not fail if called twice', async () => {
                await createdStream.revokeAllUserPermissions(otherWallet.address)
                await createdStream.revokeAllUserPermissions(otherWallet.address)
            })

            it('fails if no user id provided', async () => {
                await expect(async () => {
                    // @ts-expect-error should require userId, this is part of the test
                    await createdStream.revokeAllUserPermissions(undefined)
                }).rejects.toThrow()
            })
        })

        describe('Stream.revokeAllPublicPermissions', () => {
            it('revokes all public permissions', async () => {
                await createdStream.grantPublicPermission(StreamPermission.SUBSCRIBE)
                expect((await createdStream.getPublicPermissions()).canSubscribe).toBe(true)
                await createdStream.revokeAllPublicPermissions()
                expect(await createdStream.getPublicPermissions()).toEqual(
                    {
                        canDelete: false,
                        canEdit: false,
                        canPublish: false,
                        canGrant: false,
                        canSubscribe: false
                    }
                )
            })

            it('does not fail if called twice', async () => {
                await createdStream.getPublicPermissions()
                await createdStream.getPublicPermissions()
            })
        })
    })

    describe('Stream deletion', () => {
        it('Stream.delete', async () => {
            const props = { id: await createRelativeTestStreamId(module), name: '' }
            const stream = await client.createStream(props)
            await until(() => client.streamExistsOnTheGraph(stream.id), 100000, 1000)
            await stream.delete()
            await until(async () => {
                try {
                    await client.getStream(stream.id)
                    return false
                } catch (err: any) {
                    return err.errorCode === 'NOT_FOUND'
                }
            }, 100000, 1000)
            expect(await client.streamExists(stream.id)).toEqual(false)
            return expect(client.getStream(stream.id)).rejects.toThrow()
        })

        // it('does not throw if already deleted', async () => {
        //     await createdStream.delete()
        //     await createdStream.delete()
        // })
    })

    describe('Storage node assignment', () => {
        it('add', async () => {
            // await stream.addToStorageNode(node.getAddress())// use actual storage nodes Address, actually register it
            const stream = await createTestStream(client, module)
            await stream.addToStorageNode(storageNodeAddress)
            await until(async () => { return client.isStreamStoredInStorageNode(stream.id, storageNodeAddress) }, 100000, 1000)
            const storageNodes = await stream.getStorageNodes()
            expect(storageNodes.length).toBe(1)
            expect(storageNodes[0]).toStrictEqual(storageNodeAddress.toLowerCase())
            const storedStreamParts = await client.getStreamPartsByStorageNode(storageNodeAddress)
            return expect(storedStreamParts.some(
                (sp) => (sp.streamId === stream.id) && (sp.streamPartition === 0)
            )).toBeTruthy()
        })

        it('remove', async () => {
            const stream = await createTestStream(client, module)
            await stream.addToStorageNode(storageNodeAddress)
            await until(async () => { return client.isStreamStoredInStorageNode(stream.id, storageNodeAddress) }, 100000, 1000)
            await stream.removeFromStorageNode(storageNodeAddress)
            await until(async () => { return !(await client.isStreamStoredInStorageNode(stream.id, storageNodeAddress)) }, 100000, 1000)
            const storageNodes = await stream.getStorageNodes()
            expect(storageNodes).toHaveLength(0)
            const storedStreamParts = await client.getStreamPartsByStorageNode(storageNodeAddress)
            return expect(storedStreamParts.some(
                (sp) => (sp.streamId === stream.id)
            )).toBeFalsy()
        })
    })
})

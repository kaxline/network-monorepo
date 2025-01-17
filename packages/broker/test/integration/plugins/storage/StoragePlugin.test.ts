import { MetricsContext, Protocol } from 'streamr-network'
import { StoragePlugin } from '../../../../src/plugins/storage/StoragePlugin'
import { StorageConfig } from '../../../../src/plugins/storage/StorageConfig'
import { getPrivateKey, STREAMR_DOCKER_DEV_HOST } from '../../../utils'
import { createMockStorageConfig } from './MockStorageConfig'
import { Wallet } from 'ethers'

const SPIDS: Protocol.SPID[] = [new Protocol.SPID('foo', 0), new Protocol.SPID('bar', 0)]

const createMockPlugin = async (networkNode: any) => {
    const wallet = new Wallet(await getPrivateKey())
    const brokerConfig: any = {
        client: {
            auth: {
                privateKey: wallet.privateKey
            }
        },
        plugins: {
            storage: {
                cassandra: {
                    hosts: [
                        STREAMR_DOCKER_DEV_HOST
                    ],
                    username: '',
                    password: '',
                    keyspace: 'streamr_dev_v2',
                    datacenter: 'datacenter1'
                },
                storageConfig: {
                    refreshInterval: 0
                }
            }
        }
    }
    return new StoragePlugin({
        name: 'storage',
        networkNode,
        streamrClient: {
            getNode: () => Promise.resolve({
                getMetricsContext: () => new MetricsContext(undefined as any)
            } as any)
        } as any,
        apiAuthenticator: undefined as any,
        brokerConfig,
        nodeId: wallet.address
    })
}

describe('StoragePlugin', () => {

    let networkNode: any
    let storageConfig: any
    let storageConfigFactory: any

    beforeEach(() => {
        networkNode = {
            addMessageListener: jest.fn(),
            removeMessageListener: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn()
        }
        storageConfig = createMockStorageConfig(SPIDS)
        storageConfigFactory = jest.spyOn(StorageConfig, 'createInstance')
        storageConfigFactory.mockResolvedValue(storageConfig)
    })

    afterEach(() => {
        storageConfigFactory.mockRestore()
    })

    test('happy path: start and stop', async () => {
        const plugin = await createMockPlugin(networkNode)
        await plugin.start()
        expect(networkNode.subscribe).toBeCalledTimes(SPIDS.length)
        expect(networkNode.addMessageListener).toBeCalledTimes(1)
        expect(storageConfig.startAssignmentEventListener).toBeCalledTimes(1)
        expect(storageConfig.startChainEventsListener).toBeCalledTimes(1)
        // @ts-expect-error private field
        const cassandraClose = jest.spyOn(plugin.cassandra!, 'close')
        await plugin.stop()
        expect(networkNode.unsubscribe).toBeCalledTimes(SPIDS.length)
        expect(networkNode.removeMessageListener).toBeCalledTimes(1)
        expect(storageConfig.stopAssignmentEventListener).toBeCalledTimes(1)
        expect(storageConfig.stopChainEventsListener).toBeCalledTimes(1)
        expect(storageConfig.cleanup).toBeCalledTimes(1)
        expect(cassandraClose).toBeCalledTimes(1)
    }, 10 * 1000)
})

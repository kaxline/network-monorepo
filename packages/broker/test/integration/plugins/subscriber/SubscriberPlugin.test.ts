import { Tracker } from 'streamr-network'
import { createClient, startTestTracker } from '../../../utils'
import { Wallet } from 'ethers'
import { SubscriberPlugin } from '../../../../src/plugins/subscriber/SubscriberPlugin'

const TRACKER_PORT = 12465
const wallet = Wallet.createRandom()

const createMockPlugin = async (tracker: Tracker) => {
    const brokerConfig: any = {
        client: {
            auth: {
                privateKey: wallet.privateKey
            }
        },
        plugins: {
            subscriber: {
                streams: [
                    {
                        streamId: "stream-0",
                        streamPartition: 0
                    },
                    {
                        streamId: "stream-0",
                        streamPartition: 1
                    },
                    {
                        streamId: "stream-1",
                        streamPartition: 0
                    }
                ]
            }
        }
    }
    return new SubscriberPlugin({
        name: 'subscriber',
        networkNode: undefined as any,
        streamrClient: await createClient(tracker, wallet.privateKey),
        apiAuthenticator: undefined as any,
        brokerConfig,
        nodeId: wallet.address
    })
}

describe('Subscriber Plugin', () => {
    let tracker: Tracker
    let plugin: any

    beforeAll(async () => {
        tracker = await startTestTracker(TRACKER_PORT)
        plugin = await createMockPlugin(tracker)
        await plugin.start()
    })

    afterAll(async () => {
        await Promise.allSettled([
            plugin?.stop(),
            tracker?.stop(),
        ])
    })

    it('subscribes to the configured list of streams', async () => {
        expect(plugin.streamrClient.getSubscriptions('stream-0')).toBeArrayOfSize(2)
        expect(plugin.streamrClient.getSubscriptions('stream-1')).toBeArrayOfSize(1)
    })
})

import { Tracker } from '../../src/logic/Tracker'
import { NetworkNode } from '../../src/NetworkNode'

import { MessageLayer } from 'streamr-client-protocol'
import { waitForEvent } from 'streamr-test-utils'

import { startNetworkNode, startTracker } from '../../src/composition'
import { Event as NodeEvent } from '../../src/logic/Node'

const { StreamMessage, MessageID } = MessageLayer

describe('node unsubscribing from a stream', () => {
    let tracker: Tracker
    let nodeA: NetworkNode
    let nodeB: NetworkNode

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 30450,
            id: 'tracker'
        })
        nodeA = await startNetworkNode({
            host: '127.0.0.1',
            port: 30451,
            id: 'a',
            trackers: [tracker.getAddress()],
            disconnectionWaitTime: 200
        })
        nodeB = await startNetworkNode({
            host: '127.0.0.1',
            port: 30452,
            id: 'b',
            trackers: [tracker.getAddress()],
            disconnectionWaitTime: 200
        })

        nodeA.start()
        nodeB.start()

        nodeA.subscribe('s', 2)
        nodeB.subscribe('s', 2)
        await nodeA.waitForNeighbors('s', 2, 1)

        nodeA.subscribe('s', 1)
        nodeB.subscribe('s', 1)
        await nodeA.waitForNeighbors('s', 1, 1)
    })

    afterEach(async () => {
        await nodeA.stop()
        await nodeB.stop()
        await tracker.stop()
    })

    test('node still receives data for subscribed streams thru existing connections', async () => {
        const actual: string[] = []
        nodeB.addMessageListener((streamMessage) => {
            actual.push(`${streamMessage.getStreamId()}::${streamMessage.getStreamPartition()}`)
        })

        nodeB.unsubscribe('s', 2)
        await waitForEvent(nodeA, NodeEvent.NODE_UNSUBSCRIBED)

        nodeA.publish(new StreamMessage({
            messageId: new MessageID('s', 2, 0, 0, 'publisherId', 'msgChainId'),
            content: {},
        }))
        nodeA.publish(new StreamMessage({
            messageId: new MessageID('s', 1, 0, 0, 'publisherId', 'msgChainId'),
            content: {},
        }))
        await waitForEvent(nodeB, NodeEvent.UNSEEN_MESSAGE_RECEIVED)
        expect(actual).toEqual(['s::1'])
    })

    test('connection between nodes is not kept if no shared streams', async () => {
        nodeB.unsubscribe('s', 2)
        await waitForEvent(nodeA, NodeEvent.NODE_UNSUBSCRIBED)

        nodeA.unsubscribe('s', 1)
        await waitForEvent(nodeB, NodeEvent.NODE_UNSUBSCRIBED)

        const [aEventArgs, bEventArgs] = await Promise.all([
            waitForEvent(nodeA, NodeEvent.NODE_DISCONNECTED),
            waitForEvent(nodeB, NodeEvent.NODE_DISCONNECTED)
        ])

        expect(aEventArgs).toEqual(['b'])
        expect(bEventArgs).toEqual(['a'])
    })
})

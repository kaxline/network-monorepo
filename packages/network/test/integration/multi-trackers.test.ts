import { Tracker } from '../../src/logic/tracker/Tracker'
import { NetworkNode } from '../../src/logic/node/NetworkNode'
import { waitForEvent, eventsWithArgsToArray, wait } from 'streamr-test-utils'
import { SPID, toStreamID, TrackerLayer } from 'streamr-client-protocol'

import { createNetworkNode, startTracker } from '../../src/composition'
import { Event as NodeToTrackerEvent } from '../../src/protocol/NodeToTracker'
import { Event as NodeEvent } from '../../src/logic/node/Node'
import { getSPIDKeys } from '../utils'

// TODO: maybe worth re-designing this in a way that isn't this arbitrary?
const FIRST_STREAM = 'stream-7' // assigned to trackerOne (arbitrarily by hashing algo)
const SECOND_STREAM = 'stream-8' // assigned to trackerTwo
const THIRD_STREAM = 'stream-1' // assigned to trackerThree

const FIRST_STREAM_2 = 'stream-13' // assigned to trackerOne
const SECOND_STREAM_2 = 'stream-17' // assigned to trackerTwo
const THIRD_STREAM_2 = 'stream-21' // assigned to trackerThree

// Leave out WebRTC related events
const TRACKER_NODE_EVENTS_OF_INTEREST = [
    NodeToTrackerEvent.CONNECTED_TO_TRACKER,
    NodeToTrackerEvent.TRACKER_DISCONNECTED,
    NodeToTrackerEvent.TRACKER_INSTRUCTION_RECEIVED
]

describe('multi trackers', () => {
    let trackerOne: Tracker
    let trackerTwo: Tracker
    let trackerThree: Tracker
    let nodeOne: NetworkNode
    let nodeTwo: NetworkNode

    beforeEach(async () => {
        trackerOne = await startTracker({
            listen: {
                hostname: '127.0.0.1',
                port: 49000
            }
        })
        trackerTwo = await startTracker({
            listen: {
                hostname: '127.0.0.1',
                port: 49001
            }
        })
        trackerThree = await startTracker({
            listen: {
                hostname: '127.0.0.1',
                port: 49002
            }
        })
        const trackerInfo1 = trackerOne.getConfigRecord()
        const trackerInfo2 = trackerTwo.getConfigRecord()
        const trackerInfo3 = trackerThree.getConfigRecord()

        const trackerAddresses = [trackerInfo1, trackerInfo2, trackerInfo3]
        nodeOne = createNetworkNode({
            id: 'nodeOne',
            trackers: trackerAddresses,
            trackerConnectionMaintenanceInterval: 100
        })
        nodeTwo = createNetworkNode({
            id: 'nodeTwo',
            trackers: trackerAddresses,
            trackerConnectionMaintenanceInterval: 100
        })

        await nodeOne.start()
        await nodeTwo.start()

    })

    afterEach(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()

        await trackerOne.stop()
        await trackerTwo.stop()
        await trackerThree.stop()
    })

    test('node sends stream status to specific tracker', async () => {
        // first stream, first tracker
        nodeOne.subscribe(new SPID(FIRST_STREAM, 0))

        await wait(500)

        expect(getSPIDKeys(trackerOne)).toContain(`${FIRST_STREAM}#0`)
        expect(getSPIDKeys(trackerTwo)).not.toContain(`${FIRST_STREAM}#0`)
        expect(getSPIDKeys(trackerThree)).not.toContain(`${FIRST_STREAM}#0`)

        // second stream, second tracker
        nodeOne.subscribe(new SPID(SECOND_STREAM, 0))

        await wait(500)

        expect(getSPIDKeys(trackerOne)).not.toContain(`${SECOND_STREAM}#0`)
        expect(getSPIDKeys(trackerTwo)).toContain(`${SECOND_STREAM}#0`)
        expect(getSPIDKeys(trackerThree)).not.toContain(`${SECOND_STREAM}#0`)

        // third stream, third tracker
        nodeOne.subscribe(new SPID(THIRD_STREAM, 0))

        await wait(500)

        expect(getSPIDKeys(trackerOne)).not.toContain(`${THIRD_STREAM}#0`)
        expect(getSPIDKeys(trackerTwo)).not.toContain(`${THIRD_STREAM}#0`)
        expect(getSPIDKeys(trackerThree)).toContain(`${THIRD_STREAM}#0`)
    })

    test('only one specific tracker sends instructions about stream', async () => {
        
        const nodePromise = Promise.all([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED)
        ])

        // @ts-expect-error private field
        let nodeOneEvents = eventsWithArgsToArray(nodeOne.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)
        // @ts-expect-error private field
        let nodeTwoEvents = eventsWithArgsToArray(nodeTwo.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)

        // first stream, first tracker
        nodeOne.subscribe(new SPID(FIRST_STREAM_2, 0))
        nodeTwo.subscribe(new SPID(FIRST_STREAM_2, 0))

        await nodePromise

        expect(nodeOneEvents).toHaveLength(2)
        expect(nodeTwoEvents).toHaveLength(2)
        expect(nodeTwoEvents[1][0]).toEqual(NodeToTrackerEvent.TRACKER_INSTRUCTION_RECEIVED)
        expect(nodeTwoEvents[1][2]).toEqual(trackerOne.getTrackerId())

        const nodePromise2 = Promise.all([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED)
        ])

        // @ts-expect-error private field
        nodeOneEvents = eventsWithArgsToArray(nodeOne.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)
        // @ts-expect-error private field
        nodeTwoEvents = eventsWithArgsToArray(nodeTwo.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)

        // second stream, second tracker
        nodeOne.subscribe(new SPID(SECOND_STREAM_2, 0))
        nodeTwo.subscribe(new SPID(SECOND_STREAM_2, 0))

        await nodePromise2

        expect(nodeOneEvents).toHaveLength(2)
        expect(nodeTwoEvents).toHaveLength(2)
        expect(nodeTwoEvents[1][0]).toEqual(NodeToTrackerEvent.TRACKER_INSTRUCTION_RECEIVED)
        expect(nodeTwoEvents[1][2]).toEqual(trackerTwo.getTrackerId())

        const nodePromise3 = Promise.all([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED)
        ])

        // @ts-expect-error private field
        nodeOneEvents = eventsWithArgsToArray(nodeOne.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)
        // @ts-expect-error private field
        nodeTwoEvents = eventsWithArgsToArray(nodeTwo.trackerManager.nodeToTracker, TRACKER_NODE_EVENTS_OF_INTEREST)

        // third stream, third tracker
        nodeOne.subscribe(new SPID(THIRD_STREAM_2, 0))
        nodeTwo.subscribe(new SPID(THIRD_STREAM_2, 0))

        await nodePromise3

        expect(nodeOneEvents).toHaveLength(2)
        expect(nodeTwoEvents).toHaveLength(2)
        expect(nodeTwoEvents[1][0]).toEqual(NodeToTrackerEvent.TRACKER_INSTRUCTION_RECEIVED)
        expect(nodeTwoEvents[1][2]).toEqual(trackerThree.getTrackerId())
    })

    test('node ignores instructions from unexpected tracker', async () => {
        const unexpectedInstruction = new TrackerLayer.InstructionMessage({
            requestId: 'requestId',
            streamId: toStreamID('stream-2'),
            streamPartition: 0,
            nodeIds: [
                'node-address-1',
                'node-address-2',
            ],
            counter: 0
        })
        // @ts-expect-error private field
        await nodeOne.trackerManager.handleTrackerInstruction(unexpectedInstruction, trackerOne.getTrackerId())
        expect(getSPIDKeys(nodeOne)).not.toContain('stream-2#0')
    })
})

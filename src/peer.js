'use strict'

const Bootstrap = require('libp2p-railing')
const StreamrNode = require('./streamr-node')

const debug = require('debug')
const log = debug('strmr:p2p:peer')

const BOOTNODES = require('../bootstrapNodes.json').map(node => {
    return node.full
})

class Peer extends StreamrNode {
    constructor(options) {
        const libp2pOptions = {
            modules: {
                peerDiscovery: [Bootstrap]
            },
            config: {
                peerDiscovery: {
                    bootstrap: {
                        interval: 1000,
                        enabled: true,
                        list: BOOTNODES
                    }
                }
            }
        }

        super(options, libp2pOptions)
    }

    _trackerDiscovery(peer) {
        console.log('Discovered:', peer.id.toB58String())
        this._node.dial(peer, () => {})
        this._tracker = peer
    }

    _connectPeer(peer) {
        super._connectPeer(peer)
        this.sendStatus()
    }

    sendStatus() {
        this._status = {
            started: new Date().toLocaleString(),
            streams: ['stream' + Math.floor(Math.random() * 100), 'stream' + Math.floor(Math.random()) * 100]
        }

        super.sendMessage(StreamrNode.MESSAGE_CODES.STATUS, this._tracker, this._status)
    }
}

module.exports = Peer
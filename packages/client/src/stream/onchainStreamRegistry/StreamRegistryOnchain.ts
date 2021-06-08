import StreamrClient, { EthereumAddress } from '../..'
import { Stream, StreamProperties } from '..'
import { Contract } from '@ethersproject/contracts'
import { Wallet } from '@ethersproject/wallet'
import StreamrEthereum from '../../Ethereum'
import debug from 'debug'
import { StreamRegistry } from './StreamRegistry'
import StreamRegistryArtifact from './StreamRegsitryArtifact.json'

const log = debug('StreamrClient::StreamRegistryOnchain')

export class StreamRegistryOnchain {
    client: StreamrClient
    ethereum: StreamrEthereum
    streamRegistryAddress: EthereumAddress
    streamRegistry: StreamRegistry
    ensCacheSidechainAddress: EthereumAddress
    sideChainPrivider: Wallet

    constructor(client: StreamrClient) {
        log('creating StreamRegistryOnchain')
        this.client = client
        this.ethereum = client.ethereum
        this.streamRegistryAddress = client.options.streamRegistrySidechainAddress
        this.ensCacheSidechainAddress = client.options.dataUnion.ensCacheSidechainAddress
        this.sideChainPrivider = this.ethereum.getSidechainSigner() as Wallet
        this.streamRegistry = new Contract(this.streamRegistryAddress, StreamRegistryArtifact.abi, this.sideChainPrivider) as StreamRegistry
    }

    getStreamById(id: string): Stream {
        log('getting stream(properties) by id from chain')
        // const a = this.ethereum.getAddress()
        const properties = this.streamRegistry.getStreamMetadata(id) as StreamProperties
        return new Stream(this.client, properties)
    }

    async createStream(props: StreamProperties): Promise<Stream> {
        log('creating/registering stream onchain')
        // const a = this.ethereum.getAddress()
        const propsJsonStr : string = JSON.stringify(props)
        const path = '/' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5)
        // const properties = this.streamRegistry.getStreamMetadata(id) as StreamProperties
        const tx = await this.streamRegistry.createStream(path, propsJsonStr)
        const txreceipt = await tx.wait()
        
        // TODO check for success
        const metaDateFromChain = this.streamRegistry.getStreamMetadata()
        return new Stream(this.client, props)
    }
}

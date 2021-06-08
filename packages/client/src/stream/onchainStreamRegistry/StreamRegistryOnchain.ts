import StreamrClient, { EthereumAddress } from '../..'
import { Stream, StreamProperties } from '..'
import { Contract } from '@ethersproject/contracts'
// import { Wallet } from '@ethersproject/wallet'
import { Signer } from '@ethersproject/abstract-signer'
import StreamrEthereum from '../../Ethereum'
import debug from 'debug'
import { StreamRegistry } from './StreamRegistry'
import StreamRegistryArtifact from './StreamRegistryArtifact.json'
// import { Provider } from '@ethersproject/abstract-provider'

const log = debug('StreamrClient::StreamRegistryOnchain')

export class StreamRegistryOnchain {
    client: StreamrClient
    ethereum: StreamrEthereum
    // streamRegistryAddress: EthereumAddress
    streamRegistry: StreamRegistry
    // ensCacheSidechainAddress: EthereumAddress
    sideChainPrivider: Signer

    constructor(client: StreamrClient) {
        log('creating StreamRegistryOnchain')
        this.client = client
        this.ethereum = client.ethereum
        // this.streamRegistryAddress = client.options.streamRegistrySidechainAddress
        // this.ensCacheSidechainAddress = client.options.ensCacheSidechainAddress
        this.sideChainPrivider = this.ethereum.getSidechainSigner() as Signer
        console.log('######### regaddr' + client.options.streamRegistrySidechainAddress)

        this.streamRegistry = new Contract(client.options.streamRegistrySidechainAddress,
            StreamRegistryArtifact.abi, this.sideChainPrivider) as StreamRegistry
        console.log('######### contractaddr ' + this.streamRegistry.address)
    }

    async getStreamById(id: string): Promise<Stream> {
        log('getting stream(properties) by id from chain')
        // const a = this.ethereum.getAddress()
        const propertiesString = await this.streamRegistry.getStreamMetadata(id)
        let parsedProps
        try {
            parsedProps = JSON.parse(propertiesString)
        } catch (error) {
            throw new Error(`could not parse prperties from onachein metadata: ${propertiesString}`)
        }
        return new Stream(this.client, parsedProps)
    }

    async createStream(props: StreamProperties): Promise<Stream> {
        console.log('creating/registering stream onchain')
        // const a = this.ethereum.getAddress()
        const propsJsonStr : string = JSON.stringify(props)
        const path = '/' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5)
        // const properties = this.streamRegistry.getStreamMetadata(id) as StreamProperties

        console.log('#### ' + path + ' ' + propsJsonStr)
        const tx = await this.streamRegistry.createStream(path, propsJsonStr)
        const txreceipt = await tx.wait()
        console.log('txreceipt' + JSON.stringify(txreceipt))
        // // TODO check for success
        let id = await (await this.ethereum.getAddress()).toLowerCase()
        id += path
        console.log('#### id ' + id)
        const metaDateFromChain = await this.streamRegistry.getStreamMetadata(id)
        console.log('#### ' + JSON.stringify(metaDateFromChain))
        return new Stream(this.client, props)
    }
}

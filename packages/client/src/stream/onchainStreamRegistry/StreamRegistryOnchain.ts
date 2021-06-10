import StreamrClient from '../..'
import { Stream, StreamProperties } from '..'
import { Contract } from '@ethersproject/contracts'
// import { Wallet } from '@ethersproject/wallet'
import { Signer } from '@ethersproject/abstract-signer'
import StreamrEthereum from '../../Ethereum'
import debug from 'debug'
import type { StreamRegistry } from './StreamRegistry'
import StreamRegistryArtifact from './StreamRegistryArtifact.json'
// import { Provider } from '@ethersproject/abstract-provider'

const log = debug('StreamrClient::StreamRegistryOnchain')

export class StreamRegistryOnchain {
    client: StreamrClient
    ethereum: StreamrEthereum
    // streamRegistryAddress: EthereumAddress
    streamRegistry?: StreamRegistry
    // ensCacheSidechainAddress: EthereumAddress
    sideChainPrivider?: Signer

    constructor(client: StreamrClient) {
        log('creating StreamRegistryOnchain')
        this.client = client
        this.ethereum = client.ethereum
        // this.streamRegistryAddress = client.options.streamRegistrySidechainAddress
        // this.ensCacheSidechainAddress = client.options.ensCacheSidechainAddress
        // this.sideChainPrivider = this.ethereum.getSidechainSigner() as Signer
        // console.log('######### regaddr' + client.options.streamRegistrySidechainAddress)

        // this.streamRegistry = new Contract(client.options.streamRegistrySidechainAddress,
        //     StreamRegistryArtifact.abi, this.sideChainPrivider) as StreamRegistry
        // console.log('######### contractaddr ' + this.streamRegistry.address)
    }

    async connectToEthereum() {
        if (!this.sideChainPrivider || !this.streamRegistry) {
            this.sideChainPrivider = await this.ethereum.getSidechainSigner() as Signer
            this.streamRegistry = new Contract(this.client.options.streamRegistrySidechainAddress,
                StreamRegistryArtifact.abi, this.sideChainPrivider) as StreamRegistry
        }
    }

    async getStreamById(id: string): Promise<Stream> {
        await this.connectToEthereum()
        log('getting stream(properties) by id from chain')
        // const a = this.ethereum.getAddress()
        const propertiesString = await this.streamRegistry?.getStreamMetadata(id) || '{'
        let parsedProps
        try {
            parsedProps = JSON.parse(propertiesString)
            parsedProps = {
                ...parsedProps,
                id,
                path: id.substring(id.indexOf('/'))
            }
        } catch (error) {
            throw new Error(`could not parse prperties from onachein metadata: ${propertiesString}`)
        }

        return new Stream(this.client, parsedProps)
    }

    async createStream(props: StreamProperties): Promise<Stream> {
        log('creating/registering stream onchain')
        // const a = this.ethereum.getAddress()
        const propsJsonStr : string = JSON.stringify(props)
        const path = props.path || '/'
        // const properties = this.streamRegistry.getStreamMetadata(id) as StreamProperties

        // console.log('#### ' + path + ' ' + propsJsonStr)
        const tx = await this.streamRegistry?.createStream(path, propsJsonStr)
        await tx?.wait()
        const id = await (await this.ethereum.getAddress()).toLowerCase() + path
        const propsResult = {
            ...props,
            id,
            path
        }
        // console.log('txreceipt' + JSON.stringify(txreceipt))
        // // TODO check for success
        // console.log('#### id ' + id)
        // const metaDateFromChain = await this.streamRegistry.getStreamMetadata(id)
        // console.log('#### ' + JSON.stringify(metaDateFromChain))
        return new Stream(this.client, propsResult)
    }

}

// graphql over fetch:
// https://stackoverflow.com/questions/44610310/node-fetch-post-request-using-graphql-query

// example query with sting contains clause
// need to write query function in grapgql
// {
//     streams (  where: { metadata_contains: "test",
//    id: "0x4178babe9e5148c6d5fd431cd72884b07ad855a0/"}) {
//      id,
//      metadata,
//      permissions {
//        id,
//            user,
//            edit,
//        canDelete,
//        publish,
//        subscribed,
//        share,
//      }
//    }
//  }

import StreamrClient from '../..'
import { StreamPermission, Stream, StreamProperties } from '../index'

import { Contract } from '@ethersproject/contracts'
// import { Wallet } from '@ethersproject/wallet'
import { Signer } from '@ethersproject/abstract-signer'
import StreamrEthereum from '../../Ethereum'
import debug from 'debug'
import type { StreamRegistry } from './StreamRegistry'
import StreamRegistryArtifact from './StreamRegistryArtifact.json'
// import { Provider } from '@ethersproject/abstract-provider'
import fetch, { Response } from 'node-fetch'
import { EthereumAddress } from '../../types'
import { BigNumber } from 'ethers'
// const fetch = require('node-fetch');
const log = debug('StreamrClient::StreamRegistryOnchain')

// export interface StreamRegistryOnchain {}
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
        console.log(id)

        const propertiesString = await this.streamRegistry?.getStreamMetadata(id) || '{'

        return new Stream(this.client, StreamRegistryOnchain.parseStreamProps(id, propertiesString))

    }
    async getAllStreams(): Promise<Array<Stream>> {
        // await this.connectToEthereum()
        log('getting all streams from thegraph')
        // const a = this.ethereum.getAddress()
        // console.log(id);
        const query: string = StreamRegistryOnchain.buildGetStreamGQLQuery()
        console.log('######' + query)
        const res = await this.queryTheGraph(query)
        const resJson = await res.json()
        if (resJson.errors.length > 0) {
            throw new Error('failed to get streams from theGraph ' + JSON.stringify(resJson.errors))
        }
        console.log(JSON.stringify(resJson))
        return resJson.data.streams.map((streamobj: any) => {
            return new Stream(this.client, StreamRegistryOnchain.parseStreamProps(streamobj.id, streamobj.metadata))
        })

    }
    async getAllPermissionsForStream(streamid: string): Promise<Array<StreamPermission>> {
        // await this.connectToEthereum()
        log('getting all streams from thegraph')
        // const a = this.ethereum.getAddress()
        // console.log(id);
        const query: string = StreamRegistryOnchain.buildGetPermissionGQLQuery(streamid)
        console.log('######' + query)
        const res = await this.queryTheGraph(query)
        const resJson = await res.json()
        console.log(JSON.stringify(resJson))
        return resJson.data.streams.map((streamobj: any) => {
            return new Stream(this.client, StreamRegistryOnchain.parseStreamProps(streamobj.id, streamobj.metadata))
        })
    }

    async queryTheGraph(query: string): Promise<Response> {
        return fetch(this.client.options.theGraphUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                accept: '*/*',
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: query
        })
    }
    // .. use querybuilder? i.e. https://www.npmjs.com/package/gql-query-builder
    // .. how to get permissions filtered on "they belong to the same stream"?
    // alternative: get stream with all its permission:

    // {
    //     streams (  where: {
    //    id: "0x4178babe9e5148c6d5fd431cd72884b07ad855a0/auxigkli"}) {
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

    static buildGetPermissionGQLQuery(streamid: string): string {
        //    id: "0x4178babe9e5148c6d5fd431cd72884b07ad855a0/"}) {
        const query = `{
            streams (  where: { 
              id: "${streamid}"}) {
             id,
             metadata,
             permissions {
               id,
               userAddress,
               edit,
               canDelete,
               publishExpiration,
               subscribeExpiration,
               share,
             }
           }
         }`
        return JSON.stringify({ query })
    }

    static buildGetStreamGQLQuery(): string {
        //    id: "0x4178babe9e5148c6d5fd431cd72884b07ad855a0/"}) {
        const query = `{
            streams {
                 id,
                 metadata
               }
          }`
        return JSON.stringify({ query })
    }

    static parseStreamProps(id: string, propsString: string): StreamProperties {
        let parsedProps : StreamProperties
        try {
            parsedProps = JSON.parse(propsString)
            parsedProps = {
                ...parsedProps,
                id,
                path: id.substring(id.indexOf('/'))
            }
        } catch (error) {
            // throw new Error(`could not parse prperties from onachein metadata: ${propsString}`)
            return { id, description: 'ERROR IN PROPS' }
        }
        return parsedProps
    }

    async createStream(props?: StreamProperties): Promise<Stream> {
        let properties = props || {}
        await this.connectToEthereum()
        log('creating/registering stream onchain')
        // const a = this.ethereum.getAddress()
        const propsJsonStr : string = JSON.stringify(properties)
        let { path } = properties
        if (!path && properties.id && properties.id.includes('/')) {
            path = properties.id.slice(properties.id.indexOf('/'), properties.id.length)
        }
        path = path || '/'
        // const path = properties.path || '/'
        // const properties = this.streamRegistry.getStreamMetadata(id) as StreamProperties

        // console.log('#### ' + path + ' ' + propsJsonStr)
        const tx = await this.streamRegistry?.createStream(path, propsJsonStr)
        await tx?.wait()
        const id = await (await this.ethereum.getAddress()).toLowerCase() + path
        properties = {
            ...properties,
            id,
            path
        }
        // console.log('txreceipt' + JSON.stringify(txreceipt))
        // // TODO check for success
        // console.log('#### id ' + id)
        // const metaDateFromChain = await this.streamRegistry.getStreamMetadata(id)
        // console.log('#### ' + JSON.stringify(metaDateFromChain))
        return new Stream(this.client, properties)
    }
    // Promise<StreamPermision[]

    async getPermissionsForUser(streamid: string): Promise<StreamPermission> {
        await this.connectToEthereum()
        const userAddress: EthereumAddress = await this.ethereum.getAddress()
        log('getting permission for stream for user')
        const permissions = await this.streamRegistry?.getPermissionsForUser(streamid, userAddress)
        return {
            streamid,
            // operation: StreamOperation
            user: userAddress,
            edit: permissions?.edit || false,
            canDelete: permissions?.canDelete || false,
            publishExpiration: permissions?.publishExpiration || new BigNumber(null, '0x0'),
            subscribeExpiration: permissions?.subscribeExpiration || new BigNumber(null, '0x0'),
            share: permissions?.share || false
        }
    }
    // const publicPermissions = await this.streamRegistry?.getPermissionsForUser(id, '0x0000000000000000000000000000000000000000')
    // const res2 = res?.slice(5, 10)
    // let perms: StreamPermission[] = []
    // if (directPermissions?.edit) perms.push({id:0, user: address, operation: StreamOperation.STREAM_EDIT})
    // if (directPermissions?.canDelete) perms.push({id:0, user: address, operation: StreamOperation.STREAM_DELETE})
    // if (directPermissions?.subscribed) perms.push({id:0, user: address, operation: StreamOperation.STREAM_SUBSCRIBE})
    // if (directPermissions?.publish) perms.push({id:0, user: address, operation: StreamOperation.STREAM_PUBLISH})
    // if (directPermissions?.share) perms.push({id:0, user: address, operation: StreamOperation.STREAM_SHARE})
    // if (publicPermissions?.edit) perms.push({id:0, anonymous: true, operation: StreamOperation.STREAM_EDIT})
    // if (publicPermissions?.canDelete) perms.push({id:0, anonymous: true, operation: StreamOperation.STREAM_DELETE})
    // if (publicPermissions?.subscribed) perms.push({id:0, anonymous: true, operation: StreamOperation.STREAM_SUBSCRIBE})
    // if (publicPermissions?.publish) perms.push({id:0, anonymous: true, operation: StreamOperation.STREAM_PUBLISH})
    // if (publicPermissions?.share) perms.push({id:0, anonymous: true, operation: StreamOperation.STREAM_SHARE})
    // perms.push(directPermissions)
    // perms.push(publicPermissions)
    // return perms
    // res2?.map((el): StreamPermision => {
    //     if (el.values()[0]) return {
    //         id: 0,
    //         operation: StreamOperation.STREAM_EDIT,
    //         user: address
    //     }
    // })
    // }

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

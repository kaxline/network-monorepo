import { router as dataQueryEndpoints } from './DataQueryEndpoints'
import { router as dataMetadataEndpoint } from './DataMetadataEndpoints'
import { router as storageConfigEndpoints } from './StorageConfigEndpoints'
import { Plugin, PluginOptions } from '../Plugin'
import { StreamFetcher } from '../StreamFetcher'
import { Storage, startCassandraStorage } from './Storage'
import { StorageConfig } from './StorageConfig'
import { StreamPart } from '../types'
import { Wallet } from 'ethers'
import PLUGIN_CONFIG_SCHEMA from './config.schema.json'

export interface StoragePluginConfig {
    cassandra: {
        hosts: string[],
        username: string
        password: string
        keyspace: string,
        datacenter: string
    }
    storageConfig: {
        refreshInterval: number
    }
}

export class StoragePlugin extends Plugin<StoragePluginConfig> {

    private cassandra: Storage|undefined
    private storageConfig: StorageConfig|undefined

    constructor(options: PluginOptions) {
        super(options)
    }

    async start() {
        this.cassandra = await this.getCassandraStorage()
        this.storageConfig = await this.createStorageConfig()
        this.storageConfig.getStreams().forEach((stream) => {
            this.subscriptionManager.subscribe(stream.id, stream.partition)
        })
        this.storageConfig.addChangeListener({
            onStreamAdded: (stream: StreamPart) => this.subscriptionManager.subscribe(stream.id, stream.partition),
            onStreamRemoved: (stream: StreamPart) => this.subscriptionManager.unsubscribe(stream.id, stream.partition)
        })
        this.networkNode.addMessageListener((msg) => {
            const streamPart = {
                id: msg.messageId.streamId,
                partition: msg.messageId.streamPartition
            }
            if (this.storageConfig!.hasStream(streamPart)) {
                this.cassandra!.store(msg)
            }
        })
        const streamFetcher = new StreamFetcher(this.brokerConfig.streamrUrl)
        this.addHttpServerRouter(dataQueryEndpoints(this.cassandra, streamFetcher, this.metricsContext))
        this.addHttpServerRouter(dataMetadataEndpoint(this.cassandra))
        this.addHttpServerRouter(storageConfigEndpoints(this.storageConfig))
    }

    private async getCassandraStorage() {
        const cassandraStorage = await startCassandraStorage({
            contactPoints: [...this.pluginConfig.cassandra.hosts],
            localDataCenter: this.pluginConfig.cassandra.datacenter,
            keyspace: this.pluginConfig.cassandra.keyspace,
            username: this.pluginConfig.cassandra.username,
            password: this.pluginConfig.cassandra.password,
            opts: {
                useTtl: !this.brokerConfig.network.isStorageNode
            }
        })
        cassandraStorage.enableMetrics(this.metricsContext)
        return cassandraStorage
    }

    private async createStorageConfig() {
        const brokerAddress = new Wallet(this.brokerConfig.ethereumPrivateKey).address
        const storageConfig = await StorageConfig.createInstance(brokerAddress, this.brokerConfig.streamrUrl + '/api/v1', this.pluginConfig.storageConfig.refreshInterval)
        storageConfig.startAssignmentEventListener(this.brokerConfig.streamrAddress, this.networkNode)
        return storageConfig
    }

    async stop() {
        return Promise.all([
            this.cassandra!.close(),
            this.storageConfig!.cleanup()
        ])
    }

    getConfigSchema() {
        return PLUGIN_CONFIG_SCHEMA
    }
}
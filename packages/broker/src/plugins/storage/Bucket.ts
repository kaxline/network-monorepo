import { Logger } from 'streamr-network'

export type BucketId = string

export class Bucket {

    id: BucketId
    streamId: string
    partition: number
    size: number
    records: number
    dateCreate: Date
    private maxSize: number
    private maxRecords: number
    private keepAliveSeconds: number
    ttl: Date
    private stored: boolean
    logger: Logger

    constructor(
        id: BucketId,
        streamId: string,
        partition: number,
        size: number,
        records: number,
        dateCreate: Date,
        maxSize: number,
        maxRecords: number,
        keepAliveSeconds: number
    ) {
        if (!id || !id.length) {
            throw new TypeError('id must be not empty string')
        }

        if (!streamId || !streamId.length) {
            throw new TypeError('streamId must be not empty string')
        }

        if (partition < 0) {
            throw new TypeError('partition must be >= 0')
        }

        if (size < 0) {
            throw new TypeError('size must be => 0')
        }

        if (records < 0) {
            throw new TypeError('records must be => 0')
        }

        if (!(dateCreate instanceof Date)) {
            throw new TypeError('dateCreate must be instance of Date')
        }

        if (maxSize <= 0) {
            throw new TypeError('maxSize must be > 0')
        }

        if (maxRecords <= 0) {
            throw new TypeError('maxRecords must be > 0')
        }

        if (keepAliveSeconds <= 0) {
            throw new Error('keepAliveSeconds must be > 0')
        }

        this.id = id
        this.streamId = streamId
        this.partition = partition
        this.size = size
        this.records = records
        this.dateCreate = dateCreate

        this.logger = new Logger(module, `${this.id}`)
        this.logger.trace(`init bucket: ${this.getId()}, dateCreate: ${this.dateCreate}`)

        this.maxSize = maxSize
        this.maxRecords = maxRecords
        this.keepAliveSeconds = keepAliveSeconds

        this.ttl = new Date()
        this.stored = false
        this.updateTTL()
    }

    isStored(): boolean {
        return this.stored
    }

    setStored(): void {
        this.stored = true
    }

    private checkSize(percentDeduction = 0): boolean {
        const maxPercentSize = (this.maxSize * (100 - percentDeduction)) / 100
        const maxRecords = (this.maxRecords * (100 - percentDeduction)) / 100
        const { size, records } = this
        this.logger.trace(
            `_checkSize: ${size >= maxPercentSize || records >= maxRecords} => ${size} >= ${maxPercentSize} || ${records} >= ${maxRecords}`
        )

        return this.size >= maxPercentSize || this.records >= maxRecords
    }

    isAlmostFull(percentDeduction = 30): boolean {
        return this.checkSize(percentDeduction)
    }

    getId(): string {
        return this.id
    }

    incrementBucket(size: number): void {
        this.size += size
        this.records += 1

        this.logger.trace(`incremented bucket => size: ${this.size}, records: ${this.records}`)

        this.stored = false
        this.updateTTL()
    }

    private updateTTL(): void {
        this.ttl = new Date()
        this.ttl.setSeconds(this.ttl.getSeconds() + this.keepAliveSeconds)
        this.logger.trace(`new ttl: ${this.ttl}`)
    }

    isAlive(): boolean {
        const now = new Date()
        const isAlive = this.ttl >= now
        this.logger.trace(`isAlive: ${isAlive}, ${this.ttl} >= ${now}`)
        return this.ttl >= now
    }
}

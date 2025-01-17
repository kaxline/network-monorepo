import { BrubeckClientConfig } from 'streamr-client'
import { SmartContractRecord } from 'streamr-client-protocol'
import path from 'path'
import * as os from 'os'

export interface NetworkSmartContract {
    contractAddress: string
    jsonRpcProvider: string
}

export type TrackerRegistryItem = SmartContractRecord

export interface HttpServerConfig {
    port: number,
    privateKeyFileName: string | null,
    certFileName: string | null
}

export type ApiAuthenticationConfig = { keys: string[] } | null

export type ClientConfig = BrubeckClientConfig & { network?: { trackers: TrackerRegistryItem[] | NetworkSmartContract | undefined } }

export interface Config {
    client: ClientConfig
    httpServer: HttpServerConfig
    plugins: Record<string,any>
    apiAuthentication: ApiAuthenticationConfig
}

export const getDefaultFile = (): string => {
    const relativePath = '.streamr/config/default.json'
    return path.join(os.homedir(), relativePath)
}

import { FileRecord, isFileRecord } from './FileRecord'
import { FindFileRequest, FindFileResponse } from "./ApiRequest"
import { NodeId, sha1OfString } from "./keypair"
import validateObject, { isNumber, isString } from './validateObject'
import ObjectCache from './ObjectCache'
import { Env } from '.'
import { getSignedUrl } from './getSignedUrl'

const findFileHandler = async (request: FindFileRequest, verifiedClientId: NodeId | undefined, verifiedUserId: string | undefined, env: Env): Promise<FindFileResponse> => {
    const { hashAlg, hash } = request.payload

    return findFile({hashAlg, hash}, env)
}

type CacheRecord = {
    timestampCreated: number,
    url: string, // signed download url
    fileRecord: FileRecord
}

const isCacheRecord = (x: any): x is CacheRecord => {
    return validateObject(x, {
        timestampCreated: isNumber,
        url: isString,
        fileRecord: isFileRecord
    })
}

const signedUrlObjectCache = new ObjectCache<CacheRecord>(1000 * 60 * 30)

export const findFile = async (o: {hashAlg: string, hash: string, noFallback?: boolean}, env: Env): Promise<FindFileResponse> => {
    const {hashAlg, hash} = o

    let fileRecord: FileRecord | undefined = undefined

    const h = hash
    const objectKey = `${hashAlg}/${h[0]}${h[1]}/${h[2]}${h[3]}/${h[4]}${h[5]}/${hash}`

    // check cache
    const cacheKey = sha1OfString(objectKey).toString()
    // first check in-memory cache
    let aa = signedUrlObjectCache.get(cacheKey) // check memory cache
    if (!aa) {
        const recordString = await env.FIND_FILE_CACHE.get(cacheKey)
        if (recordString) {
            const record = JSON.parse(recordString)
            if (isCacheRecord(record)) {
                aa = record
            }
        }
    }

    if (aa) {
        // we have a cache hit
        const elapsed = Date.now() - aa.timestampCreated
        if (elapsed < 1000 * 60 * 30) {
            // it is recent enough
            return {
                type: 'findFile',
                found: true,
                size: aa.fileRecord.size,
                bucketUri: aa.fileRecord.bucketUri,
                objectKey: aa.fileRecord.objectKey,
                url: aa.url,
                cacheHit: true
            }
        }
        else {
            // it is not recent enough
            signedUrlObjectCache.delete(cacheKey) // delete from memory cache
            await env.FIND_FILE_CACHE.delete(cacheKey) // delete from kv store cache
        }
    }
    
    {
        const headObjectOutput = await env.BUCKET.head(objectKey) || undefined
        if (headObjectOutput) {
            const size = headObjectOutput.size
            if (size === undefined) throw Error('No ContentLength in headObjectOutput')
            fileRecord = {
                hashAlg,
                hash,
                objectKey,
                bucketUri: '',
                size,
                timestamp: Date.now()
            }
            const url = await getSignedUrl('getObject', fileRecord.objectKey, 60 * 60, env)

            // store in cache
            const cacheRecord = {timestampCreated: Date.now(), url, fileRecord}

            // first set to in-memory cache
            signedUrlObjectCache.set(cacheKey, cacheRecord)
            // second set to db cache
            await env.FIND_FILE_CACHE.put(cacheKey, JSON.stringify(cacheRecord))
        
            return {
                type: 'findFile',
                found: true,
                size: fileRecord.size,
                bucketUri: fileRecord.bucketUri,
                objectKey: fileRecord.objectKey,
                url,
                cacheHit: false
            }
        }
    }

    return {
        type: 'findFile',
        found: false
    }
}

export default findFileHandler
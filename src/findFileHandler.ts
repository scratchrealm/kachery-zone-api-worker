import { FileRecord, isFileRecord } from './FileRecord'
import { FindFileRequest, FindFileResponse } from "./ApiRequest"
import { NodeId, sha1OfString } from "./keypair"
import validateObject, { isNumber, isString } from './validateObject'
import ObjectCache from './ObjectCache'
import { Bucket, getSignedDownloadUrl, headObject } from './s3Helpers'
import { getBucket, getFallbackBucket } from './getBucket'
import { HeadObjectOutputX } from './getS3Client'

const findFileHandler = async (request: FindFileRequest, verifiedClientId: NodeId | undefined, verifiedUserId: string | undefined, findFileCache: KVNamespace): Promise<FindFileResponse> => {
    const { hashAlg, hash } = request.payload

    return findFile({hashAlg, hash}, findFileCache)
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

export const findFile = async (o: {hashAlg: string, hash: string, noFallback?: boolean}, findFileCache: KVNamespace): Promise<FindFileResponse> => {
    const {hashAlg, hash} = o

    const bucket: Bucket = getBucket()
    const fallbackBucket: Bucket | undefined = getFallbackBucket()

    let fileRecord: FileRecord | undefined = undefined

    const h = hash
    const objectKey = `${hashAlg}/${h[0]}${h[1]}/${h[2]}${h[3]}/${h[4]}${h[5]}/${hash}`

    // check cache
    const cacheKey = sha1OfString(`${bucket.uri}.${objectKey}`).toString()
    // first check in-memory cache
    let aa = signedUrlObjectCache.get(cacheKey) // check memory cache
    if (!aa) {
        const recordString = await findFileCache.get(cacheKey)
        if (recordString) {
            const record = JSON.parse(recordString)
            if (isCacheRecord(record)) {
                aa = record
            }
        }
    }
    if ((aa) && (fallbackBucket) && (o.noFallback) && (aa.fileRecord.bucketUri === fallbackBucket?.uri)) {
        // if the cached record is a fallback cache record
        // and o.noFallback is true
        // then we should not use the cache hit
        aa = undefined
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
            await findFileCache.delete(cacheKey) // delete from kv store cache
        }
    }
    
    if (bucket) {
        let headObjectOutput: HeadObjectOutputX | undefined = undefined
        try {
            headObjectOutput = await headObject(bucket, objectKey)
        }
        catch(err) {
            // continue
        }
        if (headObjectOutput) {
            const size = headObjectOutput.ContentLength
            if (size === undefined) throw Error('No ContentLength in headObjectOutput')
            fileRecord = {
                hashAlg,
                hash,
                objectKey,
                bucketUri: bucket.uri,
                size,
                timestamp: Date.now()
            }
            const url = await getSignedDownloadUrl(bucket, fileRecord.objectKey, 60 * 60)

            // store in cache
            const cacheRecord = {timestampCreated: Date.now(), url, fileRecord}

            // first set to in-memory cache
            signedUrlObjectCache.set(cacheKey, cacheRecord)
            // second set to db cache
            await findFileCache.put(cacheKey, JSON.stringify(cacheRecord))
        
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

    if ((fallbackBucket) && (!o.noFallback)) {
        let headObjectOutput: HeadObjectOutputX | undefined = undefined
        try {
            headObjectOutput = await headObject(fallbackBucket, objectKey)
        }
        catch(err) {
            // continue
        }
        if (headObjectOutput) {
            const size = headObjectOutput.ContentLength
            if (size === undefined) throw Error('No ContentLength in headObjectOutput')
            fileRecord = {
                hashAlg,
                hash,
                objectKey,
                bucketUri: fallbackBucket.uri,
                size,
                timestamp: Date.now()
            }
            const url = await getSignedDownloadUrl(fallbackBucket, fileRecord.objectKey, 60 * 60)

            // store in cache
            const cacheRecord = {timestampCreated: Date.now(), url, fileRecord}

            // first set to in-memory cache
            signedUrlObjectCache.set(cacheKey, cacheRecord)
            // second set to db cache
            await findFileCache.put(cacheKey, JSON.stringify(cacheRecord))
        
            return {
                type: 'findFile',
                found: true,
                size: fileRecord.size,
                bucketUri: fileRecord.bucketUri,
                objectKey: fileRecord.objectKey,
                url,
                cacheHit: false,
                fallback: true
            }
        }
    }

    return {
        type: 'findFile',
        found: false
    }
}

export default findFileHandler
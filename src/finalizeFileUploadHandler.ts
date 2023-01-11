import { FinalizeFileUploadRequest, FinalizeFileUploadResponse } from "./ApiRequest";
import { NodeId } from './keypair';
import { getClient } from "./getDatabaseItems";
import getAuthorizationSettings from "./getAuthorizationSettings";
import { getBucket, MAX_UPLOAD_SIZE } from "./initiateFileUploadHandler";
import { deleteObject, headObject } from "./s3Helpers";

const bucket = getBucket()

const finalizeFileUploadHandler = async (request: FinalizeFileUploadRequest, verifiedClientId?: NodeId, verifiedUserId?: string): Promise<FinalizeFileUploadResponse> => {
    const { objectKey, size } = request.payload

    const clientId = verifiedClientId
    let userId = verifiedUserId
    if ((!clientId) && (!userId)) {
        throw Error('No verified client ID or user ID')
    }

    if (clientId) {
        if (userId) {
            throw Error('Both client ID and user ID provided')
        }
        // make sure the client is registered
        // in the future we will check the owner for authorization
        const client = await getClient(clientId.toString())
        userId = client.ownerId
    }

    // check the user ID for authorization
    const authorizationSettings = await getAuthorizationSettings()
    if (!authorizationSettings.allowPublicUpload) {
        const u = authorizationSettings.authorizedUsers.find(a => (a.userId === userId))
        if (!u) throw Error(`User ${userId} is not authorized.`)
        if (!u.upload) throw Error(`User ${userId} not authorized to upload files.`)
    }

    const x = await headObject(bucket, objectKey)
    const size0 = x.ContentLength
    if (size0 === undefined) {
        throw Error('No ContentLength in object')
    }
    if (size0 > MAX_UPLOAD_SIZE) {
        await deleteObject(bucket, objectKey)
        throw Error(`File too large *: ${size0} > ${MAX_UPLOAD_SIZE}`)
    }
    if (size0 !== size) {
        await deleteObject(bucket, objectKey)
        throw Error(`Unexpected object size: ${size0} <> ${size}`)
    }

    // in case we want to copy it on finalize
    // const h = hash
    // const newObjectKey = `uploads/${hashAlg}/${h[0]}${h[1]}/${h[2]}${h[3]}/${h[4]}${h[5]}/${hash}`
    // await copyObject(bucket, objectKey, newObjectKey)
    // await deleteObject(bucket, objectKey)

    /////////////////////////////////////////////////////////////////////
    // not working as hoped - probably because we get a different instance between initiate and finalize
    // const puKey = getPendingUploadKey({hash, hashAlg, projectId})
    // const a = pendingUploads.get(puKey)
    // if (a) {
    //     pendingUploads.delete(puKey)
    // }
    /////////////////////////////////////////////////////////////////////

    return {
        type: 'finalizeFileUpload'
    }
}

export default finalizeFileUploadHandler
import { Env } from ".";
import { FinalizeFileUploadRequest, FinalizeFileUploadResponse } from "./ApiRequest";
import getAuthorizationSettings from "./getAuthorizationSettings";
import { getClient } from "./getDatabaseItems";
import { NodeId } from './keypair';

const finalizeFileUploadHandler = async (request: FinalizeFileUploadRequest, verifiedClientId: NodeId | undefined, verifiedUserId: string | undefined, env: Env): Promise<FinalizeFileUploadResponse> => {
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
        const client = await getClient(clientId.toString(), {includeSecrets: false}, env)
        userId = client.ownerId
    }

    // check the user ID for authorization
    const authorizationSettings = await getAuthorizationSettings(env)
    if (!authorizationSettings.allowPublicUpload) {
        const u = authorizationSettings.authorizedUsers.find(a => (a.userId === userId))
        if (!u) throw Error(`User ${userId} is not authorized.`)
        if (!u.upload) throw Error(`User ${userId} not authorized to upload files.`)
    }

    const obj = await env.BUCKET.head(objectKey)
    if (!obj) {
        throw Error('Unable to find object in bucket')
    }
    const size0 = obj.size
    if (size0 !== size) {
        await env.BUCKET.delete(objectKey)
        throw Error(`Unexpected object size: ${size0} <> ${size}`)
    }

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
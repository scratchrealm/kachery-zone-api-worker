import { Resource } from "./Resource";
import { GetResourceInfoRequest, GetResourceInfoResponse } from "./ApiRequest";
import { NodeId } from "./keypair";
import { getResource } from "./getDatabaseItems";
import { Env } from ".";

const getResourceInfoHandler = async (request: GetResourceInfoRequest, verifiedClientId: NodeId | undefined, env: Env): Promise<GetResourceInfoResponse> => {
    const { resourceName } = request.payload

    let resource: Resource
    try {
        resource = await getResource(resourceName.toString(), {includeSecrets: false}, env)
    }
    catch {
        return {
            type: 'getResourceInfo',
            found: false
        }
    }

    return {
        type: 'getResourceInfo',
        found: true,
        resource
    }
}

export default getResourceInfoHandler
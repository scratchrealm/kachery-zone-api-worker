import { Client } from "./Client";
import { GetClientInfoRequest, GetClientInfoResponse } from "./ApiRequest";
import { NodeId } from "./keypair";
import { getClient } from "./getDatabaseItems";
import { Env } from ".";

const getClientInfoHandler = async (request: GetClientInfoRequest, verifiedClientId: NodeId | undefined, env: Env): Promise<GetClientInfoResponse> => {
    const { clientId } = request.payload

    let client: Client
    try {
        client = await getClient(clientId.toString(), {includeSecrets: false}, env)
    }
    catch {
        return {
            type: 'getClientInfo',
            found: false
        }
    }

    // not sure if we want to restrict
    // if (client.clientId !== verifiedClientId) {
    //     throw Error('Not authorized to access this client info')
    // }

    return {
        type: 'getClientInfo',
        found: true,
        client
    }
}

export default getClientInfoHandler
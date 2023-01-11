import { Client, isClient } from "./Client"
import { isNodeId, isSignature, NodeId, Signature } from "./keypair"
import { isResource, Resource } from "./Resource"
import validateObject, { isBoolean, isEqualTo, isNumber, isOneOf, isString, optional } from "./validateObject"

//////////////////////////////////////////////////////////////////////////////////
// findFile

export type FindFileRequest = {
    payload: {
        type: 'findFile'
        timestamp: number
        hashAlg: 'sha1'
        hash: string
    }
    fromClientId?: NodeId
    signature?: Signature
    githubUserId?: string
    githubAccessToken?: string
}

export const isFindFileRequest = (x: any): x is FindFileRequest => {
    const isPayload = (y: any) => {
        return validateObject(y, {
            type: isEqualTo('findFile'),
            timestamp: isNumber,
            hashAlg: isOneOf([isEqualTo('sha1')]),
            hash: isString
        })
    }
    return validateObject(x, {
        payload: isPayload,
        fromClientId: optional(isNodeId),
        signature: optional(isSignature),
        githubUserId: optional(isString),
        githubAccessToken: optional(isString)
    })
}

export type FindFileResponse = {
    type: 'findFile'
    found: boolean
    size?: number
    url?: string
    bucketUri?: string
    objectKey?: string
    cacheHit?: boolean
    fallback?: boolean
}

export const isFindFileResponse = (x: any): x is FindFileResponse => {
    return validateObject(x, {
        type: isEqualTo('findFile'),
        found: isBoolean,
        size: optional(isNumber),
        url: optional(isString),
        bucketUri: optional(isString),
        objectKey: optional(isString),
        cacheHit: optional(isBoolean),
        fallback: optional(isBoolean)
    })
}

//////////////////////////////////////////////////////////////////////////////////
// initiateFileUpload

export type InitiateFileUploadRequest = {
    payload: {
        type: 'initiateFileUpload'
        timestamp: number
        size: number
        hashAlg: 'sha1'
        hash: string
    }
    fromClientId?: NodeId
    signature?: Signature
    githubUserId?: string
    githubAccessToken?: string
}

export const isInitiateFileUploadRequest = (x: any): x is InitiateFileUploadRequest => {
    const isPayload = (y: any) => {
        return validateObject(y, {
            type: isEqualTo('initiateFileUpload'),
            timestamp: isNumber,
            size: isNumber,
            hashAlg: isOneOf([isEqualTo('sha1')]),
            hash: isString
        })
    }
    return validateObject(x, {
        payload: isPayload,
        fromClientId: optional(isNodeId),
        signature: optional(isSignature),
        githubUserId: optional(isString),
        githubAccessToken: optional(isString)
    })
}

export type InitiateFileUploadResponse = {
    type: 'initiateFileUpload'
    alreadyExists?: boolean
    objectKey?: string
    signedUploadUrl?: string
    alreadyPending?: boolean
}

export const isInitiateFileUploadResponse = (x: any): x is InitiateFileUploadResponse => {
    return validateObject(x, {
        type: isEqualTo('initiateFileUpload'),
        alreadyExists: optional(isBoolean),
        objectKey: optional(isString),
        signedUploadUrl: optional(isString),
        alreadyPending: optional(isBoolean)
    })
}

//////////////////////////////////////////////////////////////////////////////////
// finalizeFileUpload

export type FinalizeFileUploadRequest = {
    payload: {
        type: 'finalizeFileUpload'
        timestamp: number
        objectKey: string
        hashAlg: 'sha1'
        hash: string
        size: number
    }
    fromClientId?: NodeId
    signature?: Signature
    githubUserId?: string
    githubAccessToken?: string
}

export const isFinalizeFileUploadRequest = (x: any): x is FinalizeFileUploadRequest => {
    const isPayload = (y: any) => {
        return validateObject(y, {
            type: isEqualTo('finalizeFileUpload'),
            timestamp: isNumber,
            objectKey: isString,
            hashAlg: isOneOf([isEqualTo('sha1')]),
            hash: isString,
            size: isNumber
        })
    }
    return validateObject(x, {
        payload: isPayload,
        fromClientId: optional(isNodeId),
        signature: optional(isSignature),
        githubUserId: optional(isString),
        githubAccessToken: optional(isString)
    })
}

export type FinalizeFileUploadResponse = {
    type: 'finalizeFileUpload'
}

export const isFinalizeFileUploadResponse = (x: any): x is FinalizeFileUploadResponse => {
    return validateObject(x, {
        type: isEqualTo('finalizeFileUpload')
    })
}

//////////////////////////////////////////////////////////////////////////////////
// getClientInfo

export type GetClientInfoRequest = {
    payload: {
        type: 'getClientInfo'
        timestamp: number
        clientId: NodeId
    }
    fromClientId: NodeId
    signature: Signature
    githubUserId?: string
    githubAccessToken?: string
}

export const isGetClientInfoRequest = (x: any): x is GetClientInfoRequest => {
    const isPayload = (y: any) => {
        return validateObject(y, {
            type: isEqualTo('getClientInfo'),
            timestamp: isNumber,
            clientId: isNodeId
        })
    }
    return validateObject(x, {
        payload: isPayload,
        fromClientId: optional(isNodeId),
        signature: optional(isSignature),
        githubUserId: optional(isString),
        githubAccessToken: optional(isString)
    })
}

export type GetClientInfoResponse = {
    type: 'getClientInfo'
    found: boolean
    client?: Client
}

export const isGetClientInfoResponse = (x: any): x is GetClientInfoResponse => {
    return validateObject(x, {
        type: isEqualTo('getClientInfo'),
        found: isBoolean,
        client: optional(isClient)
    })
}

//////////////////////////////////////////////////////////////////////////////////
// getResourceInfo

export type GetResourceInfoRequest = {
    payload: {
        type: 'getResourceInfo'
        timestamp: number
        resourceName: string
    }
    fromClientId: NodeId
    signature: Signature
    githubUserId?: string
    githubAccessToken?: string
}

export const isGetResourceInfoRequest = (x: any): x is GetResourceInfoRequest => {
    const isPayload = (y: any) => {
        return validateObject(y, {
            type: isEqualTo('getResourceInfo'),
            timestamp: isNumber,
            resourceName: isString
        })
    }
    return validateObject(x, {
        payload: isPayload,
        fromClientId: optional(isNodeId),
        signature: optional(isSignature),
        githubUserId: optional(isString),
        githubAccessToken: optional(isString)
    })
}

export type GetResourceInfoResponse = {
    type: 'getResourceInfo'
    found: boolean
    resource?: Resource
}

export const isGetResourceInfoResponse = (x: any): x is GetResourceInfoResponse => {
    return validateObject(x, {
        type: isEqualTo('getResourceInfo'),
        found: isBoolean,
        resource: optional(isResource)
    })
}


//////////////////////////////////////////////////////////////////////////////////

export type ApiRequest =
    FindFileRequest |
    InitiateFileUploadRequest |
    FinalizeFileUploadRequest |
    GetClientInfoRequest |
    GetResourceInfoRequest

export const isApiRequest = (x: any): x is ApiRequest => {
    return isOneOf([
        isFindFileRequest,
        isInitiateFileUploadRequest,
        isFinalizeFileUploadRequest,
        isGetClientInfoRequest,
        isGetResourceInfoRequest
    ])(x)
}

export type ApiResponse =
    FindFileResponse |
    InitiateFileUploadResponse |
    FinalizeFileUploadResponse |
    GetClientInfoResponse |
    GetResourceInfoResponse

export const isApiResponse = (x: any): x is ApiResponse => {
    return isOneOf([
        isFindFileResponse,
        isInitiateFileUploadResponse,
        isFinalizeFileUploadResponse,
        isGetClientInfoResponse,
        isGetResourceInfoResponse
    ])(x)
}
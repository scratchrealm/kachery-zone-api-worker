import { Client, isClient } from "./Client"
import { isResource, Resource } from "./Resource"
import { Env } from "."

export class ObjectCache<ObjectType> {
    #cache: {[key: string]: {object: ObjectType, timestamp: number}} = {}
    constructor(private expirationMsec: number) {
    }
    set(key: string, object: ObjectType) {
        this.#cache[key] = {
            object,
            timestamp: Date.now()
        }
    }
    get(key: string) {
        const a = this.#cache[key]
        if (!a) return undefined
        const elapsed = Date.now() - a.timestamp
        if (elapsed > this.expirationMsec) {
            delete this.#cache[key]
            return undefined
        }
        return a.object
    }
    delete(key: string) {
        if (this.#cache[key]) {
            delete this.#cache[key]
        }
    }
}

const expirationMSec = 60 * 1000
const clientObjectCache = new ObjectCache<Client>(expirationMSec)
const resourceObjectCache = new ObjectCache<Resource>(expirationMSec)
// const allClientsObjectCache = new ObjectCache<Client[]>(5 * 60 * 1000)
const userObjectCache = new ObjectCache<{[key: string]: any}>(expirationMSec)

export const getClient = async (clientId: string, o: {includeSecrets?: boolean}={}, env: Env) => {
    const x = clientObjectCache.get(clientId.toString())
    if (x) {
        if (!o.includeSecrets) x.privateKeyHex = undefined
        return x
    }

    const key = `clients/${clientId}`
    const obj = await env.BUCKET.get(key)
    if (!obj) throw Error('Client not registered. Use kachery-cloud-init to register this kachery-cloud client.')
    const client = JSON.parse(await obj.text())
    if (!isClient(client)) throw Error('Invalid client in bucket')

    clientObjectCache.set(clientId.toString(), {...client})
    if (!o.includeSecrets) client.privateKeyHex = undefined
    return client
}

export const invalidateClientInCache = (clientId: string) => {
    clientObjectCache.delete(clientId)
}

export const getResource = async (resourceName: string, o: {includeSecrets?: boolean}={}, env: Env) => {
    const x = resourceObjectCache.get(resourceName.toString())
    if (x) {
        return x
    }

    const key = `resources/${resourceName}`
    const obj = await env.BUCKET.get(key)
    if (!obj) throw Error('Resource not found.')
    const resource = JSON.parse(await obj.text())
    if (!isResource(resource)) throw Error('Invalid resource in bucket')

    resourceObjectCache.set(resourceName.toString(), {...resource})
    return resource
}

export const invalidateResourceInCache = (resourceName: string) => {
    resourceObjectCache.delete(resourceName)
}

export const getUser = async (userId: string, env: Env) => {
    const x = userObjectCache.get(userId.toString())
    if (x) {
        return x
    }

    const key = `users/${userId}`
    const obj = await env.BUCKET.get(key)
    if (!obj) throw Error('User not found.')
    const user = JSON.parse(await obj.text())

    userObjectCache.set(userId, {...user})
    return user
}

export const invalidateUserInCache = (userId: string) => {
    userObjectCache.delete(userId)
}
import YAML from 'yaml'
import { Env } from '.'
import { AuthorizationSettings, isAuthorizationSettings } from './AuthorizationSettings'
import ObjectCache from "./ObjectCache"

const authorizationSettingsCache = new ObjectCache<AuthorizationSettings>(1000 * 60 * 5)

const getAuthorizationSettings = async (env: Env) => {
    const a = authorizationSettingsCache.get('main')
    if (a) return a
    const k = 'settings/authorizationSettings.yaml'
    const obj = await env.BUCKET.get(k, {})
    if (!obj) throw Error('Authorization settings not found')
    const x = await obj.text()
    const authorizationSettings = YAML.parse(x)
    if (!isAuthorizationSettings(authorizationSettings)) {
        throw Error('Invalid authorization settings')
    }
    authorizationSettingsCache.set('main', authorizationSettings)
    return authorizationSettings
}

export default getAuthorizationSettings
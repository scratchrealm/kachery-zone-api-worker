import YAML from 'yaml'
import { AuthorizationSettings, isAuthorizationSettings } from './AuthorizationSettings'
import { getBucket } from "./initiateFileUploadHandler"
import ObjectCache from "./ObjectCache"
import { getObjectContent } from "./s3Helpers"

const authorizationSettingsCache = new ObjectCache<AuthorizationSettings>(1000 * 60 * 5)

const getAuthorizationSettings = async () => {
    const a = authorizationSettingsCache.get('main')
    if (a) return a
    const bucket = getBucket()
    let x = (await getObjectContent(bucket, 'settings/authorizationSettings.yaml')).toString()
    const authorizationSettings = YAML.parse(x)
    if (!isAuthorizationSettings(authorizationSettings)) {
        throw Error('Invalid authorization settings')
    }
    authorizationSettingsCache.set('main', authorizationSettings)
    return authorizationSettings
}

export default getAuthorizationSettings
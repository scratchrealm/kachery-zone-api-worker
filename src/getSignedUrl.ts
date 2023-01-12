import { Env } from "."

type PresignerRequest = {
    type: 'getSignedUrl',
    operation: 'getObject' | 'putObject',
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    bucketName: string,
    objectKey: string,
    expiresSec: number
}

const presignerUrl = 'https://presigner.vercel.app'

export const getSignedUrl = async (operation: 'getObject' | 'putObject', objectKey: string, expiresSec: number, env: Env): Promise<string> => {
    const req: PresignerRequest = {
        type: 'getSignedUrl',
        operation,
        accessKeyId: env.BUCKET_ACCESS_KEY_ID,
        secretAccessKey: env.BUCKET_SECRET_ACCESS_KEY_ID,
        region: env.BUCKET_REGION,
        bucketName: env.BUCKET_NAME,
        objectKey,
        expiresSec
    }
    const r = await fetch(`${presignerUrl}/api/presign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(req)
    })
    if (r.status !== 200) {
        throw Error('Problem getting presigned URL')
    }
    const resp: {[key: string]: any} = await r.json()
    if (!resp.url) {
        throw Error('Unexpected: no url in response')
    }
    return resp.url
}
/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { isApiRequest, isFinalizeFileUploadRequest, isFindFileRequest, isFindFileResponse, isGetClientInfoRequest, isGetResourceInfoRequest, isInitiateFileUploadRequest } from "./ApiRequest";
import { hexToPublicKey, verifySignature } from "./crypto/signatures";
import finalizeFileUploadHandler from "./finalizeFileUploadHandler";
import findFileHandler from "./findFileHandler";
import getClientInfoHandler from "./getClientInfoHandler";
import getResourceInfoHandler from "./getResourceInfoHandler";
import initiateFileUploadHandler from "./initiateFileUploadHandler";
import { NodeId, nodeIdToPublicKeyHex, Signature } from "./keypair";
import { LogItem } from "./LogItem";
import randomAlphaString from "./randomAlphaString";

export interface Env {
	BUCKET_ACCESS_KEY_ID: string;
    BUCKET_SECRET_ACCESS_KEY_ID: string;
    BUCKET_REGION: string;
    BUCKET_NAME: string;

	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	FIND_FILE_CACHE: KVNamespace;
	LOG_ITEMS: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	BUCKET: R2Bucket;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		try {
			const referer = request.headers.get('referer')
			const origin = request.headers.get('origin') || getOriginForReferer(referer || '')
			const method = request.method
			const url = new URL(request.url)
			const urlPath = url.pathname
			const timer = Date.now()
			const requestHeaders: {[key: string]: any} = {}
			request.headers.forEach((key, value) => {
				requestHeaders[key] = value
			})

			const writeLogItem = async (logItem: LogItem) => {
				const logItem2 = {...logItem}
				logItem2.request = {...logItem2.request}
				delete logItem2.request['signature']
				delete logItem2.request['githubAccessToken']
			
				await env.LOG_ITEMS.put(randomAlphaString(10), JSON.stringify(logItem2))
			}

			if (method === 'POST') {
				const req = await readRequestJson(request)
				if (urlPath === '/api') {
					if (!isApiRequest(req)) {
						throw Error(`Invalid POST request: ${JSON.stringify(req)}`)
					}
					const verifiedClientId = await verifyClientId(req.fromClientId, req.payload, req.signature)
					const verifiedUserId = await verifyGithubUserId(req.githubUserId, req.githubAccessToken)
					if (isFindFileRequest(req)) {
						const resp = await findFileHandler(req, verifiedClientId, verifiedUserId, env)
						if (!resp.cacheHit) {
							const elapsed = Date.now() - timer
							await writeLogItem({request: req, response: resp, requestTimestamp: req.payload.timestamp, elapsed, requestHeaders})
						}
						return jsonResponse(resp, {origin})
					}
					else if (isInitiateFileUploadRequest(req)) {
						const resp = await initiateFileUploadHandler(req, verifiedClientId, verifiedUserId, env)
						if (!resp.alreadyExists) {
							const elapsed = Date.now() - timer
							await writeLogItem({request: req, response: resp, requestTimestamp: req.payload.timestamp, elapsed, requestHeaders})
						}
						return jsonResponse(resp, {origin})
					}
					else if (isFinalizeFileUploadRequest(req)) {
						const resp = await finalizeFileUploadHandler(req, verifiedClientId, verifiedUserId, env)
						const elapsed = Date.now() - timer
						await writeLogItem({request: req, response: resp, requestTimestamp: req.payload.timestamp, elapsed, requestHeaders})
						return jsonResponse(resp, {origin})
					}
					else if (isGetClientInfoRequest(req)) {
						const resp = await getClientInfoHandler(req, verifiedClientId, env)
						return jsonResponse(resp, {origin})
					}
					else if (isGetResourceInfoRequest(req)) {
						const resp = await getResourceInfoHandler(req, verifiedClientId, env)
						return jsonResponse(resp, {origin})
					}
					else {
						throw Error(`Unexpected findFile request: ${(req as any).payload.type}`)
					}
				}
				else {
					throw Error(`Unexpected URL path: ${urlPath}`)
				}
			}
			else if (method === 'GET') {
				if (urlPath.startsWith('/api/download')) {
					const objectKey = urlPath.split('/').slice(3).join('/')
					if (!objectKey.startsWith('sha1/')) {
						throw Error(`Invalid object key: ${objectKey}`)
					}
					const obj = await env.BUCKET.get(objectKey)
					if (!obj) {
						return new Response('Not found', {status: 404})
					}
					const headers = new Headers()
					if (['https://figurl.org', 'http://localhost:3000'].includes(origin)) {
						headers.set('ALLOW-ORIGIN', origin)
					}
					return new Response(obj.body, {status: 200, headers})
				}
				else {
					throw Error('Invalid path')
				}
			}
			else if (method === 'PUT') {
				if (urlPath.startsWith('/api/upload')) {
					const objectKey = urlPath.split('/').slice(3).join('/')
					if (!objectKey.startsWith('sha1/')) {
						throw Error(`Invalid object key: ${objectKey}`)
					}
					const obj = await env.BUCKET.head(objectKey)
					if (obj) {
						console.warn('Object already exists.')
						// in this case we don't want to overwrite, because it would open us up to an attack of replacing content with corrupt data
						return new Response('Already exists.', {status: 200})
					}
					await env.BUCKET.put(objectKey, request.body)
					return new Response('', {status: 200})
				}
				else {
					throw Error('Invalid path')
				}
			}
			else {
				return new Response('Method Not Allowed', {
					status: 405,
					headers: {
						Allow: 'POST, GET, PUT'
					}
				})
			}
		}
		catch(err: any) {
			return new Response(err.message, {
				status: 500
			})
		}
	},
};

function jsonResponse(resp: any, o: {origin: string}) {
	const headers = new Headers()
	headers.set('content-type', 'application/json')
	headers.set('allow-origin', o.origin)
	return new Response(JSON.stringify(resp), {
		status: 200,
		headers
	})
}

function getOriginForReferer(referer: string) {
	const aa = referer.split('/')
	return aa.slice(0, 3).join('/')
}

async function readRequestJson(request: Request) {
	const { headers } = request;
	const contentType = headers.get('content-type') || '';
  
	if (contentType.includes('application/json')) {
		return await request.json();
	} else {
		throw Error(`Invalid content type for request: ${contentType}`)
	}
}

async function verifyClientId(clientId: NodeId | undefined, payload: any, signature?: Signature) {
	if (!clientId) return clientId
	if (!signature) throw Error('No signature')
	if (!(await verifySignature(payload, hexToPublicKey(nodeIdToPublicKeyHex(clientId)), signature))) {
		throw Error('Invalid signature')
	}
	return clientId
}

async function verifyGithubUserId(userId: string | undefined, accessToken: string | undefined) {
	if (!userId) return userId
	if (!accessToken) throw Error('No github access token')
	if (!(await verifyGithubUserId(userId, accessToken))) {
		throw Error('Unable to verify Github user ID')
	}
	return userId
}
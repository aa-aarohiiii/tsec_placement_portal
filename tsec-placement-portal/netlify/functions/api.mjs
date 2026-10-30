/**
 * Netlify Function that runs the whole portal backend (every /api/... request).
 * The website pages themselves (public/) are served directly by Netlify.
 *
 * Data lives in Netlify Blobs (see lib/store.js): the SQLite database is loaded
 * at the start of a request and saved at the end if anything changed.
 *
 * The Express app (server.js) is reused as-is: each web Request is turned into
 * the event shape serverless-http understands, and its answer back into a Response.
 */
import { createRequire } from 'node:module';

process.env.PORTAL_STORAGE = 'blobs';
process.env.TZ = process.env.PORTAL_TZ || 'Asia/Kolkata'; // drive deadlines are entered in Indian time

const require = createRequire(import.meta.url);
const serverless = require('serverless-http');
const { app, init } = require('../../server.js');
const db = require('../../db.js');
const mailer = require('../../lib/mailer.js');

let ready = null;
const handle = serverless(app, { binary: ['application/pdf', 'application/octet-stream'] });

export default async (request) => {
  if (!ready) ready = init().catch((err) => { ready = null; throw err; });
  await ready;

  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  const query = {};
  url.searchParams.forEach((value, key) => { query[key] = value; });
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : null;

  const event = {
    httpMethod: request.method,
    path: url.pathname,
    headers,
    queryStringParameters: Object.keys(query).length ? query : null,
    body: body && body.length ? body.toString('base64') : null,
    isBase64Encoded: true,
    requestContext: {},
  };

  await db.refresh();                  // pick up changes saved by other instances
  const result = await handle(event, {});
  await db.flush();                    // save this request's changes
  await mailer.drain();                // let notification emails finish sending

  const out = new Headers();
  for (const [k, v] of Object.entries(result.multiValueHeaders || {})) for (const one of [].concat(v)) out.append(k, String(one));
  for (const [k, v] of Object.entries(result.headers || {})) if (!out.has(k)) out.set(k, String(v));
  const resBody = result.body ? Buffer.from(result.body, result.isBase64Encoded ? 'base64' : 'utf8') : null;
  return new Response(result.statusCode === 204 || result.statusCode === 304 ? null : resBody, { status: result.statusCode, headers: out });
};

export const config = { path: '/api/*' };

import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { createJsonBodyErrorHandler, createJsonBodyParser } from '../jsonBodyParser';

interface PostResult {
  status: number;
  contentType: string;
  body: string;
}

function startApp(): Promise<http.Server> {
  const app = express();
  app.use(createJsonBodyParser());
  app.use(createJsonBodyErrorHandler());
  app.post('/reports', (req, res) => res.json({ points: req.body.timeline.length }));
  app.post('/profile', (req, res) => res.json({ keys: Object.keys(req.body).length }));
  app.get('/boom', (_req, _res, next) => next(new Error('unrelated failure')));
  // Stands in for whatever error handling runs after the JSON one.
  app.use(((error, _req, res, _next) => {
    res.status(500).send(`downstream: ${error.message}`);
  }) as express.ErrorRequestHandler);
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

function request(server: http.Server, method: string, path: string, payload?: string): Promise<PostResult> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        // No keep-alive, so closing the server at the end never waits on an idle socket.
        agent: false,
        headers: {
          Connection: 'close',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, contentType: String(res.headers['content-type'] || ''), body })
        );
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// A realistic long class: one point per second with an unrounded float average.
const timelineOf = (points: number) =>
  Array.from({ length: points }, (_, i) => ({ time: '12:34:56', value: 72.33333333333333 + (i % 7) }));

describe('jsonBodyParser', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = await startApp();
  });

  afterAll(done => {
    server.close(() => done());
  });

  it('accepts a ~5,000-point attention report on POST /reports', async () => {
    const payload = JSON.stringify({ timeline: timelineOf(5000) });
    expect(Buffer.byteLength(payload)).toBeGreaterThan(100 * 1024);

    const result = await request(server, 'POST', '/reports', payload);

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ points: 5000 });
  });

  it('accepts the validator maximum of 10,800 timeline points on POST /reports', async () => {
    const result = await request(server, 'POST', '/reports', JSON.stringify({ timeline: timelineOf(10800) }));

    expect(result.status).toBe(200);
  });

  it('keeps the default 100kb limit on every other route and answers 413 as JSON', async () => {
    const payload = JSON.stringify({ filler: 'x'.repeat(150 * 1024) });

    const result = await request(server, 'POST', '/profile', payload);

    expect(result.status).toBe(413);
    expect(result.contentType).toMatch(/application\/json/);
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: 'request entity too large',
        explanation: expect.stringMatching(/demasiado grande/),
      },
    });
  });

  it('still parses small bodies on other routes', async () => {
    const result = await request(server, 'POST', '/profile', JSON.stringify({ displayName: 'Ana' }));

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ keys: 1 });
  });

  it('answers a body above the /reports limit with the JSON 413 too', async () => {
    const payload = JSON.stringify({ timeline: [], filler: 'x'.repeat(3 * 1024 * 1024) });

    const result = await request(server, 'POST', '/reports', payload);

    expect(result.status).toBe(413);
    expect(JSON.parse(result.body).error.message).toBe('request entity too large');
  });

  it('passes unrelated errors through to the next error handler', async () => {
    const result = await request(server, 'GET', '/boom');

    expect(result.status).toBe(500);
    expect(result.body).toBe('downstream: unrelated failure');
  });
});

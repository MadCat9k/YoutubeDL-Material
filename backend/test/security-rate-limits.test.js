const assert = require('assert');
const http = require('http');
const express = require('express');

const security_rate_limits = require('../security-rate-limits');

function startServer(middleware, handler) {
    const app = express();
    app.use(express.json());
    app.post('/test', middleware, handler);

    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function post(server, body) {
    const payload = JSON.stringify(body);
    const address = server.address();

    return new Promise((resolve, reject) => {
        const request = http.request({
            hostname: '127.0.0.1',
            port: address.port,
            path: '/test',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, response => {
            let responseBody = '';
            response.setEncoding('utf8');
            response.on('data', chunk => responseBody += chunk);
            response.on('end', () => resolve({
                status: response.statusCode,
                headers: response.headers,
                body: responseBody
            }));
        });

        request.on('error', reject);
        request.end(payload);
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe('Authentication rate limits', function() {
    it('counts failed logins without charging successful requests', async function() {
        const limiters = security_rate_limits.createAuthenticationLimiters({
            login: {windowMs: 60 * 1000, max: 2}
        });
        const server = await startServer(limiters.login, (req, res) => {
            res.sendStatus(req.body.accept ? 204 : 401);
        });

        try {
            assert.strictEqual((await post(server, {accept: true})).status, 204);
            assert.strictEqual((await post(server, {accept: true})).status, 204);
            assert.strictEqual((await post(server, {accept: false})).status, 401);
            assert.strictEqual((await post(server, {accept: false})).status, 401);

            const rejected = await post(server, {accept: false, password: 'synthetic-secret'});
            assert.strictEqual(rejected.status, 429);
            assert.strictEqual(rejected.headers['ratelimit-limit'], '2');
            assert.strictEqual(rejected.body.includes('synthetic-secret'), false);
            assert.deepStrictEqual(JSON.parse(rejected.body), security_rate_limits.TOO_MANY_REQUESTS_RESPONSE);
        } finally {
            await closeServer(server);
        }
    });

    it('bounds successful registration attempts and returns retry metadata', async function() {
        const limiters = security_rate_limits.createAuthenticationLimiters({
            registration: {windowMs: 60 * 1000, max: 1}
        });
        const server = await startServer(limiters.registration, (_req, res) => res.sendStatus(201));

        try {
            assert.strictEqual((await post(server, {userid: 'synthetic-user'})).status, 201);
            const rejected = await post(server, {userid: 'another-synthetic-user'});

            assert.strictEqual(rejected.status, 429);
            assert.strictEqual(rejected.headers['ratelimit-limit'], '1');
            assert.ok(rejected.headers['retry-after']);
        } finally {
            await closeServer(server);
        }
    });

    it('uses conservative fixed policies for credential and token routes', function() {
        assert.deepStrictEqual(security_rate_limits.AUTHENTICATION_POLICIES, {
            login: {windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true},
            registration: {windowMs: 60 * 60 * 1000, max: 5},
            jwtAuth: {windowMs: 15 * 60 * 1000, max: 30, skipSuccessfulRequests: true},
            apiKeyGeneration: {windowMs: 60 * 60 * 1000, max: 5}
        });
    });
});

const rateLimit = require('express-rate-limit');

const TOO_MANY_REQUESTS_RESPONSE = Object.freeze({
    success: false,
    error: 'Too many requests. Try again later.'
});

const AUTHENTICATION_POLICIES = Object.freeze({
    login: Object.freeze({
        windowMs: 15 * 60 * 1000,
        max: 10,
        skipSuccessfulRequests: true
    }),
    registration: Object.freeze({
        windowMs: 60 * 60 * 1000,
        max: 5
    }),
    jwtAuth: Object.freeze({
        windowMs: 15 * 60 * 1000,
        max: 30,
        skipSuccessfulRequests: true
    }),
    apiKeyGeneration: Object.freeze({
        windowMs: 60 * 60 * 1000,
        max: 5
    }),
    passwordChange: Object.freeze({
        windowMs: 60 * 60 * 1000,
        max: 5
    }),
    userMutation: Object.freeze({
        windowMs: 15 * 60 * 1000,
        max: 30
    }),
    userRead: Object.freeze({
        windowMs: 15 * 60 * 1000,
        max: 60
    })
});

function createLimiter(policy) {
    return rateLimit({
        ...policy,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => res.status(429).send(TOO_MANY_REQUESTS_RESPONSE)
    });
}

exports.createAuthenticationLimiters = (overrides = {}) => {
    const policy = name => ({...AUTHENTICATION_POLICIES[name], ...(overrides[name] || {})});

    return {
        login: createLimiter(policy('login')),
        registration: createLimiter(policy('registration')),
        jwtAuth: createLimiter(policy('jwtAuth')),
        apiKeyGeneration: createLimiter(policy('apiKeyGeneration')),
        passwordChange: createLimiter(policy('passwordChange')),
        userMutation: createLimiter(policy('userMutation')),
        userRead: createLimiter(policy('userRead'))
    };
};

exports.AUTHENTICATION_POLICIES = AUTHENTICATION_POLICIES;
exports.TOO_MANY_REQUESTS_RESPONSE = TOO_MANY_REQUESTS_RESPONSE;

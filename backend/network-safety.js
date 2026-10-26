const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const net = require('net');

function isPrivateIPv4(address) {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;

    const [first, second] = octets;
    return first === 0 || first === 10 || first === 127 || first >= 224 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && (second === 0 || second === 168)) ||
        (first === 198 && (second === 18 || second === 19 || second === 51)) ||
        (first === 203 && second === 0);
}

function isPrivateAddress(address) {
    const family = net.isIP(address);
    if (family === 4) return isPrivateIPv4(address);
    if (family !== 6) return true;

    const normalized = address.toLowerCase();
    const mapped_ipv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped_ipv4) return isPrivateIPv4(mapped_ipv4[1]);

    return normalized === '::' || normalized === '::1' ||
        normalized.startsWith('::ffff:') ||
        normalized.startsWith('fc') || normalized.startsWith('fd') ||
        /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') ||
        normalized.startsWith('2001:db8:');
}

async function resolvePublicAddress(hostname) {
    const literal_family = net.isIP(hostname);
    const addresses = literal_family
        ? [{address: hostname, family: literal_family}]
        : await dns.lookup(hostname, {all: true, verbatim: true});
    const public_address = addresses.find(candidate => !isPrivateAddress(candidate.address));
    if (!public_address) throw new Error('Remote host did not resolve to a public address.');
    return public_address;
}

function createPinnedAgent(url, resolved_address) {
    const Agent = url.protocol === 'https:' ? https.Agent : http.Agent;
    return new Agent({
        lookup: (hostname, options, callback) => {
            if (options && options.all) return callback(null, [resolved_address]);
            callback(null, resolved_address.address, resolved_address.family);
        }
    });
}

module.exports = {
    createPinnedAgent,
    isPrivateAddress,
    resolvePublicAddress
};

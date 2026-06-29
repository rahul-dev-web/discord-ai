const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SECURITY_SALT = 'test-security-salt-at-least-16';

const firebase = require('../src/core/firebase-config');
const SecurityEngine = require('../src/engines/security-engine');

function installFirebaseMemoryStore() {
  const store = new Map();

  firebase.set = async (path, data) => {
    store.set(path, data);
    return true;
  };

  firebase.get = async (path) => store.get(path) || null;

  firebase.update = async (path, updates) => {
    store.set(path, { ...(store.get(path) || {}), ...updates });
    return true;
  };

  firebase.remove = async (path) => {
    store.delete(path);
    return true;
  };

  return store;
}

test('recovery codes verify once and then become used', async () => {
  installFirebaseMemoryStore();
  const engine = new SecurityEngine({}, {});
  const codes = ['ABCD1234'];

  await engine.storeRecoveryCodes('guild-1', 'user-1', codes);

  assert.equal(await engine.verifyRecoveryCode('guild-1', 'user-1', 'ABCD1234'), true);
  assert.equal(await engine.verifyRecoveryCode('guild-1', 'user-1', 'ABCD1234'), false);
  assert.equal(await engine.verifyRecoveryCode('guild-1', 'user-1', 'WRONG'), false);
});

test('otp is stored hashed and removed after verification', async () => {
  const store = installFirebaseMemoryStore();
  const engine = new SecurityEngine({}, {});

  await engine.storeOTP('guild-1', 'user-1', '123456');
  const stored = store.get('servers/guild-1/otp/user-1');

  assert.notEqual(stored.otpHash, '123456');
  assert.equal(await engine.verifyOTP('guild-1', 'user-1', '123456'), true);
  assert.equal(await engine.verifyOTP('guild-1', 'user-1', '123456'), false);
});

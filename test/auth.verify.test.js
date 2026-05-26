import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { createApp } from "../src/app.js";
import { MemoryChallengeStore } from "../src/auth/challenge-store.js";

function testConfig(serverKeypair, overrides = {}) {
  return {
    serverKeypair,
    serverAccountId: serverKeypair.publicKey(),
    homeDomain: "trustlink.test",
    webAuthDomain: "trustlink.test",
    networkPassphrase: Networks.TESTNET,
    jwtSecret: "test-secret",
    jwtExpiresInSeconds: 3600,
    challengeTimeoutSeconds: 300,
    ...overrides,
  };
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function signChallenge(transaction, signer) {
  const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET);
  tx.sign(signer);
  return tx.toXDR();
}

test("POST /auth/verify accepts a signed SEP-10 challenge and returns a JWT", async () => {
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();
  const app = createApp({ config: testConfig(serverKeypair) });

  await withServer(app, async (baseUrl) => {
    const challenge = await postJson(baseUrl, "/auth/challenge", {
      publicKey: clientKeypair.publicKey(),
    });
    assert.equal(challenge.status, 201);

    const signedTransaction = signChallenge(challenge.body.transaction, clientKeypair);
    const verified = await postJson(baseUrl, "/auth/verify", {
      publicKey: clientKeypair.publicKey(),
      signedTransaction,
      role: "vendor",
    });

    assert.equal(verified.status, 200);
    assert.equal(verified.body.expiresIn, 3600);
    assert.equal(verified.body.token.split(".").length, 3);

    const claims = JSON.parse(
      Buffer.from(verified.body.token.split(".")[1], "base64url").toString("utf8"),
    );
    assert.equal(claims.sub, clientKeypair.publicKey());
    assert.equal(claims.role, "vendor");
  });
});

test("POST /auth/verify rejects a challenge signed by a different key", async () => {
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();
  const otherKeypair = Keypair.random();
  const app = createApp({ config: testConfig(serverKeypair) });

  await withServer(app, async (baseUrl) => {
    const challenge = await postJson(baseUrl, "/auth/challenge", {
      publicKey: clientKeypair.publicKey(),
    });

    const signedTransaction = signChallenge(challenge.body.transaction, otherKeypair);
    const verified = await postJson(baseUrl, "/auth/verify", {
      publicKey: clientKeypair.publicKey(),
      signedTransaction,
    });

    assert.equal(verified.status, 401);
    assert.equal(verified.body.code, "invalid_challenge_signature");
  });
});

test("POST /auth/verify rejects replayed challenges", async () => {
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();
  const app = createApp({ config: testConfig(serverKeypair) });

  await withServer(app, async (baseUrl) => {
    const challenge = await postJson(baseUrl, "/auth/challenge", {
      publicKey: clientKeypair.publicKey(),
    });
    const signedTransaction = signChallenge(challenge.body.transaction, clientKeypair);

    const first = await postJson(baseUrl, "/auth/verify", {
      publicKey: clientKeypair.publicKey(),
      signedTransaction,
    });
    const second = await postJson(baseUrl, "/auth/verify", {
      publicKey: clientKeypair.publicKey(),
      signedTransaction,
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "challenge_replayed");
  });
});

test("POST /auth/verify rejects expired server-issued challenges", async () => {
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();
  let now = Date.now();
  const challengeStore = new MemoryChallengeStore({ clock: () => now });
  const app = createApp({
    config: testConfig(serverKeypair, { challengeTimeoutSeconds: 1 }),
    challengeStore,
  });

  await withServer(app, async (baseUrl) => {
    const challenge = await postJson(baseUrl, "/auth/challenge", {
      publicKey: clientKeypair.publicKey(),
    });
    const signedTransaction = signChallenge(challenge.body.transaction, clientKeypair);

    now += 2_000;

    const verified = await postJson(baseUrl, "/auth/verify", {
      publicKey: clientKeypair.publicKey(),
      signedTransaction,
    });

    assert.equal(verified.status, 401);
    assert.equal(verified.body.code, "challenge_expired");
  });
});

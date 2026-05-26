import { StrKey, WebAuth } from "@stellar/stellar-sdk";
import { badRequest, unauthorized } from "../errors.js";
import { signJwt } from "./jwt.js";

function challengeIdFromTransaction(tx) {
  return tx.hash().toString("hex");
}

function requirePublicKey(publicKey) {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw badRequest("invalid_public_key", "publicKey must be a valid Stellar G... address");
  }
}

function readChallenge(transaction, config) {
  try {
    return WebAuth.readChallengeTx(
      transaction,
      config.serverAccountId,
      config.networkPassphrase,
      config.homeDomain,
      config.webAuthDomain,
    );
  } catch (error) {
    throw unauthorized("invalid_challenge", error.message);
  }
}

export function buildChallenge({ publicKey }, { config, challengeStore }) {
  requirePublicKey(publicKey);

  const transaction = WebAuth.buildChallengeTx(
    config.serverKeypair,
    publicKey,
    config.homeDomain,
    config.challengeTimeoutSeconds,
    config.networkPassphrase,
    config.webAuthDomain,
  );

  const { tx, clientAccountID } = readChallenge(transaction, config);
  const challengeId = challengeIdFromTransaction(tx);
  const expiresAt = new Date(Date.now() + config.challengeTimeoutSeconds * 1000).toISOString();

  challengeStore.save({
    challengeId,
    publicKey: clientAccountID,
    expiresAt,
  });

  return {
    transaction,
    challengeId,
    networkPassphrase: config.networkPassphrase,
    homeDomain: config.homeDomain,
    webAuthDomain: config.webAuthDomain,
    expiresAt,
  };
}

export function verifySignedChallenge(
  { publicKey, signedTransaction, role = "vendor" },
  { config, challengeStore },
) {
  requirePublicKey(publicKey);

  if (!["vendor", "admin"].includes(role)) {
    throw badRequest("invalid_role", "role must be vendor or admin");
  }

  if (!signedTransaction) {
    throw badRequest("missing_transaction", "signedTransaction is required");
  }

  const { tx, clientAccountID } = readChallenge(signedTransaction, config);
  const challengeId = challengeIdFromTransaction(tx);
  const challenge = challengeStore.get(challengeId);

  if (!challenge) {
    throw unauthorized("challenge_not_found", "Challenge was not issued by this server");
  }

  if (challenge.publicKey !== publicKey || clientAccountID !== publicKey) {
    throw unauthorized("public_key_mismatch", "Signed challenge does not match publicKey");
  }

  try {
    WebAuth.verifyChallengeTxSigners(
      signedTransaction,
      config.serverAccountId,
      config.networkPassphrase,
      [publicKey],
      config.homeDomain,
      config.webAuthDomain,
    );
  } catch (error) {
    throw unauthorized("invalid_challenge_signature", error.message);
  }

  challengeStore.consume(challengeId);

  const token = signJwt(
    {
      sub: publicKey,
      role,
    },
    {
      secret: config.jwtSecret,
      expiresInSeconds: config.jwtExpiresInSeconds,
    },
  );

  return {
    token,
    expiresIn: config.jwtExpiresInSeconds,
  };
}

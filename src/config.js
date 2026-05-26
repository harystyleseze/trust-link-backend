import { Keypair, Networks } from "@stellar/stellar-sdk";

const DURATIONS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

export function parseDurationSeconds(value, fallbackSeconds) {
  if (value === undefined || value === null || value === "") {
    return fallbackSeconds;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("duration must be a positive integer");
    }
    return value;
  }

  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) {
    throw new Error(`invalid duration: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();
  return amount * DURATIONS[unit];
}

export function readConfig(env = process.env) {
  const serverSigningSecret = env.SERVER_SIGNING_SECRET;
  if (!serverSigningSecret) {
    throw new Error("SERVER_SIGNING_SECRET is required");
  }

  const serverKeypair = Keypair.fromSecret(serverSigningSecret);
  const homeDomain = env.HOME_DOMAIN || "trustlink.local";
  const webAuthDomain = env.WEB_AUTH_DOMAIN || homeDomain;
  const networkPassphrase =
    env.STELLAR_NETWORK_PASSPHRASE ||
    (env.STELLAR_NETWORK?.toLowerCase() === "public"
      ? Networks.PUBLIC
      : Networks.TESTNET);

  return {
    serverKeypair,
    serverAccountId: serverKeypair.publicKey(),
    homeDomain,
    webAuthDomain,
    networkPassphrase,
    jwtSecret: env.JWT_SECRET || serverSigningSecret,
    jwtExpiresInSeconds: parseDurationSeconds(env.JWT_EXPIRES_IN, 7 * 24 * 60 * 60),
    challengeTimeoutSeconds: parseDurationSeconds(
      env.CHALLENGE_TIMEOUT_SECONDS,
      5 * 60,
    ),
  };
}

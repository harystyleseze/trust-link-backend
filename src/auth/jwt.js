import crypto from "node:crypto";

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signJwt(payload, { secret, expiresInSeconds, now = () => Date.now() }) {
  const iat = Math.floor(now() / 1000);
  const body = {
    ...payload,
    iat,
    exp: iat + expiresInSeconds,
  };

  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const claims = encodeJson(body);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${claims}`)
    .digest("base64url");

  return `${header}.${claims}.${signature}`;
}

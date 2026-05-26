export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function badRequest(code, message) {
  return new HttpError(400, code, message);
}

export function unauthorized(code, message) {
  return new HttpError(401, code, message);
}

export function conflict(code, message) {
  return new HttpError(409, code, message);
}

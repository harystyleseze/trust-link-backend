import { conflict, unauthorized } from "../errors.js";

export class MemoryChallengeStore {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.records = new Map();
  }

  save(record) {
    this.prune();
    this.records.set(record.challengeId, {
      ...record,
      usedAt: null,
    });
  }

  get(challengeId) {
    return this.records.get(challengeId) || null;
  }

  consume(challengeId) {
    const record = this.get(challengeId);
    if (!record) {
      throw unauthorized("challenge_not_found", "Challenge was not issued by this server");
    }

    if (record.usedAt) {
      throw conflict("challenge_replayed", "Challenge has already been used");
    }

    if (new Date(record.expiresAt).getTime() <= this.clock()) {
      this.records.delete(challengeId);
      throw unauthorized("challenge_expired", "Challenge has expired");
    }

    record.usedAt = new Date(this.clock()).toISOString();
    return record;
  }

  prune() {
    const now = this.clock();
    for (const [challengeId, record] of this.records.entries()) {
      if (!record.usedAt && new Date(record.expiresAt).getTime() > now) {
        continue;
      }

      if (record.usedAt && now - new Date(record.usedAt).getTime() < 60_000) {
        continue;
      }

      this.records.delete(challengeId);
    }
  }
}

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    APNS_TEAM_ID?: string;
    APNS_KEY_ID?: string;
    APNS_PRIVATE_KEY?: string;
  }
}

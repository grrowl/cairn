// Secrets are configured once on the existing Cloudflare Worker.
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    COOKIE_ENCRYPTION_KEY: string;
    ADMIN_EMAIL: string;
    BASE_URL?: string;
  }
}
interface Env extends Cloudflare.Env {}

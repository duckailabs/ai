import { Cookie, CookieJar } from "tough-cookie";
import { TwitterApi } from "twitter-api-v2";
import type { APIv2Credentials, TwitterAuthStrategy } from "../interfaces";

export class CookieAuthStrategy implements TwitterAuthStrategy {
  private cookieJar: CookieJar;
  private readonly bearerToken =
    "AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF";
  private readonly domains = ["twitter.com", ".twitter.com", "x.com", ".x.com"];
  constructor() {
    this.cookieJar = new CookieJar();
  }

  async setCookies(cookies: Array<any>): Promise<void> {
    for (const cookie of cookies) {
      // For each cookie, try setting it for all domains
      for (const domain of this.domains) {
        try {
          const cookieString = this.constructCookieString({
            ...cookie,
            domain: domain,
          });
          await this.cookieJar.setCookie(cookieString, `https://${domain}`);
        } catch (error) {
          console.warn(`Failed to set cookie for domain ${domain}:`, error);
        }
      }
    }

    // Verify critical cookies were set
    const cookies1 = await this.cookieJar.getCookies("https://twitter.com");

    const critical = ["auth_token", "ct0", "twid"];
    const missing = critical.filter(
      (name) => !cookies1.some((c) => c.key === name && c.value)
    );

    if (missing.length) {
      throw new Error(`Missing critical cookies: ${missing.join(", ")}`);
    }
  }

  private constructCookieString(cookie: any): string {
    const parts = [
      `${cookie.name}=${cookie.value}`,
      `Domain=${cookie.domain}`,
      `Path=${cookie.path || "/"}`,
    ];

    if (cookie.expires && cookie.expires !== -1) {
      parts.push(`Expires=${new Date(cookie.expires * 1000).toUTCString()}`);
    }

    if (cookie.httpOnly) parts.push("HttpOnly");
    if (cookie.secure) parts.push("Secure");
    if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);

    return parts.join("; ");
  }

  async getHeaders(): Promise<Record<string, string>> {
    // Try both domains when getting cookies
    let cookieString = "";
    let cookies: Cookie[] = [];

    for (const domain of this.domains) {
      const domainCookies = await this.cookieJar.getCookies(
        `https://${domain}`
      );
      cookies = [...cookies, ...domainCookies];
    }

    cookieString = cookies.map((c) => `${c.key}=${c.value}`).join("; ");

    const csrfToken = cookies.find((c) => c.key === "ct0")?.value;

    const headers: Record<string, string> = {
      authorization: `Bearer ${this.bearerToken}`,
      cookie: cookieString,
      "content-type": "application/json",
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    return headers;
  }

  async isAuthenticated(): Promise<boolean> {
    const cookies = await this.cookieJar.getCookies("https://x.com");
    return cookies.some((cookie) => cookie.key === "auth_token");
  }
}

export class APIv2AuthStrategy implements TwitterAuthStrategy {
  private client: TwitterApi;
  private bearerToken: string | null = null;

  constructor(credentials: APIv2Credentials) {
    this.client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.bearerToken) {
      //this.bearerToken = await this.client.appLogin();
    }

    return {
      authorization: `Bearer ${this.bearerToken}`,
      "content-type": "application/json",
    };
  }

  getClient(): TwitterApi {
    return this.client;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.v2.me();
      return true;
    } catch {
      return false;
    }
  }
}

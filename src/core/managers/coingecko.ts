import { dbSchemas } from "@/db";
import type { Coin, CoinPriceHistory } from "@/db/schema/schema";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import cron from "node-cron";
import { log } from "../utils/logger";
import type { LLMManager } from "./llm";

interface CoinGeckoDetailResponse extends CoinGeckoResponse {
  image?: {
    large?: string;
    small?: string;
    thumb?: string;
  };
  market_data?: {
    market_cap?: {
      usd?: number;
    };
  };
  market_cap_rank?: number;
  categories?: string[];
  links?: {
    twitter_screen_name?: string;
  };
  community_data?: {
    twitter_followers?: number;
  };
}

interface PriceData {
  currentPrice: number;
  priceChange24h: number;
  priceChange7d: number;
  lastUpdated: Date;
}

interface CoinGeckoResponse {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

export interface CoinGeckoConfig {
  enabled: boolean;
  apiKey?: string;
  updateInterval?: string;
  initialScan?: {
    enabled: boolean; // Whether to perform initial population
    batchSize?: number; // How many coins to process at once
    delay?: number; // Delay between batches in ms
  };
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

export class CoinGeckoManager {
  private updateTask?: cron.ScheduledTask;
  private priceCache: Map<string, PriceData> = new Map();
  private lastCacheClean: Date = new Date();
  private readonly RATE_LIMIT_DELAY = 6000; // 6 seconds between API calls

  constructor(
    private config: CoinGeckoConfig,
    private db: PostgresJsDatabase<typeof dbSchemas>,
    private llmManager: LLMManager
  ) {}

  async start() {
    if (!this.config.enabled) return;

    // Check if we need to do initial population
    if (this.config.initialScan?.enabled) {
      const coinCount = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(dbSchemas.coins)
        .then((result) => Number(result[0].count));

      await this.performInitialScan();
    }

    // Schedule regular updates
    if (this.config.updateInterval) {
      this.updateTask = cron.schedule(this.config.updateInterval, async () => {
        try {
          await this.updateCoinList();
        } catch (err) {
          log.error("Failed to update coin list:", err);
        }
      });
    }
  }

  private async performInitialScan() {
    try {
      log.info("Fetching active coins list from CoinGecko...");

      const response = await fetch(
        "https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true&status=active",
        {
          headers: this.config.apiKey
            ? { "x-cg-pro-api-key": this.config.apiKey }
            : {},
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const activeCoins: CoinGeckoResponse[] = await response.json();
      const existingCoins = await this.db
        .select({
          coingeckoId: dbSchemas.coins.coingeckoId,
        })
        .from(dbSchemas.coins);

      const existingIds = new Set(existingCoins.map((c) => c.coingeckoId));
      const newCoins = activeCoins.filter((coin) => !existingIds.has(coin.id));

      log.info(
        `Found ${activeCoins.length} active coins. ` +
          `${existingIds.size} already in database. ` +
          `Adding ${newCoins.length} new coins...`
      );

      if (newCoins.length === 0) {
        log.info("No new coins to add.");
        return;
      }

      // Process in chunks of 1000 coins
      const chunkSize = 1000;
      let processed = 0;

      for (let i = 0; i < newCoins.length; i += chunkSize) {
        const chunk = newCoins.slice(i, i + chunkSize);

        await this.db
          .insert(dbSchemas.coins)
          .values(
            chunk.map((coin) => ({
              coingeckoId: coin.id,
              symbol: coin.symbol.toLowerCase(),
              name: coin.name,
              platforms: coin.platforms || {},
              metadata: {},
            }))
          )
          .onConflictDoNothing();

        processed += chunk.length;
        log.info(
          `Progress: ${processed}/${newCoins.length} coins inserted (${(
            (processed / newCoins.length) *
            100
          ).toFixed(1)}%)`
        );
      }

      log.info(
        `Successfully added ${newCoins.length} new coins to the database!`
      );
    } catch (error) {
      log.error("Failed to perform initial scan:", error);
      throw error;
    }
  }

  private async fetchCoinDetails(
    coinId: string
  ): Promise<CoinGeckoDetailResponse | null> {
    try {
      const response = await fetch(
        `https://pro-api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`,
        {
          headers: this.config.apiKey
            ? { "x-cg-pro-api-key": this.config.apiKey }
            : {},
        }
      );

      if (!response.ok) {
        log.warn(
          `Failed to fetch details for coin ${coinId}: ${response.status}`
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      log.error(`Error fetching details for coin ${coinId}:`, error);
      return null;
    }
  }

  async stop() {
    this.updateTask?.stop();
    this.priceCache.clear();
  }

  private cleanCache() {
    if (!this.config.cache?.enabled) return;

    const now = new Date();
    const ttl = this.config.cache.ttl;

    for (const [key, data] of this.priceCache.entries()) {
      if (now.getTime() - data.lastUpdated.getTime() > ttl) {
        this.priceCache.delete(key);
      }
    }

    this.lastCacheClean = now;
  }

  async findCoinByTag(tag: string): Promise<Coin | null> {
    const cleanTag = tag.toLowerCase().replace(/[$@]/g, "");

    // First try direct database query
    const [directMatch] = await this.db
      .select()
      .from(dbSchemas.coins)
      .where(
        or(
          eq(dbSchemas.coins.symbol, cleanTag),
          eq(dbSchemas.coins.name, cleanTag.toLowerCase())
        )
      )
      .limit(1);

    if (directMatch) return directMatch;

    // If no direct match, use LLM to find best match
    const recentCoins = await this.db
      .select()
      .from(dbSchemas.coins)
      .orderBy(dbSchemas.coins.lastChecked)
      .limit(10);

    const completion = await this.llmManager.findToken(tag, recentCoins);
    const suggestedId = completion?.trim().toLowerCase();

    if (suggestedId === "none" || !suggestedId) return null;

    const [matchedCoin] = await this.db
      .select()
      .from(dbSchemas.coins)
      .where(eq(dbSchemas.coins.coingeckoId, suggestedId))
      .limit(1);

    return matchedCoin || null;
  }

  async getPriceData(coinId: string): Promise<PriceData | null> {
    // Check cache first
    if (
      this.config.cache?.enabled &&
      this.priceCache.has(coinId) &&
      Date.now() - this.priceCache.get(coinId)!.lastUpdated.getTime() <
        this.config.cache.ttl
    ) {
      return this.priceCache.get(coinId)!;
    }

    try {
      const response = await fetch(
        `https://pro-api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`,
        {
          headers: this.config.apiKey
            ? { "x-cg-pro-api-key": this.config.apiKey }
            : {},
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const prices = data.prices;

      // Calculate price changes
      const currentPrice = prices[prices.length - 1][1];
      const dayAgoPrice = prices[prices.length - 2][1];
      const weekAgoPrice = prices[0][1];

      const priceChange24h = ((currentPrice - dayAgoPrice) / dayAgoPrice) * 100;
      const priceChange7d =
        ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;

      const priceData: PriceData = {
        currentPrice: Math.round(currentPrice * 100) / 100,
        priceChange24h: Math.round(priceChange24h * 100) / 100,
        priceChange7d: Math.round(priceChange7d * 100) / 100,
        lastUpdated: new Date(),
      };

      // Update database
      await this.updateCoinPrice(coinId, priceData);

      // Update cache
      if (this.config.cache?.enabled) {
        this.priceCache.set(coinId, priceData);
      }

      return priceData;
    } catch (error) {
      log.error("Error fetching price data:", error);
      return null;
    }
  }

  async getHistoricalPrices(
    coinId: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<CoinPriceHistory[]> {
    const [coin] = await this.db
      .select()
      .from(dbSchemas.coins)
      .where(eq(dbSchemas.coins.coingeckoId, coinId))
      .limit(1);

    if (!coin) return [];

    return this.db
      .select()
      .from(dbSchemas.coinPriceHistory)
      .where(
        and(
          eq(dbSchemas.coinPriceHistory.coinId, coin.id),
          gte(dbSchemas.coinPriceHistory.timestamp, startDate),
          gte(
            dbSchemas.coinPriceHistory.timestamp,
            sql`${startDate}::timestamp`
          ),
          sql`${endDate}::timestamp >= ${dbSchemas.coinPriceHistory.timestamp}`
        )
      )
      .orderBy(dbSchemas.coinPriceHistory.timestamp);
  }

  private async updateCoinList() {
    try {
      const response = await fetch(
        "https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true&status=active",
        {
          headers: this.config.apiKey
            ? { "x-cg-pro-api-key": this.config.apiKey }
            : {},
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const coins: CoinGeckoResponse[] = await response.json();

      // Process coins in batches to respect rate limits
      const BATCH_SIZE = 10;
      for (let i = 0; i < coins.length; i += BATCH_SIZE) {
        const batch = coins.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (coin) => {
            // Fetch detailed info including metadata
            const details = await this.fetchCoinDetails(coin.id);

            const metadata = {
              image: details?.image?.large || undefined,
              marketCap: details?.market_data?.market_cap?.usd || undefined,
              rank: details?.market_cap_rank || undefined,
              tags: details?.categories || undefined,
            };

            await this.db
              .insert(dbSchemas.coins)
              .values({
                coingeckoId: coin.id,
                symbol: coin.symbol.toLowerCase(),
                name: coin.name,
                platforms: coin.platforms || {},
                metadata,
              })
              .onConflictDoUpdate({
                target: dbSchemas.coins.coingeckoId,
                set: {
                  symbol: coin.symbol.toLowerCase(),
                  name: coin.name,
                  platforms: coin.platforms || {},
                  metadata,
                  lastChecked: new Date(),
                },
              });
          })
        );

        // Respect rate limit
        await new Promise((resolve) =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );

        if ((i + BATCH_SIZE) % 100 === 0) {
          log.info(`Processed ${i + BATCH_SIZE} coins...`);
        }
      }

      log.info(`Updated CoinGecko coin list: ${coins.length} coins`);
    } catch (error) {
      log.error("Failed to update CoinGecko coin list:", error);
      throw error;
    }
  }

  public async updateCoinDetails(coinId: string) {
    // loop through all coins and update details
    log.warn(`Updating details for coin ${coinId}...`);
    const details = await this.fetchCoinDetails(coinId);
    if (!details) return;
    let twitterHandle = details.links?.twitter_screen_name;
    log.warn(
      `Fetched details for coin ${coinId}:`,
      details.links?.twitter_screen_name
    );
    if (!twitterHandle) twitterHandle = "n/a";
    log.warn(`Updating twitter handle for coin ${coinId}: ${twitterHandle}`);
    await this.db
      .update(dbSchemas.coins)
      .set({
        twitterHandle,
      })
      .where(eq(dbSchemas.coins.coingeckoId, coinId))
      .returning();
  }

  async updateAllCoinDetails() {
    try {
      // Get all coins from the database
      const coins = await this.db
        .select()
        .from(dbSchemas.coins)
        .where(isNull(dbSchemas.coins.twitterHandle));

      log.info(`Starting update for ${coins.length} coins...`);

      // Use the same batch size as updateCoinList
      const BATCH_SIZE = this.config.initialScan?.batchSize || 10;
      for (let i = 0; i < coins.length; i += BATCH_SIZE) {
        const batch = coins.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (coin) => {
            try {
              await this.updateCoinDetails(coin.coingeckoId);
            } catch (error) {
              log.error(
                `Failed to update details for ${coin.coingeckoId}:`,
                error
              );
            }
          })
        );

        // Use the class's rate limit delay
        await new Promise((resolve) =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );

        if ((i + BATCH_SIZE) % 100 === 0) {
          log.info(`Processed ${i + BATCH_SIZE}/${coins.length} coins...`);
        }
      }

      log.info("Finished updating all coin details");
    } catch (error) {
      log.error("Failed to update all coin details:", error);
      throw error;
    }
  }

  private async updateCoinPrice(coingeckoId: string, priceData: PriceData) {
    // Update main coin record
    await this.db
      .update(dbSchemas.coins)
      .set({
        currentPrice: priceData.currentPrice.toString(),
        priceChange24h: priceData.priceChange24h.toString(),
        priceChange7d: priceData.priceChange7d.toString(),
        lastUpdated: priceData.lastUpdated,
      })
      .where(eq(dbSchemas.coins.coingeckoId, coingeckoId));

    // Add historical price record
    const [coin] = await this.db
      .select()
      .from(dbSchemas.coins)
      .where(eq(dbSchemas.coins.coingeckoId, coingeckoId))
      .limit(1);

    if (coin) {
      await this.db.insert(dbSchemas.coinPriceHistory).values({
        coinId: coin.id,
        price: priceData.currentPrice.toString(),
        timestamp: priceData.lastUpdated,
        source: "coingecko",
        metadata: {
          additionalData: {
            priceChange24h: priceData.priceChange24h,
            priceChange7d: priceData.priceChange7d,
          },
        },
      });
    }
  }

  async updateAllRanks() {
    try {
      // Get all coins from the database
      const coins = await this.db
        .select()
        .from(dbSchemas.coins)
        .orderBy(dbSchemas.coins.lastChecked);

      log.info(`Starting rank update for ${coins.length} coins...`);

      // Process in batches to respect rate limits
      const BATCH_SIZE = this.config.initialScan?.batchSize || 10;
      for (let i = 0; i < coins.length; i += BATCH_SIZE) {
        const batch = coins.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (coin) => {
            try {
              const details = await this.fetchCoinDetails(coin.coingeckoId);

              if (details?.market_cap_rank !== undefined) {
                await this.db
                  .update(dbSchemas.coins)
                  .set({
                    rank: details.market_cap_rank || 0,
                    lastChecked: new Date(),
                  })
                  .where(eq(dbSchemas.coins.coingeckoId, coin.coingeckoId));
              }
            } catch (error) {
              log.error(
                `Failed to update rank for ${coin.coingeckoId}:`,
                error
              );
            }
          })
        );

        // Log progress every 100 coins
        if ((i + BATCH_SIZE) % 100 === 0) {
          log.info(`Processed ${i + BATCH_SIZE}/${coins.length} coins...`);
        }

        // Respect rate limit
        await new Promise((resolve) =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
      }

      log.info("Finished updating all coin ranks");
    } catch (error) {
      log.error("Failed to update coin ranks:", error);
      throw error;
    }
  }
}

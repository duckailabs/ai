import { db, dbSchemas } from "@/db";
import { and, eq, ilike, or } from "drizzle-orm";

const priorityChains = [
  "ethereum",
  "arbitrum-one",
  "base",
  "optimism",
  "blast",
  "sui",
  "avalanche",
  "polygon",
  "scroll",
  "aptos",
  "sui",
];

export async function getToken(twitterHandle: string) {
  // First, try to find an exact match with coingeckoId
  const coingeckoIdMatchQuery = await db
    .select()
    .from(dbSchemas.coins)
    .where(and(eq(dbSchemas.coins.twitterHandle, twitterHandle)));

  if (coingeckoIdMatchQuery.length === 1) {
    return coingeckoIdMatchQuery;
  }

  // If no single twitterHandle match, try exact matches on symbol and name
  const exactMatchQuery = db
    .select()
    .from(dbSchemas.coins)
    .where(
      and(
        or(
          eq(dbSchemas.coins.symbol, twitterHandle),
          eq(dbSchemas.coins.name, twitterHandle)
        )
      )
    );

  const exactMatches = await exactMatchQuery;

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // If no exact matches, fall back to partial matches
  const partialMatchQuery = db
    .select()
    .from(dbSchemas.coins)
    .where(
      and(
        or(
          ilike(dbSchemas.coins.coingeckoId, `%${twitterHandle}%`),
          ilike(dbSchemas.coins.symbol, `%${twitterHandle}%`),
          ilike(dbSchemas.coins.name, `%${twitterHandle}%`)
        )
      )
    );

  const partialMatches = await partialMatchQuery;

  if (partialMatches.length === 0) {
    return null;
  }

  return partialMatches;
}

interface CryptoMetrics {
  currentPrice: number;
  priceChanges: {
    day: number;
    threeDays: number;
    sevenDays: number;
  };
  volumeChanges: {
    day: number;
    threeDays: number;
    sevenDays: number;
  };
  marketCap: number;
}

export async function getTokenMetrics(
  coinId: string
): Promise<CryptoMetrics | null> {
  try {
    // Get current price, market cap, and 24h data
    const currentResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
    );

    // Get historical data for 7 days
    const historicalResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`
    );

    if (!currentResponse.ok || !historicalResponse.ok) {
      return null;
    }

    const currentData = await currentResponse.json();
    const historicalData = await historicalResponse.json();

    // Extract current metrics
    const current = currentData[coinId];
    const prices = historicalData.prices;
    const volumes = historicalData.total_volumes;

    // Calculate price changes
    const currentPrice = current.usd;
    const threeDayPrice = prices[prices.length - 4][1];
    const sevenDayPrice = prices[0][1];

    // Get latest daily volume from historical data instead of 24h volume
    const currentVolume = volumes[volumes.length - 1][1];
    const previousDayVolume = volumes[volumes.length - 2][1];
    const threeDayVolume = volumes[volumes.length - 4][1];
    const sevenDayVolume = volumes[0][1];

    return {
      currentPrice,
      priceChanges: {
        day: current.usd_24h_change,
        threeDays: ((currentPrice - threeDayPrice) / threeDayPrice) * 100,
        sevenDays: ((currentPrice - sevenDayPrice) / sevenDayPrice) * 100,
      },
      volumeChanges: {
        day: ((currentVolume - previousDayVolume) / previousDayVolume) * 100,
        threeDays: ((currentVolume - threeDayVolume) / threeDayVolume) * 100,
        sevenDays: ((currentVolume - sevenDayVolume) / sevenDayVolume) * 100,
      },
      marketCap: current.usd_market_cap,
    };
  } catch (error) {
    console.error("Error fetching crypto metrics:", error);
    throw error;
  }
}

export async function fetchBTCPriceData(): Promise<{
  priceChange: number;
  currentPrice: number;
}> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily&precision=0",
      {
        headers: {
          "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "",
        },
      }
    );
    const data = await response.json();

    // Get prices array and calculate the price change
    const prices = data.prices;
    const startPrice = prices[0][1];
    const currentPrice = prices[prices.length - 1][1];
    const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

    return {
      priceChange: Math.round(priceChange),
      currentPrice: Math.round(currentPrice),
    };
  } catch (error) {
    console.error("Error fetching BTC price:", error);
    // Return neutral sentiment if API fails
    return {
      priceChange: 0,
      currentPrice: 0,
    };
  }
}

export const btcPriceToolSource = `export async function fetchBTCPriceData(): Promise<{
  priceChange: number;
  currentPrice: number;
}> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily&precision=0",
      {
        headers: {
          "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "",
        },
      }
    );
    const data = await response.json();

    // Get prices array and calculate the price change
    const prices = data.prices;
    const startPrice = prices[0][1];
    const currentPrice = prices[prices.length - 1][1];
    const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

    return {
      priceChange: Math.round(priceChange),
      currentPrice: Math.round(currentPrice),
    };
  } catch (error) {
    console.error("Error fetching BTC price:", error);
    // Return neutral sentiment if API fails
    return {
      priceChange: 0,
      currentPrice: 0,
    };
  }
}
`;

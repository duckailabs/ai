export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

export interface Tool {
  name: string;
  execute: (params?: any) => Promise<ToolResult>;
}

const btcPriceTool: Tool = {
  name: "btc-price",
  async execute(): Promise<ToolResult> {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily&precision=0",
        {
          headers: {
            "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const prices = data.prices;
      const startPrice = prices[0][1];
      const currentPrice = prices[prices.length - 1][1];
      const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

      return {
        success: true,
        data: {
          priceChange: Math.round(priceChange * 100) / 100,
          currentPrice: Math.round(currentPrice),
          currency: "USD",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("BTC Price Tool Error:", error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Failed to fetch BTC price",
      };
    }
  },
};

export default btcPriceTool;

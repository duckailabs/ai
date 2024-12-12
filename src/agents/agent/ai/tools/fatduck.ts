import axios from "axios";

interface MarketCapMoversData {
  categories: {
    category: {
      id: string;
      name: string;
      slug: string;
    };
    movements: {
      id: string;
      scanId: string;
      categoryId: string;
      symbol: string;
      name: string;
      metrics: {
        marketCap: {
          current: number;
          change24h: number;
        };
        price: {
          current: number;
          change24h: number;
        };
      };
      score: string;
      metadata?: {
        twitterHandle?: string;
      };
      timestamp: string;
    }[];
    metadata: {
      movementCount: number;
      averageScore: number;
      lastUpdated: string;
    };
  }[];
}

interface CategoryMovementsData {
  categories: {
    category: {
      id: string;
      name: string;
      slug: string;
    };
    movements: {
      symbol: string;
      name: string;
      metadata?: {
        twitterHandle?: string;
      };
      metrics: {
        price: {
          current: number;
          change1h: number;
        };
      };
      score: string;
    }[];
    metadata: {
      movementCount: number;
      averageScore: number;
      timestamp: string;
    };
  }[];
  scan: {
    id: string;
    timestamp: string;
    metadata: {
      categoriesScanned: number;
      coinsScanned: number;
      significantMovements: number;
    };
  };
}

export interface FatduckConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

interface HealthCheckData {
  status: string;
}

export interface MarketUpdateData {
  timestamp: string;
  interval: string;
  marketAnalysis: {
    summary: string;
    sentiment: string;
    keyTopics: string[];
    marketImpact: string;
    mentionedCoins: string[];
    metrics: any[];
  }[];
}

const config = {
  baseUrl: process.env.FATDUCK_API_URL!,
  apiKey: process.env.FATDUCK_API_KEY!,
};

if (!config.baseUrl || !config.apiKey) {
  throw new Error("Fatduck API URL and API key are required");
}

const createClient = () => {
  return axios.create({
    baseURL: config.baseUrl.replace(/\/$/, ""),
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey && { "X-Fatduckai-Key": config.apiKey }),
    },
  });
};

export const getMarketUpdate = async (interval: string = "24hr") => {
  const client = createClient();
  const { data: response } = await client.get("/api/marketUpdate", {
    params: { interval },
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
};

export const getTopMarketCapMovers = async (category: string) => {
  const client = createClient();
  const { data: response } = await client.get("/api/topMarketCapMovers", {
    params: { category },
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
};

export const getCategoryMovements = async (categories: string[]) => {
  const client = createClient();
  const { data: response } = await client.get("/api/categorySummary", {
    params: {
      categories: categories.join(","),
    },
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
};

export const getTimelineData = async (
  username: string,
  limit: number = 20,
  excludeRetweets: boolean = true
) => {
  const client = createClient();
  const { data: response } = await client.get("/api/timeline", {
    params: { username, limit, excludeRetweets },
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
};

export const healthCheck = async () => {
  const client = createClient();
  try {
    const { data: response } = await client.get("/health");

    if (!response.success) {
      throw new Error(response.error.message);
    }

    console.info("Fatduck API is healthy");
    return response.data;
  } catch (error) {
    console.error("Fatduck API health check failed:", error);
    throw error;
  }
};

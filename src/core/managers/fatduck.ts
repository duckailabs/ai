import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { log } from "../utils/logger";

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

export class FatduckManager {
  private client: AxiosInstance;

  constructor(config: FatduckConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ""),
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey && { "X-Fatduckai-Key": config.apiKey }),
      },
    });

    this.healthCheck().catch((err) => {
      log.error("Health check failed:", err.message);
    });
  }

  // Specific endpoint methods
  async getMarketUpdate(interval?: string): Promise<MarketUpdateData> {
    const { data: response } = await this.client.get<
      ApiResponse<MarketUpdateData>
    >("/api/marketUpdate", {
      params: { interval: interval || "24hr" },
    });

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async getTopMarketCapMovers(category: string): Promise<MarketCapMoversData> {
    const { data: response } = await this.client.get<
      ApiResponse<MarketCapMoversData>
    >("/api/topMarketCapMovers", {
      params: { category },
    });

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async getCategoryMovements(
    categories: string[]
  ): Promise<CategoryMovementsData> {
    const { data: response } = await this.client.get<
      ApiResponse<CategoryMovementsData>
    >("/api/categorySummary", {
      params: {
        categories: categories.join(","),
      },
    });

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async healthCheck(): Promise<HealthCheckData> {
    try {
      const { data: response } = await this.client.get<
        ApiResponse<HealthCheckData>
      >("/health");

      if (!response.success) {
        throw new Error(response.error.message);
      }

      log.info("Fatduck API is healthy");
      return response.data;
    } catch (error) {
      log.error("Fatduck API health check failed:", error);
      throw error;
    }
  }

  // Generic request methods
  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const { data: response } = await this.client.get<ApiResponse<T>>(endpoint, {
      ...config,
      params,
    });

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async post<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const { data: response } = await this.client.post<ApiResponse<T>>(
      endpoint,
      data,
      config
    );

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async put<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const { data: response } = await this.client.put<ApiResponse<T>>(
      endpoint,
      data,
      config
    );

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const { data: response } = await this.client.delete<ApiResponse<T>>(
      endpoint,
      config
    );

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }
}

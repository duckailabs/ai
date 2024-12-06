import type { FatduckManager } from "../managers/fatduck";
import { log } from "../utils/logger";

export type ContextType = "MARKET_NEWS" | "PRICE_DATA" | "VOLUME_DATA";

export class ContextResolver {
  constructor(private fatduckManager: FatduckManager) {}

  async getContext(types: ContextType[]): Promise<Record<ContextType, any>> {
    const context: Record<ContextType, any> = {
      MARKET_NEWS: null,
      PRICE_DATA: null,
      VOLUME_DATA: null,
    };

    for (const type of types) {
      try {
        context[type] = await this.fetchContext(type);
      } catch (error) {
        log.error(`Failed to fetch context for ${type}`, { error });
        context[type] = null;
      }
    }

    return context;
  }

  private async fetchContext(type: ContextType) {
    switch (type) {
      case "MARKET_NEWS":
        return await this.fatduckManager.getMarketUpdate();
      default:
        throw new Error(`Unknown context type: ${type}`);
    }
  }
}

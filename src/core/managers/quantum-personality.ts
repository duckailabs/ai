import type { Character } from "@/db/schema/schema";
import { type QuantumState } from "@/db/schema/schema";
import type { QuantumStateManager } from "./quantum";

export interface QuantumPersonalitySettings {
  temperature: number;
  personalityTraits: string[];
  styleModifiers: {
    tone: string[];
    guidelines: string[];
  };
}

export class QuantumPersonalityMapper {
  private character: Character;
  private quantumStateManager: QuantumStateManager;

  constructor(quantumStateManager: QuantumStateManager, character: Character) {
    this.quantumStateManager = quantumStateManager;
    this.character = character;
  }

  async mapQuantumToPersonality(): Promise<QuantumPersonalitySettings> {
    const quantumState = await this.quantumStateManager.getLatestState();
    if (!quantumState) throw new Error("No quantum state found");

    // Add debug logging

    // Map mood to temperature with wider range (0.6 to 0.8)
    const temperature = this.calculateTemperature(quantumState.moodValue);

    // Map creativity to personality traits and style
    const creativityLevel = this.determineCreativityLevel(
      quantumState.creativityValue
    );

    // Get personality configuration based on creativity level
    const personalityConfig = this.getPersonalityConfig(
      creativityLevel,
      quantumState
    );

    // Add debug logging for final configuration

    return {
      temperature,
      ...personalityConfig,
    };
  }

  private calculateTemperature(moodValue: number): number {
    // Default to a wider range if not specified in character config
    const range = this.character.quantumPersonality?.temperatureRange ?? {
      min: 0.5, // Lower minimum (was 0.6)
      max: 0.9, // Higher maximum (was 0.8)
    };

    // Add randomization factor for more variation
    const baseTemp = range.min + (moodValue / 255) * (range.max - range.min);

    // Add small random variation (±0.05) to prevent repetitive values
    const variation = Math.random() * 0.1 - 0.05;
    const finalTemp = Math.max(
      range.min,
      Math.min(range.max, baseTemp + variation)
    );

    // Log the temperature calculation process

    return Number(finalTemp.toFixed(3)); // Round to 3 decimal places
  }

  private determineCreativityLevel(
    creativityValue: number
  ): "low" | "medium" | "high" {
    const thresholds = this.character.quantumPersonality
      ?.creativityThresholds ?? {
      low: 100,
      medium: 180,
    };

    if (creativityValue < thresholds.low) return "low";
    if (creativityValue < thresholds.medium) return "medium";
    return "high";
  }

  private getPersonalityConfig(
    creativityLevel: "low" | "medium" | "high",
    quantumState: QuantumState
  ): Omit<QuantumPersonalitySettings, "temperature"> {
    // Use character-specific settings if available, otherwise fall back to defaults
    const characterSettings =
      this.character.quantumPersonality?.creativityLevels[creativityLevel];
    if (characterSettings) {
      return characterSettings;
    }

    // Fall back to default settings if character-specific ones aren't available
    switch (creativityLevel) {
      case "low":
        return {
          personalityTraits: ["witty", "sarcastic", "curt"],
          styleModifiers: {
            tone: ["precise", "analytical", "direct"],
            guidelines: [
              "Keep responses concise and pointed",
              "Focus on technical accuracy",
              "Maintain sarcastic undertone",
            ],
          },
        };
      case "medium":
        return {
          personalityTraits: ["edgy", "confident", "witty"],
          styleModifiers: {
            tone: ["balanced", "conversational", "witty"],
            guidelines: [
              "Mix technical and casual language",
              "Use moderate market references",
              "Balance humor and information",
            ],
          },
        };
      case "high":
        return {
          personalityTraits: ["edgy", "arrogant", "original"],
          styleModifiers: {
            tone: ["creative", "provocative", "unconventional"],
            guidelines: [
              "Push creative boundaries",
              "Challenge conventional wisdom",
              "Emphasize unique perspectives",
              "Break fourth wall occasionally",
            ],
          },
        };
    }
  }
}

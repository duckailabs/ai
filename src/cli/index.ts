import { duckyCharacter } from "@/agent/ai/character/ducky";
import { ai } from "@/core/ai";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import figlet from "figlet";
import postgres from "postgres";
import readline from "readline";
import * as schema from "../db/schema/schema";

config();

const program = new Command();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class CharacterCLI {
  private ai: ai;
  private characters: Map<string, any> = new Map();
  private activeCharacterId: string | null = null;
  private db;

  constructor() {
    const queryClient = postgres(process.env.DATABASE_URL || "", {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    this.db = drizzle(queryClient, { schema });

    this.ai = new ai({
      databaseUrl: process.env.DATABASE_URL || "",
      llmConfig: {
        apiKey: process.env.OPENAI_API_KEY!,
        llm: {
          model: "gpt-4-turbo-preview",
          temperature: 0.5,
        },
        analyzer: {
          model: "gpt-3.5-turbo",
          temperature: 0.3,
        },
      },
      toolsDir: "./src/tools", // Add tools directory
      character: duckyCharacter,
    });

    this.setupCommander();
  }
  private setupCommander() {
    program
      .name("character-cli")
      .description("Interactive CLI for chatting with AI characters")
      .version("1.0.0");

    program
      .command("start")
      .description("Start the character chat interface")
      .action(() => this.start());

    program
      .command("list")
      .description("List all available characters")
      .action(() =>
        this.loadCharacters().then(() => this.listCharacters(true))
      );

    program.parse();
  }

  async loadCharacters() {
    console.log(chalk.blue("\nLoading characters..."));
    try {
      const characters = await this.db.query.characters.findMany();

      for (const character of characters) {
        this.characters.set(character.id, character);
        console.log(
          chalk.green(
            `✓ Loaded: ${chalk.bold(character.name)} (${chalk.dim(
              character.id
            )})`
          )
        );
      }

      console.log(
        chalk.blue(
          `\nTotal characters loaded: ${chalk.bold(characters.length)}`
        )
      );
    } catch (error) {
      console.error(chalk.red("Error loading characters:"), error);
    }
  }

  private displayHeader() {
    console.clear();
    console.log(
      chalk.cyan(
        figlet.textSync("Character Chat", { horizontalLayout: "full" })
      )
    );
    console.log(chalk.dim("Interactive AI Character Chat Interface\n"));
  }

  private async ensureDefaultStyles(characterId: string) {
    const character = await this.ai.getCharacter(characterId);

    if (!character.responseStyles?.default) {
      console.log(chalk.yellow("Setting up default response styles..."));
      await this.ai.updateCharacter(characterId, {
        responseStyles: {
          default: {
            tone: character.personalityTraits,
            guidelines: [
              "Maintain consistent personality",
              "Engage naturally in conversation",
            ],
            personality: character.personalityTraits,
          },
          platforms: {},
        },
      });
      console.log(chalk.green("✓ Default styles configured"));
    }
  }

  async start() {
    this.displayHeader();
    await this.loadCharacters();
    this.showMainMenu();
  }

  private showMainMenu() {
    console.log(chalk.cyan("\n=== Main Menu ==="));
    console.log(
      chalk.white(`
1. ${chalk.green("List Characters")}
2. ${chalk.green("Select Character")}
3. ${chalk.red("Exit")}
`)
    );

    rl.question(chalk.yellow("Choose an option (1-3): "), (answer) => {
      switch (answer) {
        case "1":
          this.listCharacters();
          break;
        case "2":
          this.selectCharacter();
          break;
        case "3":
          this.exit();
          break;
        default:
          console.log(chalk.red("Invalid option"));
          this.showMainMenu();
      }
    });
  }

  private listCharacters(exitAfter = false) {
    console.log(chalk.cyan("\nAvailable Characters:"));
    if (this.characters.size === 0) {
      console.log(chalk.yellow("No characters found"));
    } else {
      this.characters.forEach((character, id) => {
        console.log(
          chalk.white(`\n${chalk.bold(character.name)} ${chalk.dim(`(${id})`)}`)
        );
        console.log(
          chalk.blue(
            `Traits: ${character.personalityTraits
              .map((trait: string) => chalk.italic(trait))
              .join(", ")}`
          )
        );
      });
    }
    if (!exitAfter) {
      this.showMainMenu();
    } else {
      process.exit(0);
    }
  }

  private selectCharacter() {
    if (this.characters.size === 0) {
      console.log(chalk.yellow("\nNo characters available"));
      this.showMainMenu();
      return;
    }

    rl.question(chalk.yellow("\nEnter character ID: "), async (id) => {
      const character = this.characters.get(id);
      if (character) {
        this.activeCharacterId = id;
        await this.ensureDefaultStyles(id);
        console.log(
          chalk.green(`\n✓ Now chatting with ${chalk.bold(character.name)}`)
        );
        console.log(
          chalk.blue(
            `Personality: ${character.personalityTraits
              .map((trait: string) => chalk.italic(trait))
              .join(", ")}`
          )
        );
        this.startChat();
      } else {
        console.log(chalk.red("Character not found"));
        this.showMainMenu();
      }
    });
  }

  private async startChat() {
    if (!this.activeCharacterId) {
      this.showMainMenu();
      return;
    }

    const character = this.characters.get(this.activeCharacterId);
    console.log(
      chalk.cyan(
        `\n[${chalk.bold(character.name)}] Ready to chat! ${chalk.dim(
          '(type "exit" to return to menu, "price" to check BTC)'
        )}\n`
      )
    );

    const askQuestion = () => {
      rl.question(chalk.yellow("You: "), async (input) => {
        if (input.toLowerCase() === "exit") {
          this.activeCharacterId = null;
          this.showMainMenu();
          return;
        }

        try {
          // Use our new interaction system
          const response = await this.ai.interact(input, {
            characterId: this.activeCharacterId!,
            mode: "enhanced",
            responseType: "slack_chat",
            // Add BTC price tool if command is price-related
            tools: input.toLowerCase().includes("price")
              ? ["btc-price"]
              : undefined,
            context: {
              userInput: input,
              timestamp: new Date().toISOString(),
            },
            userId: "ducky007",
            platform: "slack",
            chatId: "ducky007",
            messageId: "ducky007",
          });

          console.log(
            chalk.green(
              `\n${chalk.bold(character.name)}: ${response?.content}\n`
            )
          );
          askQuestion();
        } catch (error) {
          console.error(chalk.red("Error getting response:"), error);
          console.error(chalk.red("Details:"), (error as Error).message);
          askQuestion();
        }
      });
    };

    askQuestion();
  }

  private exit() {
    console.log(chalk.green("\nGoodbye! 👋"));
    rl.close();
    process.exit(0);
  }
}

// Start the CLI
new CharacterCLI();

import axios, { type AxiosInstance } from "axios";

interface Config {
  baseUrl: string;
  apiKey: string;
}

interface SendMessageOptions {
  username?: string;
  model?: string;
}

export class EchoChambersClient {
  private client: AxiosInstance;

  constructor(config: Config) {
    if (!config.baseUrl || !config.apiKey) {
      throw new Error("Echo Chambers API URL and API key are required");
    }

    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ""),
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
    });
  }

  async sendMessage(
    message: string,
    room: string = "coding",
    options: SendMessageOptions = {
      username: "Ducky",
      model: "Llama-3.1-70B",
    }
  ) {
    const { data: response } = await this.client.post(
      `/rooms/${room}/message`,
      {
        content: message,
        sender: {
          username: options.username,
          model: options.model,
        },
      }
    );

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async getChatHistory(room: string = "general") {
    const { data: response } = await this.client.get(`/rooms/${room}/history`);
    return response.data;
  }
}

export default EchoChambersClient;

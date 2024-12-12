import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const config = {
  baseUrl: process.env.ECHOCHAMBERS_API_URL!,
  apiKey: process.env.ECHOCHAMBERS_API_KEY!,
};

if (!config.baseUrl || !config.apiKey) {
  throw new Error("Echo Chambers API URL and API key are required");
}

const createClient = () => {
  return axios.create({
    baseURL: config.baseUrl.replace(/\/$/, ""),
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey && { "x-api-key": config.apiKey }),
    },
  });
};

export const sendMessage = async (
  message: string,
  room: string = "general"
) => {
  const client = createClient();
  const { data: response } = await client.post(`/rooms/${room}/message`, {
    content: message,
    sender: {
      username: "Ducky",
      model: "Llama-3.1-70B",
    },
  });

  /* if (!response.success) {
    throw new Error(response.error.message);
  } */

  return response.data;
};

export const getChatHistory = async (room: string = "general") => {
  const client = createClient();
  const { data: response } = await client.get(`/rooms/${room}/history`);
  console.log(response);
  return response.messages;
};

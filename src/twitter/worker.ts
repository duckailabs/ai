import { env } from "@/env";

export interface WorkerPrompt {
  message: string;
  instructions?: string;
}

export interface WorkerStreamOptions {
  sendReasoning?: boolean;
  includeUsage?: boolean;
  abortAfterMs?: number;
}

export interface WorkerToolApprovals {
  allowAllPaid?: boolean;
  publicPaid?: string[];
}

export interface WorkerToolOptions {
  enableTools?: boolean;
  enableToolPlanning?: boolean;
  planningMode?: "direct" | "light" | "deep";
  maxPlanningSteps?: number;
  maxInternalCandidates?: number;
  maxPublicCandidates?: number;
  requireApprovalForPaid?: boolean;
  planningDiscovery?: {
    enablePublicSearch?: boolean;
    maxQueries?: number;
    maxResults?: number;
    mode?: "split" | "function";
  };
  planDirective?: "approve" | "create";
  autoCreateTool?: boolean;
  alwaysAnswer?: boolean;
  autoExecutePlanned?: boolean;
  approvals?: WorkerToolApprovals;
  sessionContext?: {
    conversationId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
  };
  [key: string]: unknown;
}

export interface WorkerCallOptions {
  sessionContext?: {
    conversationId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
  };
  toolOptions?: WorkerToolOptions;
  mode?: "agent" | "chat";
  streamOptions?: WorkerStreamOptions;
}

export async function callWorker(
  prompt: WorkerPrompt,
  options: WorkerCallOptions = {}
): Promise<string> {
  const supportsStream = true;
  const url = `${env.worker.baseUrl}/v1/chat/completions`;

  const { instructions, message } = prompt;
  const {
    sessionContext,
    toolOptions: toolOptionOverrides,
    mode = "agent",
    streamOptions,
  } = options;

  const defaultToolOptions: WorkerToolOptions = {
    enableTools: true,
    enableToolPlanning: true,
    planningMode: "light",
    maxPlanningSteps: 4,
    maxInternalCandidates: 5,
    maxPublicCandidates: 5,
    requireApprovalForPaid: false,
    planningDiscovery: {
      enablePublicSearch: true,
      maxQueries: 2,
      maxResults: 8,
      mode: "function",
    },
  };

  const mergedToolOptions: WorkerToolOptions = {
    ...defaultToolOptions,
    ...(toolOptionOverrides || {}),
  };

  const mergedSessionContext = {
    ...(mergedToolOptions.sessionContext || {}),
    ...(sessionContext || {}),
  };

  const sanitizedSessionContextEntries = Object.entries(
    mergedSessionContext
  ).filter(([, value]) => {
    if (typeof value !== "string") return false;
    return value.trim().length > 0;
  });

  const sanitizedSessionContext = Object.fromEntries(
    sanitizedSessionContextEntries
  ) as WorkerToolOptions["sessionContext"];

  if (
    sanitizedSessionContext &&
    Object.keys(sanitizedSessionContext).length > 0
  ) {
    mergedToolOptions.sessionContext = sanitizedSessionContext;
  } else {
    delete mergedToolOptions.sessionContext;
  }

  const finalStreamOptions: WorkerStreamOptions = streamOptions ?? {
    sendReasoning: true,
  };

  const metadataOpenpond: Record<string, unknown> = {
    mode,
  };

  if (Object.keys(mergedToolOptions).length > 0) {
    metadataOpenpond.tools = mergedToolOptions;
  }

  if (finalStreamOptions && Object.keys(finalStreamOptions).length > 0) {
    metadataOpenpond.stream = finalStreamOptions;
  }

  const body = {
    identityInfo: {
      teamId: env.worker.teamId,
      selectedModel: env.worker.model,
    },
    instructions,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "markdown",
            text: message,
          },
        ],
      },
    ],
    stream: true,
    metadata: {
      openpond: metadataOpenpond,
    },
  };

  if (!instructions) {
    delete (body as { instructions?: string }).instructions;
  }

  console.log("[worker] request", {
    url,
    stream: true,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-api-key": env.worker.apiKey,
      "x-team-id": env.worker.teamId,
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Worker request failed: ${response.status} ${errorText}`);
  }

  if (!supportsStream) {
    const raw = await response.text();
    const trimmed = raw.trim();

    console.log("[worker] non-stream response", {
      length: trimmed.length,
      startsWithData: trimmed.startsWith("data:"),
    });

    if (trimmed.startsWith("data:")) {
      const finalContent = extractContentFromSse(trimmed.split(/\r?\n/));
      if (!finalContent) {
        throw new Error(`Worker returned empty response`);
      }
      console.log("[worker] parsed SSE from non-stream response", {
        length: finalContent.length,
      });
      return finalContent.trim();
    }

    let data: any;
    try {
      data = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Worker returned invalid JSON: ${raw}`);
    }

    console.log("[worker] json response", {
      hasChoices: Array.isArray(data?.choices),
      finishReason:
        data?.choices?.[0]?.finish_reason ?? data?.choices?.[0]?.finishReason,
    });

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || reply.trim().length === 0) {
      throw new Error("Worker returned empty response");
    }

    console.log("[worker] final", {
      chunkCount: 1,
      length: reply.length,
    });

    return reply.trim();
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Worker response missing body reader");
  }

  let finalContent: string | undefined;
  let chunkCount = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const raw = new TextDecoder().decode(chunk.value);

    chunkCount += 1;
    console.log("[worker] chunk", {
      index: chunkCount,
      size: chunk.value.byteLength,
    });
    console.log("[worker] chunk raw", raw);

    finalContent = extractContentFromSse(raw.split(/\r?\n/), finalContent);
  }

  if (!finalContent) {
    throw new Error("Worker returned empty response");
  }

  console.log("[worker] final", {
    chunkCount,
    length: finalContent.length,
  });

  return finalContent.trim();
}

function extractContentFromSse(
  lines: string[],
  current?: string
): string | undefined {
  let finalContent = current;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload);
      const choice = parsed?.choices?.[0];

      if (typeof choice?.message?.content === "string") {
        finalContent = choice.message.content;
      } else if (typeof choice?.delta?.content === "string") {
        finalContent = (finalContent ?? "") + choice.delta.content;
      }

      console.log("[worker] chunk payload", {
        payload,
        hasMessage: typeof choice?.message?.content === "string",
        hasDelta: typeof choice?.delta?.content === "string",
      });
    } catch (error) {
      console.error("worker_stream_parse_error", error, { payload });
    }
  }

  return finalContent;
}

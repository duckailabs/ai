import axios, { type AxiosInstance } from "axios";
import { log } from "./logger";

export interface IBMConfig {
  apiToken: string;
  backend?: string;
  timeout?: number;
  maxQueueTime?: number; // Maximum time to wait in queue (ms)
  maxRunTime?: number; // Maximum time to wait for execution (ms)
}

export interface JobResult {
  meas: {
    get_counts: () => Record<string, number>;
  };
  metadata: {
    execution_time: number;
    backend: string;
  };
}

interface JobResponse {
  id: string;
  state: {
    status: "Queued" | "Running" | "Completed" | "Failed";
    reason?: string;
  };
  results?: JobResult[];
}

export class IBMQuantumClient {
  private client: AxiosInstance;
  private readonly config: Required<IBMConfig>;

  constructor(userConfig: IBMConfig) {
    this.config = {
      apiToken: userConfig.apiToken,
      backend: userConfig.backend ?? "ibm_brisbane",
      timeout: userConfig.timeout ?? 30000,
      maxQueueTime: userConfig.maxQueueTime ?? 300000, // 5 minutes default queue wait
      maxRunTime: userConfig.maxRunTime ?? 240000, // 4 minutes default run wait
    };

    this.client = axios.create({
      baseURL: "https://api.quantum-computing.ibm.com/runtime",
      timeout: this.config.timeout,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async submitJob(circuitQASM: string): Promise<JobResult> {
    try {
      log.info(`Submitting circuit to backend: ${this.config.backend}`);
      const validatedCircuit = await this.validateCircuit(circuitQASM);
      //log.info(`Validated circuit: ${validatedCircuit}`);

      const response = await this.client.post("/jobs", {
        program_id: "sampler",
        backend: this.config.backend,
        hub: "ibm-q",
        group: "open",
        project: "main",
        params: {
          pubs: [[validatedCircuit]],
          shots: 1024,
          version: 2,
        },
      });

      const jobId = response.data.id;
      log.info(`Job submitted with ID: ${jobId}`);

      // First wait for job to start executing
      await this.waitForJobStart(jobId);

      // Then wait for completion and get results
      return await this.waitForJobResults(jobId);
    } catch (error: any) {
      if (error.response) {
        log.error("Error response:", {
          status: error.response.status,
          data: error.response.data,
        });
      }

      const errorMessage =
        error.response?.data?.error?.message ||
        error.message ||
        "Unknown error";
      log.error(`Failed to submit job: ${errorMessage}`);
      throw new Error(`Failed to submit job: ${errorMessage}`);
    }
  }

  private async getJobStatus(jobId: string): Promise<JobResponse> {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }

  private async waitForJobStart(jobId: string): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (true) {
      const status = await this.getJobStatus(jobId);

      if (status.state.status === "Running") {
        log.info(`Job ${jobId} is now running`);
        return;
      }

      if (status.state.status === "Failed") {
        throw new Error(`Job ${jobId} failed: ${status.state.reason}`);
      }

      if (Date.now() - startTime > this.config.maxQueueTime) {
        throw new Error(
          `Job ${jobId} exceeded maximum queue time of ${this.config.maxQueueTime}ms`
        );
      }

      if (status.state.status !== "Queued") {
        throw new Error(`Unexpected job status: ${status.state.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  private async waitForJobResults(jobId: string): Promise<JobResult> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (true) {
      const status = await this.getJobStatus(jobId);

      if (status.state.status === "Completed") {
        const response = await this.client.get(`/jobs/${jobId}/results`);

        // Log raw results to see what we're getting
        console.log("Raw quantum results:", response.data);

        const samples = response.data.results[0].data.c.samples;
        if (!samples || !Array.isArray(samples)) {
          throw new Error("No valid samples in job results");
        }

        // Modified conversion to ensure we're processing bits correctly
        const counts: Record<string, number> = samples.reduce(
          (acc: Record<string, number>, curr: string | number) => {
            // Convert the hex string to binary, ensuring proper handling
            const hexValue =
              typeof curr === "string"
                ? curr.replace("0x", "")
                : curr.toString(16);
            const binary = BigInt(`0x${hexValue}`)
              .toString(2)
              .padStart(16, "0");
            acc[binary] = (acc[binary] || 0) + 1;
            return acc;
          },
          {}
        );

        return {
          meas: {
            get_counts: () => counts,
          },
          metadata: {
            execution_time: response.data.metadata?.execution
              ?.execution_spans?.[0]?.[1]?.date
              ? new Date(
                  response.data.metadata.execution.execution_spans[0][1].date
                ).getTime() -
                new Date(
                  response.data.metadata.execution.execution_spans[0][0].date
                ).getTime()
              : 0,
            backend: this.config.backend,
          },
        };
      }

      if (status.state.status === "Failed") {
        throw new Error(`Job ${jobId} failed: ${status.state.reason}`);
      }

      if (Date.now() - startTime > this.config.maxRunTime) {
        throw new Error(
          `Job ${jobId} exceeded maximum execution time of ${this.config.maxRunTime}ms`
        );
      }

      if (status.state.status !== "Running") {
        throw new Error(`Unexpected job status: ${status.state.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      log.info(`Job ${jobId} still running...`);
    }
  }

  // Modified generateCircuitQASM function for more quantum variation
  generateCircuitQASM(numQubits: number = 16): string {
    const lines = ["OPENQASM 2.0;", 'include "qelib1.inc";'];

    // Registers
    lines.push(`qreg q[${numQubits}];`);
    lines.push(`creg c[${numQubits}];`);

    // Create more varied superposition states
    for (let i = 0; i < numQubits; i++) {
      // More extreme rotation angles to create bigger differences
      lines.push(`sx q[${i}];`);
      // Use different rotation patterns for first/second half of qubits
      if (i < numQubits / 2) {
        lines.push(`rz(pi/2) q[${i}];`); // Stronger rotation
      } else {
        lines.push(`rz(pi/8) q[${i}];`); // Weaker rotation
      }
      // Second superposition with different angle
      lines.push(`sx q[${i}];`);
    }

    // Measure
    for (let i = 0; i < numQubits; i++) {
      lines.push(`measure q[${i}] -> c[${i}];`);
    }

    return lines.join("\n");
  }

  // Also update validateCircuit to use a similar fallback circuit
  private async validateCircuit(circuitQASM: string): Promise<string> {
    try {
      return circuitQASM;
    } catch (error) {
      log.warn("Complex circuit failed, falling back to basic measurements");
      const lines = ["OPENQASM 2.0;", 'include "qelib1.inc";'];

      lines.push(`qreg q[16];`);
      lines.push(`creg c[16];`);

      // More varied fallback circuit
      for (let i = 0; i < 16; i++) {
        lines.push(`sx q[${i}];`);
        lines.push(`rz(pi/${2 + (i % 4)}) q[${i}];`);
      }

      // Measure
      for (let i = 0; i < 16; i++) {
        lines.push(`measure q[${i}] -> c[${i}];`);
      }

      return lines.join("\n");
    }
  }
}

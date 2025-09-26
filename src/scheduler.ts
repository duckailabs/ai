import cron from "node-cron";

interface MessageSchedulerConfig {
  message: string;
  cron: string;
  onMessage: (message: string) => Promise<void>;
}

export function startMessageScheduler(config: MessageSchedulerConfig): void {
  cron.schedule(config.cron, () => {
    config.onMessage(config.message).catch((error) => {
      console.error("scheduler_task_error", error);
    });
  });

  console.log(
    `[scheduler] message '${config.message}' scheduled at '${config.cron}'`
  );
}

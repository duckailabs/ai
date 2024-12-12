import chalk from "chalk";

export const log = {
  info: (message: string, data?: any) => {
    console.log(
      chalk.blue("ℹ"),
      chalk.blue(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  sent: (message: string, data?: any) => {
    console.log(
      chalk.green("⚡"),
      chalk.green(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  receiving: (message: string, data?: any) => {
    console.log(
      chalk.yellow("✉️"),
      chalk.yellow(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      chalk.red("✖"),
      chalk.red(message),
      error ? chalk.gray(error.message || JSON.stringify(error)) : ""
    );
  },
  debug: (message: string, data?: any) => {
    console.debug(
      chalk.gray("🐛"),
      chalk.gray(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      chalk.yellow("⚠️"),
      chalk.yellow(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  network: (message: string, data?: any) => {
    console.log(
      chalk.magenta("⚡"),
      chalk.magenta(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  message: (message: string, data?: any) => {
    console.log(
      chalk.cyan("💬"),
      chalk.cyan(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  userLog: (message: string, data?: any) => {
    console.log(
      chalk.magenta("👤"),
      chalk.magenta(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
};

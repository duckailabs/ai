import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const CORE_PKG_PATH = resolve(__dirname, "../packages/core/package.json");

function updateVersion(type: "major" | "minor" | "patch") {
  // Read current version
  const pkg = JSON.parse(readFileSync(CORE_PKG_PATH, "utf-8"));
  const [major, minor, patch] = pkg.version.split(".").map(Number);

  // Calculate new version
  let newVersion: string;
  switch (type) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  // Update package.json
  pkg.version = newVersion;
  writeFileSync(CORE_PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");

  // Create commit and tag
  execSync("git add packages/core/package.json");
  execSync(`git commit -m "chore: release v${newVersion}"`);
  execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

  console.log(`Version updated to ${newVersion}`);
  console.log("Push changes with: git push && git push --tags");
}

// Get version type from command line argument
const type = process.argv[2] as "major" | "minor" | "patch";
if (!["major", "minor", "patch"].includes(type)) {
  console.error("Please specify version type: major, minor, or patch");
  process.exit(1);
}

updateVersion(type);

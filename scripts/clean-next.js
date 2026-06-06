const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

try {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log(`[clean-next] Removed ${nextDir}`);
  } else {
    console.log(`[clean-next] No .next directory to remove at ${nextDir}`);
  }
} catch (error) {
  console.error("[clean-next] Failed to clean .next", error);
  process.exitCode = 1;
}

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectDir = process.cwd();
const nextDir = path.join(process.cwd(), ".next");

function normalizeForMatch(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function listProcesses() {
  try {
    if (process.platform === "win32") {
      const output = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
        ],
        {
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        }
      ).trim();

      if (!output) {
        return [];
      }

      const parsed = JSON.parse(output);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows.map((row) => ({
        pid: Number(row.ProcessId),
        command: row.CommandLine || "",
      }));
    }

    const output = execFileSync("ps", ["-eo", "pid=,args="], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        return match
          ? { pid: Number(match[1]), command: match[2] }
          : { pid: 0, command: line };
      });
  } catch (error) {
    console.warn(
      `[clean-next] Could not inspect running processes; continuing with cleanup. ${error.message}`
    );
    return [];
  }
}

function findActiveNextProcesses() {
  const projectNeedle = normalizeForMatch(projectDir);

  return listProcesses().filter((processInfo) => {
    if (!processInfo.pid || processInfo.pid === process.pid) {
      return false;
    }

    const command = normalizeForMatch(processInfo.command);
    const isCurrentProject = command.includes(projectNeedle);
    const isNextCli = command.includes("/next/dist/bin/next");
    const runsDevOrBuild = /(?:^|\s)(dev|build)(?:\s|$)/.test(command);

    return isCurrentProject && isNextCli && runsDevOrBuild;
  });
}

try {
  const activeNextProcesses = findActiveNextProcesses();
  if (activeNextProcesses.length > 0) {
    console.error(
      "[clean-next] Refusing to remove .next while Next dev/build is running for this project."
    );
    for (const processInfo of activeNextProcesses.slice(0, 5)) {
      console.error(`[clean-next] Active PID ${processInfo.pid}: ${processInfo.command}`);
    }
    process.exit(1);
  }

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

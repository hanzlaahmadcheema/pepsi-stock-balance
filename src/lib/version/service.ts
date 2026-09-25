import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface SystemVersionInfo {
  status: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "OFFLINE" | "UNKNOWN";
  isUpToDate: boolean;
  branch: string;
  local: CommitInfo;
  remote: CommitInfo | null;
  commitsBehind: number;
  lastCheckedAt: string;
  environment: "WINDOWS_DEPOT" | "LINUX" | "CLOUD" | "DEVELOPMENT";
  canUpdate: boolean;
  recentCommits: {
    shortHash: string;
    message: string;
    author: string;
    relativeDate: string;
  }[];
}

const GITHUB_REPO_API = "https://api.github.com/repos/hanzlaahmadcheema/pepsi-stock-balance/commits/main";

// In-memory cache for 30 seconds unless forced
let cachedVersion: { data: SystemVersionInfo; expiresAt: number } | null = null;
let updateInProgress = false;

function detectEnvironment(): "WINDOWS_DEPOT" | "LINUX" | "CLOUD" | "DEVELOPMENT" {
  if (process.env.VERCEL) return "CLOUD";
  if (process.env.NODE_ENV === "development") return "DEVELOPMENT";
  if (process.platform === "win32") return "WINDOWS_DEPOT";
  return "LINUX";
}

function getLocalCommit(): CommitInfo & { branch: string } {
  try {
    const raw = execSync('git log -1 --format="%H|%h|%s|%an|%ad" --date=iso', {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 3000,
    }).trim();

    const [hash, shortHash, message, author, date] = raw.split("|");
    let branch = "main";
    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 2000,
      }).trim();
    } catch {}

    return {
      hash: hash || "unknown",
      shortHash: shortHash || "unknown",
      message: message || "No commit message",
      author: author || "System",
      date: date || new Date().toISOString(),
      branch,
    };
  } catch {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "b6e8608";
    return {
      hash: sha,
      shortHash: sha.slice(0, 7),
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE || "Production deployment build",
      author: "Deployment Pipeline",
      date: new Date().toISOString(),
      branch: process.env.VERCEL_GIT_COMMIT_REF || "main",
    };
  }
}

function getRecentCommits(limit = 6) {
  try {
    const raw = execSync(`git log -n ${limit} --format="%h|%s|%an|%cr"`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 3000,
    }).trim();

    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [shortHash, message, author, relativeDate] = line.split("|");
        return {
          shortHash: shortHash || "",
          message: message || "",
          author: author || "",
          relativeDate: relativeDate || "",
        };
      });
  } catch {
    return [];
  }
}

async function fetchRemoteCommitFromGitHub(): Promise<CommitInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(GITHUB_REPO_API, {
      signal: controller.signal,
      headers: {
        "User-Agent": "pepsi-stock-balance-version-checker",
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 0 },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    return {
      hash: json.sha,
      shortHash: json.sha.slice(0, 7),
      message: json.commit?.message?.split("\n")[0] || "Remote commit",
      author: json.commit?.author?.name || "GitHub Committer",
      date: json.commit?.author?.date || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function fetchRemoteCommitViaGit(): CommitInfo | null {
  try {
    // Try git fetch origin main with a short timeout to refresh tracking refs
    try {
      execSync("git fetch origin main", {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 6000,
        stdio: "ignore",
      });

      const raw = execSync('git log -1 --format="%H|%h|%s|%an|%ad" --date=iso origin/main', {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 3000,
      }).trim();

      const [hash, shortHash, message, author, date] = raw.split("|");
      if (hash) {
        return {
          hash,
          shortHash: shortHash || hash.slice(0, 7),
          message: message || "Remote commit",
          author: author || "Remote",
          date: date || new Date().toISOString(),
        };
      }
    } catch {}

    // Fallback: git ls-remote
    const out = execSync("git ls-remote origin refs/heads/main", {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    const [sha] = out.split(/\s+/);
    if (sha && sha.length >= 7) {
      return {
        hash: sha,
        shortHash: sha.slice(0, 7),
        message: "Latest commit on origin/main",
        author: "GitHub Remote",
        date: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSystemVersionInfo(forceScan = false): Promise<SystemVersionInfo> {
  const now = Date.now();
  if (!forceScan && cachedVersion && cachedVersion.expiresAt > now) {
    return cachedVersion.data;
  }

  const local = getLocalCommit();
  const env = detectEnvironment();
  const recentCommits = getRecentCommits();

  // Try GitHub API first, then git commands
  let remote = await fetchRemoteCommitFromGitHub();
  if (!remote) {
    remote = fetchRemoteCommitViaGit();
  }

  let status: SystemVersionInfo["status"] = "UNKNOWN";
  let isUpToDate = false;
  let commitsBehind = 0;

  if (!remote) {
    status = "OFFLINE";
    isUpToDate = true; // Assume current if unable to reach remote
  } else {
    // Check if hashes match
    if (local.hash.toLowerCase() === remote.hash.toLowerCase()) {
      status = "UP_TO_DATE";
      isUpToDate = true;
      commitsBehind = 0;
    } else {
      status = "UPDATE_AVAILABLE";
      isUpToDate = false;

      // Attempt to count commits behind
      try {
        const countRaw = execSync("git rev-list --count HEAD..origin/main", {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 2000,
        }).trim();
        const count = parseInt(countRaw, 10);
        commitsBehind = isNaN(count) ? 1 : count;
      } catch {
        commitsBehind = 1;
      }
    }
  }

  const result: SystemVersionInfo = {
    status,
    isUpToDate,
    branch: local.branch,
    local: {
      hash: local.hash,
      shortHash: local.shortHash,
      message: local.message,
      author: local.author,
      date: local.date,
    },
    remote,
    commitsBehind,
    lastCheckedAt: new Date().toISOString(),
    environment: env,
    canUpdate: env === "WINDOWS_DEPOT" || env === "LINUX" || env === "DEVELOPMENT",
    recentCommits,
  };

  cachedVersion = {
    data: result,
    expiresAt: now + 30_000, // cache for 30s
  };

  return result;
}

export async function triggerSystemUpdate(): Promise<{
  success: boolean;
  message: string;
  status: "INITIATED" | "ALREADY_IN_PROGRESS" | "ERROR";
}> {
  if (updateInProgress) {
    return {
      success: false,
      message: "An update is already in progress on this machine. Please wait for completion.",
      status: "ALREADY_IN_PROGRESS",
    };
  }

  const env = detectEnvironment();

  try {
    updateInProgress = true;

    if (env === "WINDOWS_DEPOT" || process.platform === "win32") {
      const batPath = path.join(process.cwd(), "deploy", "windows", "service-updater.bat");
      if (!fs.existsSync(batPath)) {
        updateInProgress = false;
        return {
          success: false,
          message: `Updater script not found at ${batPath}`,
          status: "ERROR",
        };
      }

      const targetDir = process.cwd();
      let spawned = false;

      // 1. Primary: Launch via WMI Win32_Process.Create
      // WMI process is hosted by WmiPrvSE.exe, which breaks out of the NSSM service Job Object.
      // When NSSM stops the web service, the updater process is NOT terminated!
      try {
        const escapedBat = batPath.replace(/'/g, "''");
        const escapedTarget = targetDir.replace(/'/g, "''");
        const cmdLine = `cmd.exe /c "${escapedBat}" "${escapedTarget}"`;
        const psScript = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmdLine}' }; if ($r.ReturnValue -ne 0) { exit $r.ReturnValue }`;
        execSync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript}"`, {
          timeout: 10000,
          stdio: "ignore",
        });
        spawned = true;
      } catch (wmiErr) {
        console.warn("WMI process creation fallback triggered:", wmiErr);
      }

      // 2. Secondary: Task Scheduler fallback
      if (!spawned) {
        try {
          const taskName = "PepsiDepotUpdateOnce";
          const taskCmd = `cmd.exe /c "${batPath}" "${targetDir}"`;
          execSync(`schtasks /create /tn "${taskName}" /tr "${taskCmd}" /sc once /st 00:00 /f >nul 2>&1 && schtasks /run /tn "${taskName}" >nul 2>&1`, {
            timeout: 8000,
            stdio: "ignore",
          });
          spawned = true;
        } catch (taskErr) {
          console.warn("Task scheduler fallback triggered:", taskErr);
        }
      }

      // 3. Tertiary: Direct detached spawn
      if (!spawned) {
        const child = spawn("cmd.exe", ["/c", batPath, targetDir], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.unref();
      }

      // Reset in-memory flag after 2 minutes in case server wasn't killed
      setTimeout(() => {
        updateInProgress = false;
      }, 120_000);

      return {
        success: true,
        message: "Automated update initiated. Background services are rebuilding and restarting. Reconnecting...",
        status: "INITIATED",
      };
    } else {
      // Linux or local environment
      execSync("git fetch origin main && git reset --hard origin/main && npm run build", {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 120_000,
      });

      updateInProgress = false;
      // Invalidate cache
      cachedVersion = null;

      return {
        success: true,
        message: "Code updated to latest origin/main and build compiled successfully.",
        status: "INITIATED",
      };
    }
  } catch (err: unknown) {
    updateInProgress = false;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to initiate update: ${msg}`,
      status: "ERROR",
    };
  }
}

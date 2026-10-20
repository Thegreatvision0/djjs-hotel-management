// Auto-sync: watches the project and, after edits settle, commits and pushes to GitHub.
// Run with `npm run sync` or double-click auto-sync.cmd. Stop with Ctrl+C.
// What gets committed is controlled by .gitignore (node_modules, dist, .env and logs are never uploaded).
import { watch } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUIET_MS = Number(process.env.SYNC_QUIET_MS) || 20_000; // wait until edits stop for this long
const IGNORE = /(^|[\\/])(\.git|node_modules|dist)([\\/]|$)|\.log$|~$|\.swp$/;

const git = (...args) => run("git", args, { cwd: ROOT, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
const stamp = () => new Date().toLocaleString("en-IN", { hour12: false });
const log = (msg) => console.log(`[${stamp()}] ${msg}`);

let timer = null;
let busy = false;
let again = false;

async function sync() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    const { stdout: status } = await git("status", "--porcelain");
    // Each line is "XY path": keep the leading status columns intact (don't trim before slicing).
    const files = status.split("\n").filter((l) => l.trim()).map((l) => l.slice(3).replace(/^"|"$/g, ""));
    if (!files.length) return;
    await git("add", "-A");
    const summary = files.length <= 3 ? files.join(", ") : `${files.slice(0, 3).join(", ")} +${files.length - 3} more`;
    await git("commit", "-m", `Auto-sync: ${summary}`);
    try {
      await git("push");
    } catch {
      // Remote has commits we don't (e.g. edited on github.com) — rebase onto them, then push.
      log("Push rejected — pulling remote changes first…");
      await git("pull", "--rebase", "--autostash");
      await git("push");
    }
    log(`✓ Synced ${files.length} file${files.length === 1 ? "" : "s"}: ${summary}`);
  } catch (err) {
    log(`✗ Sync failed: ${(err.stderr || err.message).trim().split("\n").slice(-2).join(" ")}`);
    log("  Will retry on the next change. If this repeats, run `git status` to check.");
  } finally {
    busy = false;
    if (again) { again = false; schedule(); }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(sync, QUIET_MS);
}

watch(ROOT, { recursive: true }, (_event, file) => {
  if (!file || IGNORE.test(file)) return;
  schedule();
});

log(`Auto-sync watching ${ROOT}`);
log(`Changes are committed and pushed ${QUIET_MS / 1000}s after you stop editing. Press Ctrl+C to stop.`);
sync(); // push anything already pending at start-up

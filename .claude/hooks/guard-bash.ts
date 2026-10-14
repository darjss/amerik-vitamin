// PreToolUse hook for Bash. Exit 2 blocks the command and shows stderr to the agent.
// Edits go through the Edit tool or ast-grep, so a diff shows what changed.
// Gates run unpiped, so a failure's full output and exit code reach the agent.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { cwd, tool_input } = JSON.parse(readFileSync(0, "utf8"));

// Match shell words only: heredoc bodies and quoted strings (commit messages,
// file contents) are data. A quoted redirect target slips through; that is rare.
const command = String(tool_input.command ?? "")
  .replaceAll(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\2(?=\n|$)/gu, "<<$2$3")
  .replaceAll(/"(?:[^"\\]|\\.)*"|'[^']*'/gu, '""');
const repo = process.env.CLAUDE_PROJECT_DIR ?? cwd;

const insideRepo = (target: string) => {
  const path = resolve(cwd, target.replace(/^~(?=\/)/u, process.env.HOME ?? "~"));

  return path === repo || path.startsWith(`${repo}/`);
};

const writeTargets = [
  ...command.matchAll(/\bcat\b[^|;&]*?>{1,2}\s*([^\s"';&|]+)/gu),
  ...command.matchAll(/\|\s*tee\s+(?:-a\s+)?([^\s"';&|]+)/gu),
].map((match) => match[1]);

const block = (reason: string) => {
  process.stderr.write(`Blocked: ${reason}\n`);
  process.exit(2);
};

if (/\bpython3?\s+-(?:\s|$)/u.test(command)) {
  block("no `python3 -` scripts. Edit files with the Edit tool or ast-grep.");
}

if (/\bsed\s+(?:-[a-zA-Z]*i|--in-place)/u.test(command)) {
  block("no `sed -i`. Edit files with the Edit tool or ast-grep.");
}

const target = writeTargets.find(insideRepo);

if (target !== undefined) {
  block(`no cat/tee into ${target}. Write repo files with the Write or Edit tool.`);
}

if (/\bvp\s+(?:check|test|run\s+test)\b(?:[^;&|]|>&)*\|\s*(?:tail|head|grep|rg)\b/u.test(command)) {
  block("run `vp check` and `vp run test` unpiped, so the full failure and exit code show.");
}

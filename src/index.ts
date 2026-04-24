import { install } from "./install.js";
import { status } from "./status.js";
import { uninstall } from "./uninstall.js";

const HELP = `Usage: a2h-skill <command> [options]

Commands:
  install               Install A2H skill (writes .mcp.json + skill.md, runs login)
  install --no-login    Install config only, skip login
  uninstall             Remove a2h MCP server config + skill.md
  status                Show installation + login status
  help                  This message

Options:
  --api-base <url>      Override API endpoint (for staging testing)
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  const apiBaseIdx = args.indexOf("--api-base");
  const apiBase =
    apiBaseIdx !== -1 && args[apiBaseIdx + 1] ? args[apiBaseIdx + 1] : undefined;
  const noLogin = args.includes("--no-login");

  switch (cmd) {
    case "install":
      await install({ login: !noLogin, apiBase });
      break;
    case "uninstall":
      uninstall();
      break;
    case "status":
      status();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stderr.write(HELP);
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n${HELP}`);
      process.exit(1);
  }
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});

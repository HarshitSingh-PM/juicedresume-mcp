import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const ENGINES = ["tectonic", "xelatex", "pdflatex", "lualatex"] as const;

async function whichEngine(): Promise<string | null> {
  for (const e of ENGINES) {
    if (await commandExists(e)) return e;
  }
  return null;
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("which", [cmd]);
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

export interface CompileResult {
  pdf?: Buffer;
  log: string;
  engine: string;
  error?: string;
}

export async function compileLatex(tex: string): Promise<CompileResult> {
  const engine = await whichEngine();
  if (!engine) {
    return {
      log: "",
      engine: "",
      error: "no_engine",
    };
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "juiced-tex-"));
  const src = path.join(dir, "resume.tex");
  await fs.writeFile(src, tex, "utf8");

  let cmd: string;
  let args: string[];

  if (engine === "tectonic") {
    cmd = "tectonic";
    args = ["--keep-logs", "--outdir", dir, src];
  } else {
    cmd = engine;
    args = ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", dir, src];
  }

  const log = await runOnce(cmd, args, dir);
  // For pdflatex/xelatex, run twice for proper refs (cheap)
  if (engine !== "tectonic") await runOnce(cmd, args, dir);

  const pdfPath = path.join(dir, "resume.pdf");
  try {
    const pdf = await fs.readFile(pdfPath);
    return { pdf, log, engine };
  } catch {
    return { log, engine, error: "no_pdf_produced" };
  } finally {
    // best-effort cleanup
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runOnce(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    let out = "";
    const p = spawn(cmd, args, { cwd });
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(out));
    p.on("error", (e) => resolve(out + "\n" + String(e)));
  });
}

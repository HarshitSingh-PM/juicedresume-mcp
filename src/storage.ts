import { promises as fs } from "fs";
import path from "path";
import { Resume, type TResume, newId } from "@juiced/schema";

/**
 * Storage backend for the MCP server.
 *
 * Two modes, picked at runtime by whether a cloud token is present:
 *
 *   • CLOUD  — set $JUICEDRESUME_TOKEN (and optionally $JUICEDRESUME_URL).
 *     Every operation hits the JuicedResume REST API under /api/mcp, so the
 *     server reads and writes the SAME resumes the user has on
 *     juicedresume.com. This is the mode the website's Settings → AI install
 *     snippet configures, and the one virtually all users want.
 *
 *   • LOCAL  — no token. Reads/writes JSON files under $JUICED_DATA_DIR
 *     (default <cwd>/../../data). Kept for local development and offline use.
 */

const ROOT = path.resolve(process.env.JUICED_DATA_DIR || path.join(process.cwd(), "../..", "data"));
const RESUMES = path.join(ROOT, "resumes");
const VERSIONS = path.join(ROOT, "versions");

const CLOUD_TOKEN = (process.env.JUICEDRESUME_TOKEN || "").trim();
const CLOUD_URL = (process.env.JUICEDRESUME_URL || "https://juicedresume.com").replace(/\/+$/, "");
const CLOUD = CLOUD_TOKEN.length > 0;

async function ensure(dir: string) { await fs.mkdir(dir, { recursive: true }); }

/** One authenticated call to the cloud API. Throws actionable errors. */
async function cloudReq(method: string, p: string, body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${CLOUD_URL}/api/mcp${p}`, {
      method,
      headers: {
        authorization: `Bearer ${CLOUD_TOKEN}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`JuicedResume: could not reach ${CLOUD_URL} (${(e as Error)?.message || e}). Check JUICEDRESUME_URL / network.`);
  }
  if (res.status === 401) throw new Error("JuicedResume: invalid or missing JUICEDRESUME_TOKEN — rotate it in Settings → AI on juicedresume.com.");
  if (res.status === 402) throw new Error("JuicedResume: your plan does not include MCP/cloud access (Basic or Pro required).");
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`JuicedResume cloud ${method} ${p} failed: ${res.status} ${detail}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

export async function listResumes(): Promise<TResume[]> {
  if (CLOUD) return (await cloudReq("GET", "/resumes")) ?? [];
  await ensure(RESUMES);
  const files = await fs.readdir(RESUMES);
  const out: TResume[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(RESUMES, f), "utf8");
      out.push(Resume.parse(JSON.parse(raw)));
    } catch {}
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getResume(id: string): Promise<TResume | null> {
  if (CLOUD) {
    const data = await cloudReq("GET", `/resumes/${id}`);
    return data ? Resume.parse(data) : null;
  }
  try {
    const raw = await fs.readFile(path.join(RESUMES, `${id}.json`), "utf8");
    return Resume.parse(JSON.parse(raw));
  } catch { return null; }
}

export async function saveResume(r: TResume): Promise<TResume> {
  const next: TResume = { ...r, updatedAt: new Date().toISOString() };
  if (CLOUD) {
    // PUT upserts (creates the row if the id is new) so create + duplicate work too.
    await cloudReq("PUT", `/resumes/${r.id}`, next);
    return next;
  }
  await ensure(RESUMES);
  await ensure(path.join(VERSIONS, r.id));
  const file = path.join(RESUMES, `${r.id}.json`);
  try {
    const prev = await fs.readFile(file, "utf8");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(VERSIONS, r.id, `${ts}.json`), prev, "utf8");
  } catch {}
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function createBlankResume(name = "Untitled"): Promise<TResume> {
  const blank: TResume = Resume.parse({
    id: newId(),
    name,
    personal: {},
    sections: [],
    styling: {},
    locale: {},
  } as any);
  return await saveResume(blank);
}

export async function deleteResume(id: string) {
  if (CLOUD) { await cloudReq("DELETE", `/resumes/${id}`); return; }
  try { await fs.unlink(path.join(RESUMES, `${id}.json`)); } catch {}
}

export { ROOT };

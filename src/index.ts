#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  Resume, type TResume, type TSection, type SectionType, DEFAULT_SECTION_TITLES, newId, TEMPLATE_IDS, type TemplateId,
} from "@juiced/schema";
import { scoreResume, tailorToJob } from "@juiced/scoring";
import { ACTION_VERBS, VERB_CATEGORY_LABEL, type VerbCategory, searchSkills, searchTitles, searchCompanies } from "@juiced/libraries";
import { listResumes, getResume, saveResume, createBlankResume, deleteResume } from "./storage.js";
import { resumeToLatex } from "./latex.js";
import { compileLatex } from "./latexCompile.js";
import { promises as fs } from "fs";
import path from "path";

const server = new Server(
  { name: "juiced-resume", version: "0.3.1" },
  { capabilities: { tools: {} } }
);

// ---------- helpers ----------

const idArg = z.object({ id: z.string() });
const ok = (data: any) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
async function mutate(id: string, fn: (r: TResume) => TResume) {
  const r = await getResume(id);
  if (!r) throw new Error(`Resume not found: ${id}`);
  const next = fn(r);
  return await saveResume(next);
}

// ---------- tool definitions ----------

const TOOLS = [
  // discovery
  { name: "list_resumes", description: "List all resumes.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_resume", description: "Get a resume by id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "create_resume", description: "Create a blank resume.", inputSchema: { type: "object", properties: { name: { type: "string" } }, additionalProperties: false } },
  { name: "delete_resume", description: "Delete a resume.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "duplicate_resume", description: "Duplicate a resume.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },

  // personal info / summary
  { name: "set_personal_info", description: "Patch personal info (only included keys are updated).", inputSchema: { type: "object", properties: {
      id: { type: "string" }, patch: { type: "object" }
    }, required: ["id","patch"] } },
  { name: "set_summary", description: "Replace the Summary section's body HTML.", inputSchema: { type: "object", properties: { id: { type: "string" }, html: { type: "string" } }, required: ["id","html"] } },

  // sections
  { name: "add_section", description: "Add a section by type. Type must be one of: summary, experience, education, skills, languages, certificates, interests, projects, courses, awards, organisations, publications, references, declaration, custom.", inputSchema: { type: "object", properties: { id: { type: "string" }, type: { type: "string" }, title: { type: "string" } }, required: ["id","type"] } },
  { name: "remove_section", description: "Remove a section by id.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" } }, required: ["id","sectionId"] } },
  { name: "reorder_sections", description: "Reorder sections by id list.", inputSchema: { type: "object", properties: { id: { type: "string" }, order: { type: "array", items: { type: "string" } } }, required: ["id","order"] } },
  { name: "rename_section", description: "Rename a section.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" }, title: { type: "string" } }, required: ["id","sectionId","title"] } },
  { name: "toggle_section_visibility", description: "Toggle a section's visibility.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" }, visible: { type: "boolean" } }, required: ["id","sectionId"] } },

  // entries
  { name: "add_entry", description: "Add an entry to a section. `entry` is the partial item shape.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" }, entry: { type: "object" } }, required: ["id","sectionId","entry"] } },
  { name: "update_entry", description: "Patch an entry.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" }, entryId: { type: "string" }, patch: { type: "object" } }, required: ["id","sectionId","entryId","patch"] } },
  { name: "remove_entry", description: "Remove an entry.", inputSchema: { type: "object", properties: { id: { type: "string" }, sectionId: { type: "string" }, entryId: { type: "string" } }, required: ["id","sectionId","entryId"] } },

  // styling
  { name: "set_template", description: "Switch template.", inputSchema: { type: "object", properties: { id: { type: "string" }, template: { type: "string" } }, required: ["id","template"] } },
  { name: "set_styling", description: "Patch styling (accent, fonts, spacing, layout, photo, …).", inputSchema: { type: "object", properties: { id: { type: "string" }, patch: { type: "object" } }, required: ["id","patch"] } },
  { name: "set_locale", description: "Patch locale (language, dateFormat, pageFormat).", inputSchema: { type: "object", properties: { id: { type: "string" }, patch: { type: "object" } }, required: ["id","patch"] } },

  // scoring + tailoring
  { name: "score_resume", description: "Run Resume Worded-style scoring.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "tailor_to_jd", description: "Match resume against a JD; returns relevancy score and missing keywords.", inputSchema: { type: "object", properties: { id: { type: "string" }, jd: { type: "string" } }, required: ["id","jd"] } },

  // libraries
  { name: "verb_lookup", description: "Return action verbs for a category. Categories: accomplishment, communication, entrepreneurial, executive, leadership, research, problem-solving, process-improvement, financial, design, administrative, engineering.", inputSchema: { type: "object", properties: { category: { type: "string" } }, required: ["category"] } },
  { name: "skill_search", description: "Fuzzy-search the skills dictionary.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "title_search", description: "Fuzzy-search job titles.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "company_search", description: "Fuzzy-search company names.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },

  // meta
  { name: "templates_list", description: "List installed templates with categories.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },

  // export
  { name: "export_latex", description: "Render a resume to LaTeX source (string). Optionally save to outPath.", inputSchema: { type: "object", properties: { id: { type: "string" }, outPath: { type: "string" } }, required: ["id"] } },
  { name: "export_ats_pdf", description: "Compile a resume to an ATS-friendly PDF via LaTeX. Saves to outPath if given, otherwise returns a base64 PDF.", inputSchema: { type: "object", properties: { id: { type: "string" }, outPath: { type: "string" } }, required: ["id"] } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args: any = req.params.arguments ?? {};
  try {
    switch (name) {
      case "list_resumes": return ok(await listResumes());
      case "get_resume": return ok(await getResume(args.id));
      case "create_resume": return ok(await createBlankResume(args.name || "Untitled"));
      case "delete_resume": await deleteResume(args.id); return ok({ ok: true });
      case "duplicate_resume": {
        const r = await getResume(args.id);
        if (!r) throw new Error("not found");
        return ok(await saveResume({ ...r, id: newId(), name: `${r.name} (Copy)`, createdAt: new Date().toISOString() }));
      }
      case "set_personal_info":
        return ok(await mutate(args.id, r => ({ ...r, personal: { ...r.personal, ...(args.patch || {}) } })));
      case "set_summary":
        return ok(await mutate(args.id, r => {
          let sections = r.sections.slice();
          let sec = sections.find(s => s.type === "summary") as any;
          if (!sec) {
            sec = { id: newId(), type: "summary", title: DEFAULT_SECTION_TITLES.summary, visible: true, columns: 1, items: [] };
            sections.push(sec);
          }
          sec.items = [{ id: sec.items[0]?.id || newId(), visible: true, body: args.html }];
          return { ...r, sections };
        }));
      case "add_section":
        return ok(await mutate(args.id, r => {
          const type = args.type as SectionType;
          if (!DEFAULT_SECTION_TITLES[type]) throw new Error(`unknown section type: ${type}`);
          const section: TSection = { id: newId(), type, title: args.title || DEFAULT_SECTION_TITLES[type], visible: true, columns: 1, items: [] } as TSection;
          return { ...r, sections: [...r.sections, section] };
        }));
      case "remove_section":
        return ok(await mutate(args.id, r => ({ ...r, sections: r.sections.filter(s => s.id !== args.sectionId) })));
      case "reorder_sections":
        return ok(await mutate(args.id, r => {
          const map = new Map(r.sections.map(s => [s.id, s]));
          const ordered = (args.order as string[]).map(id => map.get(id)).filter(Boolean) as any[];
          const missing = r.sections.filter(s => !args.order.includes(s.id));
          return { ...r, sections: [...ordered, ...missing] };
        }));
      case "rename_section":
        return ok(await mutate(args.id, r => ({ ...r, sections: r.sections.map(s => s.id === args.sectionId ? ({ ...s, title: args.title } as TSection) : s) })));
      case "toggle_section_visibility":
        return ok(await mutate(args.id, r => ({ ...r, sections: r.sections.map(s => s.id === args.sectionId ? ({ ...s, visible: typeof args.visible === "boolean" ? args.visible : !s.visible } as TSection) : s) })));
      case "add_entry":
        return ok(await mutate(args.id, r => ({
          ...r, sections: r.sections.map(s => s.id === args.sectionId ? ({ ...s, items: [...(s as any).items, { id: newId(), visible: true, ...(args.entry || {}) }] } as TSection) : s),
        })));
      case "update_entry":
        return ok(await mutate(args.id, r => ({
          ...r, sections: r.sections.map(s => s.id === args.sectionId ? ({ ...s, items: (s as any).items.map((it: any) => it.id === args.entryId ? { ...it, ...(args.patch || {}) } : it) } as TSection) : s),
        })));
      case "remove_entry":
        return ok(await mutate(args.id, r => ({
          ...r, sections: r.sections.map(s => s.id === args.sectionId ? ({ ...s, items: (s as any).items.filter((it: any) => it.id !== args.entryId) } as TSection) : s),
        })));
      case "set_template": {
        if (!TEMPLATE_IDS.includes(args.template)) throw new Error(`unknown template: ${args.template}. Available: ${TEMPLATE_IDS.join(", ")}`);
        return ok(await mutate(args.id, r => ({ ...r, styling: { ...r.styling, template: args.template as TemplateId } })));
      }
      case "set_styling":
        return ok(await mutate(args.id, r => ({ ...r, styling: { ...r.styling, ...(args.patch || {}) } })));
      case "set_locale":
        return ok(await mutate(args.id, r => ({ ...r, locale: { ...r.locale, ...(args.patch || {}) } })));
      case "score_resume": {
        const r = await getResume(args.id); if (!r) throw new Error("not found");
        return ok(scoreResume(r));
      }
      case "tailor_to_jd": {
        const r = await getResume(args.id); if (!r) throw new Error("not found");
        return ok(tailorToJob(r, String(args.jd || "")));
      }
      case "verb_lookup": {
        const c = args.category as VerbCategory;
        const list = ACTION_VERBS[c];
        if (!list) throw new Error(`unknown verb category: ${args.category}. Try: ${Object.keys(ACTION_VERBS).join(", ")}`);
        return ok({ category: c, label: VERB_CATEGORY_LABEL[c], verbs: list });
      }
      case "skill_search": return ok(searchSkills(String(args.query || ""), args.limit ?? 12));
      case "title_search": return ok(searchTitles(String(args.query || "")));
      case "company_search": return ok(searchCompanies(String(args.query || "")));
      case "templates_list": return ok(TEMPLATE_IDS);
      case "export_latex": {
        const r = await getResume(args.id); if (!r) throw new Error("not found");
        const tex = resumeToLatex(r);
        if (args.outPath) {
          await fs.mkdir(path.dirname(args.outPath), { recursive: true });
          await fs.writeFile(args.outPath, tex, "utf8");
          return ok({ outPath: args.outPath, bytes: Buffer.byteLength(tex, "utf8") });
        }
        return ok({ latex: tex });
      }
      case "export_ats_pdf": {
        const r = await getResume(args.id); if (!r) throw new Error("not found");
        const tex = resumeToLatex(r);
        const out = await compileLatex(tex);
        if (!out.pdf) {
          if (out.error === "no_engine") throw new Error("No LaTeX engine found. Install one: `brew install tectonic` (recommended), or BasicTeX for pdflatex.");
          throw new Error(`Compile failed (${out.error || "unknown"}). Last log:\n${out.log.slice(-1500)}`);
        }
        if (args.outPath) {
          await fs.mkdir(path.dirname(args.outPath), { recursive: true });
          await fs.writeFile(args.outPath, out.pdf);
          return ok({ outPath: args.outPath, engine: out.engine, bytes: out.pdf.length });
        }
        return ok({ engine: out.engine, bytes: out.pdf.length, pdfBase64: out.pdf.toString("base64") });
      }
      default: throw new Error(`unknown tool: ${name}`);
    }
  } catch (err: any) {
    return { isError: true, content: [{ type: "text", text: `Error: ${err.message || String(err)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[juiced-mcp] ready");

import type { TResume, TSection } from "@juiced/schema";

/**
 * Render a TResume to a single-column, ATS-friendly LaTeX document.
 * Design goals (driven by what ATS parsers actually handle well):
 *  - Single column. No tables, no two-column trickery.
 *  - Plain bullet glyphs (the LaTeX default disc).
 *  - Latin Modern / Computer Modern fonts; no exotic glyphs.
 *  - No images, no colours that affect parsing — accent colour stays in headings only.
 *  - Searchable text only (no shapes-as-text).
 *  - Hyperlinks via hyperref, but text label is the URL/handle (parser-friendly).
 *
 * The output compiles with pdflatex / xelatex / lualatex / tectonic.
 */
export function resumeToLatex(r: TResume): string {
  const accent = sanitizeColor(r.styling.accent || "#1a1a1a");
  const p = r.personal;

  const head = `\\documentclass[${r.locale.pageFormat === "Letter" ? "letterpaper" : "a4paper"},11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{textcomp}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{parskip}
\\providecommand{\\rupee}{Rs.}
\\definecolor{accent}{HTML}{${accent}}
\\hypersetup{colorlinks=true, urlcolor=accent, linkcolor=accent}
\\titleformat{\\section}{\\Large\\bfseries\\color{accent}}{}{0pt}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}
\\setlist[itemize]{leftmargin=*, topsep=2pt, itemsep=1pt, parsep=0pt}
\\pagenumbering{gobble}
\\begin{document}
`;

  const header = `\\begin{center}
{\\LARGE \\textbf{${tex(p.fullName || "Your Name")}}}\\\\[2pt]
${p.title ? `{\\itshape ${tex(p.title)}}\\\\[2pt]` : ""}
${[
  p.email && `\\href{mailto:${p.email}}{${tex(p.email)}}`,
  p.phone && tex(p.phone),
  p.location && tex(p.location),
  p.linkedin && hrefHandle(p.linkedin),
  p.github && hrefHandle(p.github),
  p.website && hrefHandle(p.website),
].filter(Boolean).join(" \\textbullet{} ")}
\\end{center}
\\vspace{4pt}
`;

  const body = r.sections
    .filter((s) => s.visible !== false)
    .map((s) => renderSection(s, r))
    .join("\n");

  const tail = `
\\end{document}
`;

  return head + header + body + tail;
}

function renderSection(s: TSection, r: TResume): string {
  const items = (s as any).items.filter((i: any) => i.visible !== false);
  if (!items.length) return "";

  const header = `\\section*{${tex(s.title)}}`;

  switch (s.type) {
    case "summary":
      return `${header}\n${items.map((i: any) => htmlToTex(i.body)).join("\n\n")}\n`;

    case "experience":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.jobTitle)}}\\hfill ${tex(dateRange(i.startDate, i.endDate, i.current, r))}\\\\
{\\itshape\\color{accent}${tex(i.employer)}}${i.location ? ` \\textbullet{} ${tex(i.location)}` : ""}\\\\
${htmlToTex(i.description)}
`).join("\n\\vspace{4pt}\n")}\n`;

    case "education":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.degree)}${i.field ? `, ${tex(i.field)}` : ""}}\\hfill ${tex(dateRange(i.startDate, i.endDate, false, r))}\\\\
{\\itshape\\color{accent}${tex(i.school)}}${i.location ? ` \\textbullet{} ${tex(i.location)}` : ""}\\\\
${i.description ? htmlToTex(i.description) : ""}
`).join("\n")}\n`;

    case "projects":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.name)}}${i.role ? ` --- ${tex(i.role)}` : ""}\\hfill ${tex(dateRange(i.startDate, i.endDate, false, r))}\\\\
${i.link ? `\\href{${ensureProto(i.link)}}{${tex(i.link)}}\\\\` : ""}
${htmlToTex(i.description)}
`).join("\n")}\n`;

    case "skills":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.category || "Skills")}:} ${tex(i.skills || "")}\\\\
`).join("\n")}\n`;

    case "languages":
      return `${header}\n\\noindent ${items.map((i: any) =>
        `\\textbf{${tex(i.name)}}${i.level ? ` (${tex(i.level)})` : ""}`
      ).join(" \\textbullet{} ")}\\\\
`;

    case "certificates":
      return `${header}\n\\begin{itemize}\n${items.map((i: any) =>
        `  \\item \\textbf{${tex(i.name)}}${i.issuer ? ` --- ${tex(i.issuer)}` : ""}${i.date ? ` (${tex(i.date)})` : ""}${i.link ? ` \\href{${ensureProto(i.link)}}{link}` : ""}`
      ).join("\n")}\n\\end{itemize}\n`;

    case "interests":
      return `${header}\n\\noindent ${items.map((i: any) => tex(i.name)).join(" \\textbullet{} ")}\\\\
`;

    case "courses":
      return `${header}\n\\begin{itemize}\n${items.map((i: any) =>
        `  \\item \\textbf{${tex(i.name)}}${i.institution ? ` --- ${tex(i.institution)}` : ""}${i.date ? ` (${tex(i.date)})` : ""}`
      ).join("\n")}\n\\end{itemize}\n`;

    case "awards":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.name)}}${i.issuer ? ` --- ${tex(i.issuer)}` : ""}${i.date ? ` \\hfill ${tex(i.date)}` : ""}\\\\
${i.description ? htmlToTex(i.description) : ""}
`).join("\n")}\n`;

    case "organisations":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.name)}}${i.role ? ` --- ${tex(i.role)}` : ""}\\hfill ${tex(dateRange(i.startDate, i.endDate, false, r))}\\\\
${i.description ? htmlToTex(i.description) : ""}
`).join("\n")}\n`;

    case "publications":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.title)}}${i.publisher ? ` --- ${tex(i.publisher)}` : ""}${i.date ? `\\hfill ${tex(i.date)}` : ""}\\\\
${i.link ? `\\href{${ensureProto(i.link)}}{${tex(i.link)}}\\\\` : ""}
${i.description ? htmlToTex(i.description) : ""}
`).join("\n")}\n`;

    case "references":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.name)}}${i.relationship ? `, ${tex(i.relationship)}` : ""}${i.company ? ` (${tex(i.company)})` : ""}\\\\
${[i.email, i.phone].filter(Boolean).map(tex).join(" \\textbullet{} ")}
`).join("\n")}\n`;

    case "declaration":
      return `${header}\n${items.map((i: any) => htmlToTex(i.body)).join("\n")}${
        items[0]?.signedAt ? `\n\\vspace{6pt}\\noindent ${tex(items[0].signedAt)}` : ""
      }\n`;

    case "custom":
      return `${header}\n${items.map((i: any) => `
\\noindent\\textbf{${tex(i.title)}}${i.subtitle ? ` --- ${tex(i.subtitle)}` : ""}${i.date ? `\\hfill ${tex(i.date)}` : ""}\\\\
${i.description ? htmlToTex(i.description) : ""}
`).join("\n")}\n`;
  }
}

// ---------- helpers ----------

function tex(s: string): string {
  if (!s) return "";
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[$&%#_{}]/g, (c) => "\\" + c)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}")
    // typographic punctuation
    .replace(/—/g, "---")
    .replace(/–/g, "--")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "\\ldots{}")
    // bullets & arrows commonly pasted in
    .replace(/•/g, "\\textbullet{}")
    .replace(/●|■|▪|▶|►|·/g, "\\textbullet{}")
    .replace(/→|➔|➜|⇒/g, "$\\rightarrow$")
    .replace(/←|⇐/g, "$\\leftarrow$")
    .replace(/↑|⇑/g, "$\\uparrow$")
    .replace(/↓|⇓/g, "$\\downarrow$")
    // currency
    .replace(/₹/g, "\\rupee{}")
    .replace(/€/g, "\\texteuro{}")
    .replace(/£/g, "\\pounds{}")
    .replace(/¥/g, "\\textyen{}")
    // misc
    .replace(/×/g, "$\\times$")
    .replace(/÷/g, "$\\div$")
    .replace(/±/g, "$\\pm$")
    .replace(/©/g, "\\textcopyright{}")
    .replace(/®/g, "\\textregistered{}")
    .replace(/™/g, "\\texttrademark{}")
    .replace(/§/g, "\\S{}")
    .replace(/°/g, "$^{\\circ}$");
}

/**
 * Convert a fragment of inline HTML (no block tags) to LaTeX with proper escaping.
 * - escapes text content with tex()
 * - converts <strong>/<b>, <em>/<i>, <u>, <a> into LaTeX commands
 * - drops any other tags
 */
function inlineHtmlToTex(html: string): string {
  let out = "";
  let i = 0;
  const src = html;
  while (i < src.length) {
    if (src[i] !== "<") {
      // accumulate plain text run until next "<"
      const next = src.indexOf("<", i);
      const chunk = next === -1 ? src.slice(i) : src.slice(i, next);
      out += tex(decodeEntities(chunk));
      if (next === -1) break;
      i = next;
      continue;
    }
    // We're at a "<". Try matching a known tag.
    const close = src.indexOf(">", i);
    if (close === -1) break;
    const tagSrc = src.slice(i, close + 1);
    let m: RegExpMatchArray | null;
    if ((m = tagSrc.match(/^<(strong|b)\b/i))) {
      const end = findCloseTag(src, close + 1, m[1]);
      const inner = src.slice(close + 1, end.start);
      out += `\\textbf{${inlineHtmlToTex(inner)}}`;
      i = end.after; continue;
    }
    if ((m = tagSrc.match(/^<(em|i)\b/i))) {
      const end = findCloseTag(src, close + 1, m[1]);
      const inner = src.slice(close + 1, end.start);
      out += `\\emph{${inlineHtmlToTex(inner)}}`;
      i = end.after; continue;
    }
    if (tagSrc.match(/^<u\b/i)) {
      const end = findCloseTag(src, close + 1, "u");
      const inner = src.slice(close + 1, end.start);
      out += `\\underline{${inlineHtmlToTex(inner)}}`;
      i = end.after; continue;
    }
    if ((m = tagSrc.match(/^<a\b[^>]*href="([^"]+)"/i))) {
      const href = m[1];
      const end = findCloseTag(src, close + 1, "a");
      const inner = src.slice(close + 1, end.start);
      out += `\\href{${href}}{${inlineHtmlToTex(inner)}}`;
      i = end.after; continue;
    }
    // unknown / self-closing tag — drop it
    i = close + 1;
  }
  return out;
}

function findCloseTag(src: string, from: number, tag: string): { start: number; after: number } {
  const re = new RegExp(`</${tag}\\s*>`, "i");
  const m = src.slice(from).match(re);
  if (!m) return { start: src.length, after: src.length };
  const start = from + (m.index || 0);
  return { start, after: start + m[0].length };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function htmlToTex(html: string): string {
  if (!html) return "";
  // Pull <li>...</li> from any <ul> blocks into a single itemize.
  const liMatches = Array.from(html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
  if (liMatches.length) {
    const items = liMatches.map((m) => `  \\item ${inlineHtmlToTex(m[1])}`);
    // Any text outside the <ul>? Render it as paragraphs before/after.
    const withoutLi = html.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, "");
    const segments = withoutLi.split("");
    const renderPara = (chunk: string) =>
      chunk.split(/<\/?p[^>]*>/gi).map((c) => inlineHtmlToTex(c).trim()).filter(Boolean).join("\\\\\n");
    const before = renderPara(segments[0] || "");
    const after = renderPara(segments.slice(1).join("\n"));
    return `${before ? before + "\n" : ""}\\begin{itemize}\n${items.join("\n")}\n\\end{itemize}\n${after}`;
  }
  // Plain paragraphs
  return html.split(/<\/?p[^>]*>/gi).map((c) => inlineHtmlToTex(c).trim()).filter(Boolean).join("\\\\\n");
}
function sanitizeColor(hex: string): string {
  return hex.replace(/^#/, "").slice(0, 6).padEnd(6, "0");
}
function hrefHandle(s: string): string {
  return `\\href{${ensureProto(s)}}{${tex(s)}}`;
}
function ensureProto(s: string): string {
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}
function dateRange(start: string, end: string, current: boolean | undefined, r: TResume): string {
  // Reuse simple MM/YYYY → "Mon YYYY" conversion
  function f(d: string) {
    if (!d) return "";
    const m = d.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const idx = Math.max(0, Math.min(11, parseInt(m[1], 10) - 1));
      if (r.locale.dateFormat === "MM/YYYY") return `${m[1].padStart(2,"0")}/${m[2]}`;
      if (r.locale.dateFormat === "YYYY") return m[2];
      return `${months[idx]} ${m[2]}`;
    }
    return d;
  }
  const a = f(start);
  const b = current ? "Present" : f(end);
  if (a && b) return `${a} -- ${b}`;
  return a || b || "";
}

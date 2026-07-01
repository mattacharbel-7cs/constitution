import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "site");
const distDir = path.join(siteDir, "dist");
const assetsDir = path.join(siteDir, "assets");
const basePath = normalizeBasePath(process.env.BASE_PATH || "");

const motto = [
  "Across the Seven Seas.",
  "Through the Seven Layers of Connectivity.",
  "Building the Next C.",
];

const sectionDescriptions = {
  Bible: "The canonical philosophy and reading path of 7CS.",
  Codex: "How the institution builds, decides, invests, names and partners.",
  Atlas: "The living ecosystem of ventures, companies and partnerships.",
  "Design Language": "The visual and verbal restraint of 7CS.",
  Governance: "Stewardship, amendments and continuity.",
  Journal: "The dated institutional record.",
  Legal: "Disclaimers and legal reference boundaries.",
  Archive: "Preserved drafts, retired ideas and institutional memory.",
};

const nav = parseNavigation(await readFile(path.join(siteDir, "navigation.yml"), "utf8"));
const pages = flattenNavigation(nav.sections);

await mkdir(path.join(distDir, "assets"), { recursive: true });
await copyFile(path.join(assetsDir, "styles.css"), path.join(distDir, "assets", "styles.css"));
await copyFile(path.join(assetsDir, "logo.svg"), path.join(distDir, "assets", "logo.svg"));

await writePage("index.html", renderHome(nav));

for (const page of pages) {
  const sourcePath = path.join(rootDir, page.path);
  if (!existsSync(sourcePath)) {
    continue;
  }

  const markdown = await readFile(sourcePath, "utf8");
  const { meta, body } = parseMarkdownDocument(markdown);
  const pageTitle = meta.title || page.title;
  const section = page.section || meta.section || "constitution";
  const html = renderDocument({
    title: pageTitle,
    section,
    sourcePath: page.path,
    content: markdownToHtml(body, page.path),
    nav,
    currentPath: page.path,
  });

  await writePage(markdownPathToHtml(page.path), html);
}

console.log(`Built ${pages.length + 1} pages into ${path.relative(rootDir, distDir)}`);

async function writePage(relativePath, html) {
  const outputPath = path.join(distDir, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
}

function parseNavigation(yaml) {
  const lines = yaml.split(/\r?\n/);
  const root = { sections: [] };
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      continue;
    }

    const indent = rawLine.match(/^ */)[0].length;
    const text = rawLine.trim();

    while (stack.length > 1 && indent <= stack.at(-1).indent) {
      stack.pop();
    }

    const parent = stack.at(-1).value;

    if (text.startsWith("- ")) {
      const item = {};
      const listName = Array.isArray(parent.children) ? "children" : "sections";
      parent[listName] ||= [];
      parent[listName].push(item);
      stack.push({ indent, value: item });

      const rest = text.slice(2);
      if (rest.includes(":")) {
        const [key, ...valueParts] = rest.split(":");
        item[key.trim()] = cleanYamlValue(valueParts.join(":"));
      }
      continue;
    }

    const [key, ...valueParts] = text.split(":");
    const cleanKey = key.trim();
    const value = cleanYamlValue(valueParts.join(":"));

    if (value === "") {
      parent[cleanKey] = [];
      if (cleanKey === "children") {
        parent.children = [];
      }
    } else {
      parent[cleanKey] = value;
    }
  }

  return root;
}

function cleanYamlValue(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function flattenNavigation(sections) {
  const flattened = [];

  for (const section of sections) {
    const sectionName = section.title;
    if (section.path) {
      flattened.push({ ...section, section: sectionName });
    }

    for (const child of section.children || []) {
      flattened.push({ ...child, section: sectionName });
    }
  }

  return flattened;
}

function parseMarkdownDocument(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { meta: {}, body: markdown };
  }

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length) {
      meta[key.trim()] = cleanYamlValue(valueParts.join(":"));
    }
  }

  return { meta, body: markdown.slice(match[0].length) };
}

function markdownToHtml(markdown, sourcePath) {
  const html = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph = [];
  let list = [];
  let listType = "ul";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "), sourcePath)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    html.push(`<${listType}>${list.map((item) => `<li>${inlineMarkdown(item, sourcePath)}</li>`).join("")}</${listType}>`);
    list = [];
    listType = "ul";
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2], sourcePath)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (list.length && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      list.push(trimmed.slice(2));
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list.length && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      list.push(ordered[1]);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${inlineMarkdown(trimmed.slice(2), sourcePath)}</blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

function inlineMarkdown(text, sourcePath = "") {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const target = href.endsWith(".md") ? markdownPathToHref(resolveMarkdownHref(href, sourcePath)) : href;
      return `<a href="${escapeAttribute(target)}">${label}</a>`;
    });
}

function resolveMarkdownHref(href, sourcePath) {
  if (href.startsWith("/")) {
    return href.slice(1);
  }

  const sourceDir = path.posix.dirname(sourcePath.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(sourceDir === "." ? "" : sourceDir, href));
}

function markdownPathToHtml(markdownPath) {
  return `${markdownPath.replace(/\\/g, "/").replace(/\.md$/, "")}/index.html`;
}

function markdownPathToHref(markdownPath) {
  const normalized = markdownPath.replace(/\\/g, "/");
  const fromRoot = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  return withBasePath(`/${fromRoot.replace(/\.md$/, "")}/`);
}

function rootHref() {
  return withBasePath("/");
}

function withBasePath(href) {
  if (!href.startsWith("/")) {
    return href;
  }

  return `${basePath}${href}`;
}

function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function renderHome(nav) {
  const sectionCards = nav.sections
    .filter((section) => section.title !== "Start Here")
    .map((section) => {
      const href = section.path ? markdownPathToHref(section.path) : "#";
      const description = sectionDescriptions[section.title] || "Part of the 7CS institutional record.";
      return `<a class="section-card" href="${href}">
        <span>${escapeHtml(section.title)}</span>
        <small>${escapeHtml(description)}</small>
      </a>`;
    })
    .join("");

  return layout({
    title: nav.title,
    nav,
    currentPath: "",
    body: `<main class="home">
      <p class="eyebrow">Genesis / v${escapeHtml(nav.version)}</p>
      <h1>The Constitution of 7CS</h1>
      <div class="motto">
        ${motto.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
      <div class="home-actions">
        <a href="${markdownPathToHref("bible/README.md")}">Read the Bible</a>
        <a href="${markdownPathToHref("START_HERE.md")}">Start Here</a>
      </div>
      <section class="section-grid" aria-label="Constitution sections">
        ${sectionCards}
      </section>
    </main>`,
  });
}

function renderDocument({ title, section, sourcePath, content, nav, currentPath }) {
  return layout({
    title,
    nav,
    currentPath,
    body: `<main class="document">
      <p class="eyebrow">${escapeHtml(section)} / ${escapeHtml(sourcePath)}</p>
      <article class="prose">
        ${content}
      </article>
    </main>`,
  });
}

function layout({ title, nav, currentPath, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | 7CS Constitution</title>
  <meta name="description" content="The quiet institutional canon of 7CS.">
  <link rel="stylesheet" href="${withBasePath("/assets/styles.css")}">
</head>
<body>
  <div class="site-shell">
    <aside class="sidebar" aria-label="Primary navigation">
      <a class="brand" href="${rootHref()}" aria-label="7CS Constitution home">
        <img src="${withBasePath("/assets/logo.svg")}" alt="7CS">
      </a>
      ${renderNavigation(nav.sections, currentPath)}
    </aside>
    <div class="page">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

function renderNavigation(sections, currentPath) {
  return `<nav>${sections
    .map((section) => {
      const active = section.path === currentPath ? " aria-current=\"page\"" : "";
      const children = (section.children || [])
        .map((child) => {
          const childActive = child.path === currentPath ? " aria-current=\"page\"" : "";
          return `<li><a href="${markdownPathToHref(child.path)}"${childActive}>${escapeHtml(child.title)}</a></li>`;
        })
        .join("");
      const childList = children ? `<ul>${children}</ul>` : "";
      return `<section>
        <a href="${markdownPathToHref(section.path)}"${active}>${escapeHtml(section.title)}</a>
        ${childList}
      </section>`;
    })
    .join("")}</nav>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

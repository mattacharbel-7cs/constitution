import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT || 4177);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const filePath = await resolveFile(url.pathname);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`7CS Constitution site running at http://localhost:${port}`);
});

async function resolveFile(pathname) {
  const safePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  let candidate = path.join(distDir, safePath);

  if (!candidate.startsWith(distDir)) {
    throw new Error("Invalid path");
  }

  const info = await stat(candidate).catch(() => null);
  if (info?.isDirectory()) {
    candidate = path.join(candidate, "index.html");
  }

  if (!path.extname(candidate)) {
    candidate = path.join(candidate, "index.html");
  }

  return candidate;
}

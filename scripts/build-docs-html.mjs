import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const md = readFileSync(join(root, "DOCUMENTATION.md"), "utf8");

// Embed safely inside a <script> tag.
const safeMd = md.replace(/<\/script>/gi, "<\\/script>");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nightingale Recruit — Documentation</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  const raw = document.getElementById("md-source").textContent;

  const renderer = new marked.Renderer();
  const origCode = renderer.code.bind(renderer);
  renderer.code = (code, lang) => {
    const text = typeof code === "object" ? code.text : code;
    const language = typeof code === "object" ? code.lang : lang;
    if ((language || "").trim() === "mermaid") {
      return '<pre class="mermaid">' + text + "</pre>";
    }
    return origCode(typeof code === "object" ? code : { text: code, lang });
  };

  marked.setOptions({ renderer, gfm: true, breaks: false });
  document.getElementById("content").innerHTML = marked.parse(raw);

  mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
  await mermaid.run({ querySelector: "pre.mermaid" });
</script>
<style>
  :root { --fg:#1f2933; --muted:#647084; --bg:#ffffff; --border:#e4e8ef; --accent:#0f766e; --code-bg:#f5f7fa; }
  @media (prefers-color-scheme: dark) {
    :root { --fg:#e6e9ef; --muted:#9aa4b6; --bg:#0f1419; --border:#222a35; --accent:#2dd4bf; --code-bg:#161c24; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 48px 24px 96px; }
  h1,h2,h3,h4 { line-height:1.25; font-weight:700; margin-top:2em; }
  h1 { font-size:2.1rem; border-bottom:2px solid var(--border); padding-bottom:.3em; margin-top:0; }
  h2 { font-size:1.5rem; border-bottom:1px solid var(--border); padding-bottom:.25em; }
  h3 { font-size:1.2rem; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  code { background:var(--code-bg); padding:.15em .4em; border-radius:5px; font-size:.88em;
    font-family:"SF Mono",Menlo,Consolas,monospace; }
  pre { background:var(--code-bg); padding:16px; border-radius:10px; overflow:auto; border:1px solid var(--border); }
  pre code { background:none; padding:0; }
  pre.mermaid { background:transparent; border:none; text-align:center; padding:8px 0; }
  blockquote { margin:1em 0; padding:.4em 1em; border-left:4px solid var(--accent);
    background:var(--code-bg); color:var(--muted); border-radius:0 8px 8px 0; }
  table { border-collapse:collapse; width:100%; margin:1em 0; font-size:.92rem; display:block; overflow-x:auto; }
  th,td { border:1px solid var(--border); padding:8px 12px; text-align:left; }
  th { background:var(--code-bg); }
  hr { border:none; border-top:1px solid var(--border); margin:2.5em 0; }
  .banner { font-size:.85rem; color:var(--muted); margin-bottom:2em; }
</style>
</head>
<body>
  <div class="wrap">
    <div id="content">Loading documentation…</div>
  </div>
  <script id="md-source" type="text/markdown">${safeMd}</script>
</body>
</html>
`;

writeFileSync(join(root, "DOCUMENTATION.html"), html, "utf8");
console.log("Wrote DOCUMENTATION.html");

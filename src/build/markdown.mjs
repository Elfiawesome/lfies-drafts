import { Marked } from "marked";
import { entryHref, escapeAttr, escapeHtml } from "./utils.mjs";

function normalizeTarget(value) {
  return String(value ?? "")
    .trim()
    .replace(/^content[\\/]/i, "")
    .replace(/^\.?\//, "")
    .replace(/\.md$/i, "")
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

function createMarkdown({ lookup, root, currentType }) {
  const marked = new Marked({
    gfm: true,
    breaks: false,
  });

  marked.use({
    extensions: [
      {
        name: "wikilink",
        level: "inline",
        start(source) {
          const index = source.indexOf("[[");
          return index === -1 ? undefined : index;
        },
        tokenizer(source) {
          const match = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(source);
          if (!match) {
            return undefined;
          }
          return {
            type: "wikilink",
            raw: match[0],
            target: match[1].trim(),
            label: match[2]?.trim() || "",
          };
        },
        renderer(token) {
          const target = token.target;
          if (/^(https?:|mailto:)/i.test(target)) {
            const label = token.label || target;
            return `<a href="${escapeAttr(target)}" rel="noopener">${escapeHtml(label)}</a>`;
          }

          let key = normalizeTarget(target);
          let entry = lookup.get(key);
          if (!entry && key && !key.includes("/") && currentType) {
            entry = lookup.get(`${currentType}/${key}`);
          }

          if (!entry) {
            const label = token.label || target;
            return `<span class="wikilink-missing" title="Not found in this archive">${escapeHtml(label)}</span>`;
          }

          const label = token.label || entry.title;
          return `<a class="wikilink" href="${escapeAttr(entryHref(root, entry))}">${escapeHtml(label)}</a>`;
        },
      },
    ],
  });

  return marked;
}

export function createMarkdownContext({ entries, lookup, root, currentType }) {
  const markdown = createMarkdown({ lookup, root, currentType });
  return {
    render(text) {
      if (!text) {
        return "";
      }
      return markdown.parse(String(text));
    },
    renderInline(text) {
      if (!text) {
        return "";
      }
      return markdown.parseInline(String(text));
    },
    entries,
  };
}

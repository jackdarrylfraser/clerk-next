import type { Element, Root as HtmlRoot } from "hast";
import type { Blockquote, Paragraph, Root } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, {
  defaultSchema,
  type Options,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import type { Node, Parent } from "unist";

const calloutTypes = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
const markdownSanitizeSchema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    blockquote: [
      ...(defaultSchema.attributes?.blockquote ?? []),
      [
        "className",
        "markdown-callout",
        "markdown-callout-note",
        "markdown-callout-tip",
        "markdown-callout-important",
        "markdown-callout-warning",
        "markdown-callout-caution",
      ],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", "math-inline", "math-display"],
    ],
  },
};

function isBlockquote(node: Node): node is Blockquote {
  return node.type === "blockquote";
}

function isElement(node: Node): node is Element {
  return node.type === "element";
}

function isParent(node: Node): node is Parent {
  return "children" in node && Array.isArray(node.children);
}

function remarkCallouts() {
  return (tree: Root) => {
    const visit = (node: Node) => {
      if (isBlockquote(node)) {
        const firstChild = node.children[0];
        const firstText = firstChild?.type === "paragraph"
          ? firstChild.children[0]
          : undefined;

        if (firstChild?.type === "paragraph" && firstText?.type === "text") {
          const marker = new RegExp(
            `^\\[!(${calloutTypes.join("|")})\\](?=\\s|$)`,
            "i",
          ).exec(firstText.value);

          if (marker) {
            const type = marker[1].toLowerCase();
            const title = type[0].toUpperCase() + type.slice(1);
            const remainingChildren = firstChild.children.slice();
            const remainingText = remainingChildren[0];

            if (remainingText?.type === "text") {
              remainingText.value = remainingText.value
                .slice(marker[0].length)
                .trimStart();
              if (!remainingText.value) {
                remainingChildren.shift();
              }
            }

            Object.assign(node.data ??= {}, {
              hProperties: {
                className: ["markdown-callout", `markdown-callout-${type}`],
              },
            });

            const titleParagraph: Paragraph = {
              type: "paragraph",
              children: [
                { type: "strong", children: [{ type: "text", value: title }] },
              ],
            };
            const children: Blockquote["children"] = [titleParagraph];
            if (remainingChildren.length) {
              children.push({ ...firstChild, children: remainingChildren });
            }
            node.children.splice(0, 1, ...children);
          }
        }
      }

      if (isParent(node)) {
        node.children.forEach(visit);
      }
    };

    visit(tree);
  };
}

function rehypeRepairSanitizedFragments() {
  return (tree: HtmlRoot) => {
    const ids = new Set<string>();
    const links: Element[] = [];

    const visit = (node: Node) => {
      if (isElement(node)) {
        if (typeof node.properties.id === "string") {
          ids.add(node.properties.id);
        }
        if (node.tagName === "a") {
          links.push(node);
        }
      }

      if (isParent(node)) {
        node.children.forEach(visit);
      }
    };

    visit(tree);

    const prefix = markdownSanitizeSchema.clobberPrefix ?? "";
    for (const link of links) {
      const href = link.properties.href;
      if (typeof href !== "string" || !href.startsWith("#")) {
        continue;
      }

      const fragment = href.slice(1);
      const sanitizedId = `${prefix}${fragment}`;
      if (!ids.has(fragment) && ids.has(sanitizedId)) {
        link.properties.href = `#${sanitizedId}`;
      }
    }
  };
}

export async function renderMarkdown(source: string): Promise<string> {
  return String(
    await remark()
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkCallouts)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, markdownSanitizeSchema)
      .use(rehypeRepairSanitizedFragments)
      .use(rehypeKatex)
      .use(rehypeStringify)
      .process(source),
  );
}

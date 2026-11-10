import { expect, test } from "bun:test";
import { renderMarkdown } from "./index.ts";

test("renders GFM, math, and callouts", async () => {
  const html = await renderMarkdown(
    "| A | B |\n| - | - |\n| 1 | 2 |\n\n> [!TIP]\n> Helpful\n\nInline $x^2$",
  );

  expect(html).toContain("<table>");
  expect(html).toContain("markdown-callout-tip");
  expect(html).toContain("katex");
});

test("sanitizes raw HTML and repairs local fragment links", async () => {
  const html = await renderMarkdown(
    '<h1 id="heading">Heading</h1>\n\n[Jump](#heading)\n\n<script>alert(1)</script><div onclick="alert(1)">safe</div>',
  );

  expect(html).toContain('id="user-content-heading"');
  expect(html).toContain('href="#user-content-heading"');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick=");
});

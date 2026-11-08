# Public Markdown Pages

Write Markdown files in this directory. The app converts each `.md` file to
HTML and serves it at `/m/<filename-without-extension>`. For example, this
page is available at `/m/README`.

The Markdown source is not served directly from `/public`. Rendered pages are
public, so do not include private or sensitive content.

Markdown supports CommonMark and GitHub Flavored Markdown, including tables,
task lists, strikethrough, autolinks, footnotes, and LaTeX math rendered with
KaTeX. Use `$...$` for inline math and `$$...$$` on separate lines for display
math. Sanitized `<details>` and `<summary>` elements can be used for
collapsible sections.

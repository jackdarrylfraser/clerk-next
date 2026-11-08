---
title: "Public Markdown Pages"
description: "Guides and reference pages for members and visitors."
tags:
  - Documentation
---

# Public Markdown Pages

Write Markdown files in this directory. The app converts each `.md` file to
HTML and serves it at `/more/<filename-without-extension>`. For example, this
page is available at `/more/README`. Browse and paginate through all public
pages at `/more`.

Every page must start with frontmatter containing a `title`, `description`,
and one or more `tags`. Tags link to filtered lists at `/more/tag/<tag-slug>`.

```md
---
title: "Example page"
description: "A short summary shown in page listings."
tags:
  - Guides
  - Reference
---
```

The Markdown source is not served directly from `/public`. Rendered pages are
public, so do not include private or sensitive content.

Markdown supports CommonMark and GitHub Flavored Markdown, including tables,
task lists, strikethrough, autolinks, footnotes, and LaTeX math rendered with
KaTeX. Use `$...$` for inline math and `$$...$$` on separate lines for display
math. Sanitized `<details>` and `<summary>` elements can be used for
collapsible sections.

GitHub-style callouts are available with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
`[!WARNING]`, and `[!CAUTION]`. Put the marker at the start of a blockquote;
each type gets its own color style:

```md
> [!TIP]
> Use a callout to highlight useful information.
```

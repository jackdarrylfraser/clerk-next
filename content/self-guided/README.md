---
title: "A welcoming title"
description: "A short summary shown in the activity list."
tags:
  - guide
  - sample
---

# Permissioned Activity Content

Markdown files in this directory are converted to HTML and served from
`/activity/<filename-without-extension>`. Access requires an active Clerk user
plan with the `site_access` feature.

Every activity must start with YAML frontmatter containing a non-empty `title`,
`description`, and a `tags` list with at least one non-empty tag. Missing or
invalid metadata causes the build to fail. The title and description are shown
on the activity card. Tags are displayed as links; each link opens
`/activity/tag/<tag-slug>` with activities that share the tag. Tag slugs are lowercase,
with runs of non-alphanumeric characters replaced by hyphens. The activity
page shows the summary card before the rendered Markdown body. Frontmatter is
not included in the rendered activity body.

Activity bodies support CommonMark and GitHub Flavored Markdown, including
tables, task lists, strikethrough, autolinks, footnotes, and LaTeX math rendered
with KaTeX. Use `$...$` for inline math and `$$...$$` on separate lines for
display math. Sanitized `<details>` and `<summary>` elements can be used for
collapsible sections. GitHub-style `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
`[!WARNING]`, and `[!CAUTION]` blockquotes render as color-coded callouts.

```md
---
title: "A welcoming title"
description: "A short summary shown in the activity list."
tags:
  - guide
  - sample
---

# Activity content

The activity body starts here.

> [!NOTE]
> Callouts are supported in activity Markdown too.
```

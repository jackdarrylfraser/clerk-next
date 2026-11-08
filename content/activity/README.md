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

Activities can optionally start with YAML frontmatter. `title` overrides the
first Markdown heading in the activity list, and `description` adds supporting
text to the list card. `tags` is an optional YAML list displayed as links on
the card; each link opens `/tag/<tag-slug>` with activities that share the tag.
Tag slugs are lowercase, with runs of non-alphanumeric characters replaced by
hyphens. Without a `title`, the first heading is used, then the filename if
there is no heading. Frontmatter is not included in the rendered activity body.

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
```

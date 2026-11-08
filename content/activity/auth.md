---
title: "Confirmed"
description: "A brief confirmation activity."
tags:
  - confirmation
---

# The Ultimate Markdown Showcase & Syntax Guide

Welcome to this comprehensive showcase of Markdown features! This document is designed to demonstrate virtually every standard and extended (CommonMark / GitHub Flavored Markdown) feature available in modern Markdown renderers.

---

## 1. Headings & Hierarchy

Markdown supports six levels of headings corresponding to HTML `<h1>` through `<h6>`.

# Heading 1 (Page Title / Main Section)
## Heading 2 (Major Sub-section)
### Heading 3 (Topic Header)
#### Heading 4 (Subtopic Header)
##### Heading 5 (Minor Header)
###### Heading 6 (Micro Header)

> *Tip: You can also use Setext headings by underlining text with `=` for H1 or `-` for H2.*

---

## 2. Text Formatting & Inline Styles

You can emphasize text in various ways:

* **Bold**: `**bold text**` or `__bold text__`
* *Italic*: `*italicized text*` or `_italicized text_`
* ***Bold and Italic***: `***bold italic***` or `___bold italic___`
* ~~Strikethrough~~: `~~strikethrough~~`
* Subscript: H~2~O (`H~2~O`) *(renderer dependent)*
* Superscript: E = mc^2^ (`E = mc^2^`) *(renderer dependent)*
* Keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>C</kbd> (`<kbd>Key</kbd>`)
* Highlight: ==highlighted text== (`==highlighted text==`) *(renderer dependent)*

---

## 3. Lists

### 3.1 Unordered Lists

Use `-`, `*`, or `+` to denote bullet points:

- Primary level bullet
  - Nested item (indent by 2 or 4 spaces)
    - Sub-nested item
- Another main item
  * Mixing symbols is supported
  + Another sub-bullet

### 3.2 Ordered Lists

Use numbers followed by periods:

1. First step
2. Second step
3. Third step
   1. Sub-step A
   2. Sub-step B
4. Fourth step

### 3.3 Task / Checklist (GFM)

- [x] Create project repository
- [x] Write documentation
- [ ] Add unit tests
- [ ] Deploy to production

---

## 4. Blockquotes & Callouts

### Basic Blockquotes

> "Simplicity is the soul of efficiency."
> 
> — Austin Freeman

### Nested Blockquotes

> Level 1 quote
> > Nested level 2 quote
> > > Deeper level 3 quote

### GitHub Flavored Alerts / Callouts

> [!NOTE]
> Useful information that users should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

---

## 5. Code & Syntax Highlighting

### Inline Code

Use backticks around inline commands or variables: `npm install`, `let count = 0;`, or `git status`.

### Fenced Code Blocks

Code blocks support explicit language identifiers for syntax highlighting:

#### JavaScript
```javascript
function greet(name) {
  const greeting = `Hello, ${name}!`;
  console.log(greeting);
  return greeting;
}

greet("Markdown Enthusiast");
```

#### Python
```python
def fibonacci(n: int) -> list[int]:
    """Generate a Fibonacci sequence up to n elements."""
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

if __name__ == "__main__":
    print(fibonacci(7))
```

#### JSON
```json
{
  "project": "Markdown Guide",
  "version": "1.0.0",
  "features": ["formatting", "tables", "code blocks"],
  "active": true
}
```

---

## 6. Links & Media

### Hyperlinks

* [Standard Inline Link](https://www.markdownguide.org)
* [Link with Title Attribute](https://www.markdownguide.org "Official Markdown Guide")
* Reference-style link: [Learn more about Markdown][guide-ref]
* Autolink: <https://github.com> or email <support@example.com>

[guide-ref]: https://www.markdownguide.org/basic-syntax/

### Images

Standard inline image:

![Markdown Logo Placeholder](https://via.placeholder.com/600x200.png?text=Markdown+Showcase+Banner)

Linked image (click to open):

[![Clickable Image](https://via.placeholder.com/300x100.png?text=Click+Me)](https://www.example.com)

---

## 7. Tables

Markdown tables use pipes (`|`) and hyphens (`-`). Colon placement controls alignment.

| Left Aligned | Center Aligned | Right Aligned | Default |
| :--- | :---: | ---: | --- |
| Apple | Red | $1.20 | Crisp |
| Banana | Yellow | $0.50 | Sweet |
| Blueberry | Dark Blue | $3.00 | Tart |
| Dragonfruit | Pink | $4.50 | Exotic |

---

## 8. Mathematical Notation (LaTeX / MathJax)

Inline math: $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$ or the Pythagorean theorem: $a^2 + b^2 = c^2$.

Block display math:

$$
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$

$$
\mathbf{X} = \begin{bmatrix}
x_{11} & x_{12} & \dots & x_{1m} \\
x_{21} & x_{22} & \dots & x_{2m} \\
\vdots & \vdots & \ddots & \vdots \\
x_{n1} & x_{n2} & \dots & x_{nm}
\end{bmatrix}
$$

---

## 9. Footnotes

Here is a statement that requires citation.[^1] You can also place multiple footnotes throughout a paragraph without breaking reading flow.[^2]

[^1]: This is the first footnote detailing background information and sources.
[^2]: Here is the second footnote providing extra technical context.

---

## 10. Horizontal Rules & Dividers

Three or more hyphens, asterisks, or underscores create a clean thematic break:

---

***

___

---

<details>
<summary><b>11. Collapsible Details & Raw HTML</b></summary>

When standard Markdown needs extra structure, standard HTML elements can be embedded:

<br>

Here is extra hidden content! You can include:
- Markdown lists inside details
- Code snippets
- Detailed debugging tables

```bash
docker compose up -d --build
```

</details>

---

## 12. Escaping Characters

To render characters that are normally treated as Markdown syntax, prepend them with a backslash (`\`):

\* This bullet does not render as a bullet because it is escaped.  
\# Not a header  
\[Not a link\]
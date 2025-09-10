---
title: "MCP Design System: How We Connected Our DS to Code Assist"
description: "At Carrefour, in the Design System Tech Team, we built an MCP server that enables AI assistants (Claude, GitHub Copilot, Gemini-CLI, etc.) to understand and generate code for our Design System. Result: developers can prompt `create a product card with price and rating` and get production-ready Marcel code with the right components, tokens, and patterns."
pubDate: "2025-09-10"
conclusion: "👉 Interested in implementing MCP for your Design System? The protocol is open source and the community is growing. Feel free to reach out with questions!"
image: "/images/posts/2025-09-10-mcp-design-system-carrefour-marcel/c4-kit.png"
---

## TL;DR

At Carrefour, in the Design System Tech Team, we built an MCP server that enables AI assistants (Claude, GitHub Copilot, Gemini-CLI, etc.) to understand and generate code for our Design System. Result: developers can prompt `create a product card with price and rating` and get production-ready Marcel code with the right components, tokens, and patterns.

<div class="flex w-full justify-center">
  <figure class="flex flex-col items-center gap-2">
    <img
      src="/images/posts/2025-09-10-mcp-design-system-carrefour-marcel/marcel.png"
      alt="Logo Marcel"
      class="w-1/2 md:w-84 border-2 border-white border-opacity-50 rounded-lg"
    />
    <figcaption class="text-xs text-center text-gray-600 dark:text-gray-400">
      Logo Marcel
    </figcaption>
  </figure>
</div>

## The Problem: When AI Doesn't Know Your Code

### The AI-Driven Web Uniformity

Have you noticed how similar websites are becoming? It's partly due to AI assistants massively generating React + Tailwind code, which dominates their training data.

At Carrefour, we have our own Design System: **Marcel**. It's our unique visual language, featuring:

- Custom Vue/React/Angular components
- Specific design tokens
- Business-specific patterns and guidelines
- Strict accessibility rules (WCAG)
- BEM CSS methodology

### Our Developers' Daily Challenge

```javascript
// What AI generates by default
<div className="flex items-center justify-between p-4 bg-blue-500 rounded-lg shadow-md">
  <h2 className="text-xl font-bold">Product Title</h2>
  <span className="text-lg text-gray-700">19.99€</span>
</div>

// What we actually need
<CCard>
  <CText tag="h2" variation="heading-m">Product Title</CText>
  <CText variation="price">19.99€</CText>
</CCard>
```

Result: developers spent hours refactoring AI-generated code to match Marcel.

## The Solution: MCP Server

### What is MCP?

MCP (Model Context Protocol) is an open-source protocol created by Anthropic that extends LLMs' capabilities with local data sources. It's like giving contextual "superpowers" to your AI assistant.

### Our Approach: MCP Marcel Server

We developed an MCP server that lives directly in our Design System monorepo. It exposes our component documentation, design tokens, and coding guidelines directly to AI assistants.

## Technical Architecture

### Build and Distribution Flow

```text
Build Process:
1. [Component Source Code] 
   ↓
2. [Build Script: Extract Metadata]
   ↓
3. [metadata.json Generated]
   ↓
4. [Package MCP + metadata.json]
   ↓
5. [Publish to Artifactory]

Runtime:
1. [AI Assistant Query]
   ↓
2. [MCP Server Reads metadata.json]
   ↓
3. [Returns Component Info]
   ↓
4. [AI Generates Correct Code]
```

### 1. Monorepo Integration

```bash
marcel-design-system/
├── packages/
│   ├── components-vue3/
│   ├── components-react/
│   ├── styles/
│   └── mcp-server/          # Our MCP server
│       ├── index.js
│       ├── tools/
│       └── package.json
```

### 2. STDIO Approach

We chose the STDIO (Standard Input/Output) approach because:

- Our npm/monorepo infrastructure was already in place
- Simple installation via npm like any other package
- No remote server to maintain
- Security: code stays local

```json
{
  "mcpServers": {
    "marcel-design-system": {
      "command": "npx",
      "args": ["-y", "@carrefour/design-system-mcp-server@latest"]
    }
  }
}
```

### 3. Distribution via Private Artifactory

The MCP server is packaged and versioned with the rest of the Design System:

<div class="flex w-full justify-center">
  <figure class="flex flex-col items-center gap-2">
    <img
      src="/images/posts/2025-09-10-mcp-design-system-carrefour-marcel/jfrog.png"
      alt="JFrog Carrefour"
      class="w-full border-2 border-white border-opacity-50 rounded-lg"
    />
    <figcaption class="text-xs text-center text-gray-600 dark:text-gray-400">
      JFrog Carrefour
    </figcaption>
  </figure>
</div>

## Key Features

### 1. Component Verification

The MCP verifies that components actually exist:

```javascript
// MCP then suggests alternatives via:
get_components_list({ category: "form" })
// Returns: Available components like c-input-select, c-popin

// This tool-based verification ensures:
// - AI can only use components that actually exist in the current version
// - Developers get helpful alternatives when requesting non-existent components
// - All information comes from build-time generated metadata, not runtime analysis
```

### 2. Accurate Props and Events

Each component is documented with its actual props, preventing AI from guessing:

```javascript
// Before MCP: AI guesses props
<CButton variant="large" color="blue" onClick={handle}>

// With MCP: AI calls get_component_details first
get_component_details({ componentName: "c-button", framework: "vue3" })

// Returns actual component API:
{
  "props": [
    { "name": "variation", "type": "string", "values": ["primary", "secondary"] },
    { "name": "size", "type": "string", "values": ["s", "m", "l"] },
    { "name": "disabled", "type": "boolean" }
  ],
  "events": [
    { "name": "click", "payload": "MouseEvent" }
  ]
}

// After MCP: correct props from verified data
<CButton variation="primary" size="m" @click="handle">
```

### 3. Design Tokens with --ds-* Prefix

All our design tokens follow a consistent naming pattern:

```css
.product-card {
  /* Marcel tokens instead of hardcoded values */
  padding: var(--ds-spacing-m);
  background: var(--ds-color-surface-primary);
  border-radius: var(--ds-border-radius-m);
  box-shadow: var(--ds-shadow-up-s);
}
```

### 4. Embedded Guidelines

The MCP includes our coding standards:

#### BEM for CSS

```css
/* Mandatory BEM structure */
.product-card { }
.product-card__title { }
.product-card__price { }
.product-card--featured { }
```

#### WCAG Accessibility

```html
<!-- Mandatory aria-* attributes when supported -->
<CInputText 
  label="Email"
  v-model="email"
  aria-describedby="email-help"
  aria-invalid="false"
  aria-required="true"
/>
```

#### Correct Import Patterns

```javascript
// Official grouped import
import { CButton, CInputText, CModal } from '@carrefour/design-system-components-vue3'
```

#### Critical Anti-Hallucination Rule

```javascript
// The #1 rule in our guidelines
get_guidelines({ guideline: "anti-hallucination" })

// Returns:
"MANDATORY: Always call get_component_details before using ANY component
FORBIDDEN: Using a component without verification
CRITICAL: Only use what exists, never guess"
```

This rule is so important that AI assistants are instructed to ALWAYS verify before generating code. The anti-hallucination guideline contains:

- List of components that don't exist in Marcel but may be hallucinated: CDropdown, CNavbar, CSidebar...
- Common naming mistakes to avoid
- Mandatory verification protocol before any code generation
- Correct alternatives for commonly requested but non-existent components

## Prompting Best Practices

### Effective Prompts for Marcel

When working with AI assistants that have MCP Marcel access, structure your prompts clearly:

```markdown
# Good Starting Points
"Create a login form using Marcel components"
"Build a product card with Marcel design system"
"Generate a responsive layout using Marcel components and BEM"

# Be Specific About Requirements
"Create a Vue 3 form with Marcel components including:
- Email and password fields
- Validation messages
- Accessibility attributes
- Marcel design tokens for spacing"
```

### Specify Your Preferences

The MCP can work with both design tokens and hard values:

```markdown
Create a card component using:
- Marcel design tokens (--ds-*) for all spacing and colors"

OR

Create a card component using:
- Hard CSS values (px, rem, hex colors)"
```

## Real Developer Workflow

### The Transformation

Before MCP, developers would get generic code and spend significant time adapting it. Now, with MCP Marcel, the AI understands our Design System from the start.

Example: When asked to create a login form, the AI now:

1. Queries the available Marcel components
2. Gets the correct props and events
3. Applies BEM naming for custom styles
4. Uses Marcel design tokens
5. Includes proper accessibility attributes

The result is production-ready code that follows all our standards on the first generation:

<div class="flex w-full justify-center">
  <figure class="flex flex-col items-center gap-2">
    <img
      src="/images/posts/2025-09-10-mcp-design-system-carrefour-marcel/login-form.png"
      alt="Login Form with Marcel"
      class="w-3/4 md:w-84 border-2 border-white border-opacity-50 rounded-lg"
    />
    <figcaption class="text-xs text-center text-gray-600 dark:text-gray-400">
      Login Form with Marcel
    </figcaption>
  </figure>
</div>

## Implementation Benefits

### For Developers

- Less time refactoring AI-generated code
- Consistent use of Marcel components
- Better adherence to coding standards
- Improved accessibility compliance

### For the Design System Team

- Reduced support questions about component usage
- Better adoption of design tokens
- Consistent implementation across teams
- Living documentation through the MCP

### For the Organization

- Visual consistency across all products
- Faster feature development
- Reduced technical debt
- Better maintainability

## Lessons Learned

### 1. Start with the Problem, Not the Solution

Before implementing MCP, we asked:

- What specific problems do LLMs create for our developers?
- Which AI tools are our teams actually using?
- What infrastructure do we already have in place?

### 2. STDIO Works Great for Design Systems

The STDIO approach was perfect because:

- We already had npm infrastructure
- Developers are familiar with npm packages
- Version management aligns with our Design System
- No additional infrastructure needed
- **Cross-tool compatibility** - Works with gemini-cli, Claude, and other AI tools

### 3. Guidelines Are as Important as Components

The MCP doesn't just provide component names. It teaches:

- How to use components correctly
- Why certain patterns are preferred
- When to use specific components
- What accessibility requirements exist

### 4. Clear Rules Prevent Hallucination

We implemented strict verification rules:

- Always verify component existence before use
- Never guess props or events
- Only use documented patterns
- Follow established naming conventions

## How to Implement MCP for Your Design System

### 1. Assess Your Readiness

Ask yourself:

- Do you have a documented Design System?
- Are your developers using AI assistants?
- Do you have a consistent component structure?
- Is there a gap between AI output and your standards?

### 2. Start with Core Components

Begin with your most-used components:

- Document their props and events
- Include usage examples
- Add any special requirements

### 3. Build Incrementally

Start simple and expand:

```javascript
// Start with basic component listing
// Then add props documentation
// Then add tokens and guidelines
// Finally add complex patterns
```

### 4. Integrate with Your Workflow

- Add to your existing monorepo
- Package with your Design System
- Document the installation process
- Train your team on usage

## Next Steps for Our Team

We're continuing to evolve MCP Marcel:

- Adding more complex UI patterns
- Integrating business-specific guidelines
- Improving error messages and suggestions
- Gathering metrics on usage and impact

## Resources

### About MCP

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Anthropic's MCP Announcement](https://anthropic.com/news/model-context-protocol)

### Getting Started with MCP

- [MCP SDK (TypeScript/Python)](https://github.com/modelcontextprotocol/sdk)
- [Building MCP Servers](https://modelcontextprotocol.io/tutorials)
- [Claude Desktop App](https://claude.ai/download)

## Conclusion

MCP Marcel has fundamentally changed how our developers work with AI assistants. Instead of fighting against generic code generation, we've given AI the context it needs to generate Marcel-compliant code from the start.

The key insight: **Your proprietary Design System doesn't have to be a barrier to AI assistance—it can be enhanced by it.**

By connecting our Design System to AI through MCP, we've achieved:

- Consistent component usage across teams
- Reduced development time
- Better accessibility compliance
- Maintained visual identity

The future of Design Systems isn't just about components and tokens—it's about making them accessible to the AI tools that developers increasingly rely on.

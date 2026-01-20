import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    metaTitle: z.string().optional(),
    description: z.string(),
    conclusion: z.string().optional(),
    // Transform string to Date object
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
});

export const collections = { blog };

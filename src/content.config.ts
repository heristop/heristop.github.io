/* eslint-disable eslint-plugin-import(no-named-export) */
/* eslint-disable eslint-plugin-import(prefer-default-export) */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    conclusion: z.string().optional(),
    description: z.string(),
    image: z.string().optional(),
    metaTitle: z.string().optional(),
    pubDate: z.coerce.date().optional(),
    tags: z.array(z.string()).optional().default([]),
    title: z.string(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { blog };

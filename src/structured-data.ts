import {
  BLUESKY_URL,
  GITHUB_URL,
  LINKEDIN_URL,
  LINKFOLIO_URL,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_PSEUDO,
  SITE_TITLE,
  SITE_URL,
  X_URL,
} from "./consts";

// One author entity, referenced by @id from every page, so search engines and answer engines
// resolve the posts, the about page and the social profiles to the same person.
const PERSON_ID = `${SITE_URL}/about/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SITE_LANGUAGE = "en";

const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

const person = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: SITE_AUTHOR,
  alternateName: SITE_PSEUDO,
  url: absoluteUrl("/about/"),
  image: absoluteUrl("/images/avatar.webp"),
  jobTitle: "Chapter Lead / Principal Engineer",
  worksFor: { "@type": "Organization", name: "Carrefour" },
  knowsAbout: [
    "JavaScript",
    "TypeScript",
    "Vue",
    "React",
    "Node.js",
    "PHP",
    "Rust",
    "AI coding agents",
    "Web Development",
  ],
  sameAs: [GITHUB_URL, LINKEDIN_URL, X_URL, BLUESKY_URL, LINKFOLIO_URL],
};

const website = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_TITLE,
  url: absoluteUrl("/"),
  description: SITE_DESCRIPTION,
  inLanguage: SITE_LANGUAGE,
  author: { "@id": PERSON_ID },
  publisher: { "@id": PERSON_ID },
};

interface ListedPost {
  id: string;
  data: { title: string; pubDate?: Date };
}

const postUrl = (id: string) => absoluteUrl(`/blog/${id}/`);

// A listing page (archive, tag) as a CollectionPage whose main entity is the ordered post list
const collectionPage = (options: {
  path: string;
  name: string;
  description: string;
  posts: ListedPost[];
}) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": absoluteUrl(options.path),
  url: absoluteUrl(options.path),
  name: options.name,
  description: options.description,
  inLanguage: SITE_LANGUAGE,
  isPartOf: { "@id": WEBSITE_ID },
  author: { "@id": PERSON_ID },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: options.posts.length,
    itemListElement: options.posts.map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: postUrl(post.id),
      name: post.data.title,
    })),
  },
});

export {
  PERSON_ID,
  SITE_LANGUAGE,
  WEBSITE_ID,
  absoluteUrl,
  collectionPage,
  person,
  postUrl,
  website,
};

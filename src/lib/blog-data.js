import { getCollection } from "astro:content";

const siteUrl = (
  import.meta.env.SITE_URL ||
  import.meta.env.PUBLIC_SITE_URL ||
  "https://blog.vahedinia.me"
).replace(/\/$/, "");

export const authors = [
  {
    slug: "amin",
    name: "Amin",
    bio: "Photography, technology, and notes in English and Farsi.",
    longBio: "Personal blog covering photography, software, and the occasional bit of operations research.",
    avatar: "https://i.pravatar.cc/200?img=68",
  },
  {
    slug: "elena-march",
    name: "Elena March",
    bio: "Writer & editor covering design, craft, and slow technology.",
    longBio:
      "Elena March writes about the quiet edges of design and technology. Previously an editor at two small magazines, she now publishes essays and field notes from a desk overlooking the harbour.",
    avatar: "https://i.pravatar.cc/200?img=47",
  },
  {
    slug: "samuel-okafor",
    name: "Samuel Okafor",
    bio: "Software engineer with a soft spot for typography and the open web.",
    longBio:
      "Samuel builds tools for writers and reads more than he ships. He believes the best interfaces are the ones you don't notice.",
    avatar: "https://i.pravatar.cc/200?img=12",
  },
  {
    slug: "mira-iwasaki",
    name: "Mira Iwasaki",
    bio: "Photographer and essayist based between Kyoto and Lisbon.",
    longBio:
      "Mira's work sits at the intersection of place, memory, and the everyday object. Her essays have appeared in a number of small but loved publications.",
    avatar: "https://i.pravatar.cc/200?img=32",
  },
];

export const categories = [
  { slug: "essays", name: "Essays" },
  { slug: "design", name: "Design" },
  { slug: "engineering", name: "Engineering" },
  { slug: "field-notes", name: "Field Notes" },
  { slug: "interviews", name: "Interviews" },
];

export const tags = [
  { slug: "writing", name: "Writing" },
  { slug: "typography", name: "Typography" },
  { slug: "minimalism", name: "Minimalism" },
  { slug: "tools", name: "Tools" },
  { slug: "travel", name: "Travel" },
  { slug: "process", name: "Process" },
  { slug: "web", name: "Web" },
  { slug: "books", name: "Books" },
];

const isoDate = (date) => date?.toISOString().slice(0, 10);

export const imageSrc = (image) => (typeof image === "string" ? image : image?.src);

export const normalizePost = (entry) => ({
  slug: entry.id,
  ...entry.data,
  date: isoDate(entry.data.date),
  updated: isoDate(entry.data.updated),
});

export const posts = async () => (await getCollection("blog")).map(normalizePost);

export const getPost = async (slug) => (await posts()).find((post) => post.slug === slug);
export const getAuthor = (slug) => authors.find((author) => author.slug === slug);
export const getCategory = (slug) => categories.find((category) => category.slug === slug);
export const getTag = (slug) => tags.find((tag) => tag.slug === slug);
export const postsByCategory = async (slug) =>
  (await sortedPosts()).filter((post) => post.category === slug);
export const postsByTag = async (slug) =>
  (await sortedPosts()).filter((post) => post.tags.includes(slug));
export const postsByAuthor = async (slug) =>
  (await sortedPosts()).filter((post) => post.author === slug);
export const sortedPosts = async () =>
  [...(await posts())].sort((a, b) => (a.date < b.date ? 1 : -1));
export const featuredPost = async () => {
  const sorted = await sortedPosts();
  return sorted.find((post) => post.featured) ?? sorted[0];
};
export const popularPosts = async () => (await sortedPosts()).slice(0, 4);
export const relatedPosts = async (post, n = 3) =>
  (await sortedPosts())
    .filter((candidate) => candidate.slug !== post.slug)
    .sort((a, b) => {
      const score = (candidate) =>
        (candidate.category === post.category ? 2 : 0) +
        candidate.tags.filter((tag) => post.tags.includes(tag)).length;
      return score(b) - score(a);
    })
    .slice(0, n);

export const adjacentPosts = async (post) => {
  const sorted = await sortedPosts();
  const index = sorted.findIndex((candidate) => candidate.slug === post.slug);
  return { prev: sorted[index + 1], next: sorted[index - 1] };
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const SITE = {
  name: "Vahedinia's Blog",
  description:
    "Personal notes on photography, technology, and writing — in English and Farsi.",
  url: siteUrl,
};

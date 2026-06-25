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
    bio: "Photography, technology, etc.",
    longBio:
      "Personal blog covering cooking, software, music, photography and the occasional bit of operations research.",
    avatar:
      "https://1.gravatar.com/avatar/1f7856b6273e3e83c66131d43b6d822ac64791268b8becb28dde00721c7a16a4?s=200&d=mm",
  },
];

export const categories = [
  { slug: "engineering", name: "Engineering" },
  { slug: "takes", name: "Takes" },
  { slug: "photography", name: "Photography" },
  { slug: "music-piano", name: "Music / Piano" },
  { slug: "cooking", name: "Cooking" },
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

export const tags = async () => {
  const allPosts = await posts();
  const seen = new Set();
  const result = [];
  for (const post of allPosts) {
    for (const t of post.tags ?? []) {
      if (!seen.has(t)) {
        seen.add(t);
        result.push({ slug: t, name: t });
      }
    }
  }
  return result;
};

export const getPost = async (slug) => (await posts()).find((post) => post.slug === slug);
export const getAuthor = (slug) => authors.find((author) => author.slug === slug);
export const getCategory = (slug) => categories.find((category) => category.slug === slug);
export const getTag = async (slug) => (await tags()).find((tag) => tag.slug === slug);
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
  name: "Amin's Blog",
  description: "Personal takes on almost everything, master of all.",
  url: siteUrl,
  socials: {
    twitter: "https://x.com/01BinarySoul",
    instagram: "https://instagram.com/01BinarySoul",
    linkedin: "https://linkedin.com/in/mavahedinia",
    github: "https://github.com/mavahedinia",
  },
};
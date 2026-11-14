// A volume's readers' rating and reviews as schema.org markup, for search
// engines. One rule for the app's own tags (pages/Prices/pageMeta.ts) and
// the site server's (client/server.ts). No imports, so the site server can
// read it.

// a review as much of it as the markup needs. Never a spoiler: a search
// result would show it to someone who hasn't read the volume
export type MarkedReview = {
  rating: number;
  text: string;
  by: string;
  writtenAt: string | Date;
};

// the most reviews written into a page's markup
const MOST_MARKED = 10;

// Properties to spread into the volume's own markup: its rating, and its
// reviews. Empty with no ratings (a rating of nothing is no claim to make)
export function ratingMarkup(
  rating: { count: number; average: number | null } | null | undefined,
  reviews: MarkedReview[] = [],
): { aggregateRating?: object; review?: object[] } {
  if (!rating?.count || rating.average === null) return {};
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: rating.average,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    },
    ...(reviews.length && {
      review: reviews.slice(0, MOST_MARKED).map((review) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: { "@type": "Person", name: review.by },
        reviewBody: review.text,
        datePublished: new Date(review.writtenAt).toISOString().slice(0, 10),
      })),
    }),
  };
}

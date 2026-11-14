// What the review section says and what search engines are given: the
// words (client/src/pages/Prices/reviews/reviewText.ts) and the markup
// (client/src/lib/reviewMarkup.ts). Both are free of imports.
import { ratingMarkup } from "../../../../client/src/lib/reviewMarkup.js";
import {
  barWidth,
  readers,
  scoreText,
  whoRated,
  writtenText,
} from "../../../../client/src/pages/Prices/reviews/reviewText.js";

test("who rated it, one reader or many", () => {
  expect(readers(1)).toBe("1 reader");
  expect(readers(12)).toBe("12 readers");
  expect(whoRated(1)).toBe("1 reader who owns or has read it");
  expect(whoRated(12)).toBe("12 readers who own or have read it");
});

test("a score keeps one decimal place, and a whole one has none", () => {
  expect(scoreText(4.3)).toBe("4.3");
  expect(scoreText(5)).toBe("5");
});

test("a bar is as wide as its share of the fullest bar", () => {
  const spread = [0, 1, 0, 2, 4];
  expect(barWidth(4, spread)).toBe("100%");
  expect(barWidth(2, spread)).toBe("50%");
  expect(barWidth(1, spread)).toBe("25%");
});

test("a recent review says how long ago, an older one its date", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const ago = () => "3 days ago";
  expect(writtenText("2026-11-10T12:00:00Z", ago, now)).toBe("3 days ago");
  expect(writtenText("2026-10-28T12:00:00Z", ago, now)).toBe("Oct 28");
  // another year says which
  expect(writtenText("2025-10-28T12:00:00Z", ago, now)).toBe("Oct 28, 2025");
});

test("markup: a rating and its reviews, and nothing at all with no ratings", () => {
  expect(ratingMarkup(null)).toEqual({});
  expect(ratingMarkup({ count: 0, average: null })).toEqual({});
  const review = {
    rating: 4,
    text: "The art carries it.",
    by: "Kenji",
    writtenAt: "2026-11-10T12:00:00Z",
  };
  const marked = ratingMarkup({ count: 3, average: 4.3 }, [review]);
  expect(marked.aggregateRating).toEqual({
    "@type": "AggregateRating",
    ratingValue: 4.3,
    ratingCount: 3,
    bestRating: 5,
    worstRating: 1,
  });
  expect(marked.review).toEqual([
    {
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: 4,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: "Kenji" },
      reviewBody: "The art carries it.",
      datePublished: "2026-11-10",
    },
  ]);
  // ratings with no written reviews: the rating alone
  expect(ratingMarkup({ count: 2, average: 5 })).not.toHaveProperty("review");
  // never more than ten written into a page
  const many = Array.from({ length: 14 }, () => review);
  expect(ratingMarkup({ count: 14, average: 4 }, many).review).toHaveLength(10);
});

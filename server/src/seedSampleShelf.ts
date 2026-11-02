// The sample shelf guests can look around at /u/sample. Runs on every deploy and
// only ever creates this one account: if it's there already, or its username or
// share code is taken, nothing is written. A problem here never stops the server.
//
//   npm run db:seed-sample
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, prisma } from "./config/prisma.js";

const USERNAME = "manga-tracker-sample";
// real codes are 12 characters, so this can't be someone's
const SHARE_CODE = "sample";
const COVER = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large";

const SHELF = [
  {
    name: "One Piece",
    genre: "Action",
    image: `${COVER}/bx30013-BeslEMqiPhlk.jpg`,
    bookmark: 1100,
    volumesOwned: 40,
    rating: 5,
    description: "Slowly collecting the whole thing. My shelf is not ready.",
  },
  {
    name: "Chainsaw Man",
    genre: "Action",
    image: `${COVER}/bx105778-euxXZEIfDY2u.png`,
    bookmark: 120,
    volumesOwned: 12,
    rating: 5,
  },
  {
    name: "Frieren: Beyond Journey's End",
    genre: "Adventure",
    image: `${COVER}/bx118586-CXKgWikBFQgS.jpg`,
    bookmark: 90,
    volumesOwned: 9,
    rating: 5,
    description: "The one I lend to friends who say they don't read manga.",
  },
  {
    name: "SPY x FAMILY",
    genre: "Action",
    image: `${COVER}/bx108556-NHjkz0BNJhLx.jpg`,
    bookmark: 72,
    volumesOwned: 10,
    rating: 4,
  },
  {
    name: "Dandadan",
    genre: "Action",
    image: `${COVER}/bx132029-prGF4gePdSKv.jpg`,
    bookmark: 45,
    rating: 4,
    description: "Catching up by chapter, buying the volumes when they're cheap.",
  },
  {
    name: "Sakamoto Days",
    genre: "Action",
    image: `${COVER}/bx125828-p78Z8SflkfmO.jpg`,
    bookmark: 30,
    volumesOwned: 4,
  },
  {
    name: "Witch Hat Atelier",
    genre: "Adventure",
    image: `${COVER}/bx98263-kIeaTXrAbGkj.jpg`,
    bookmark: 60,
    volumesOwned: 11,
    rating: 5,
    description: "The art alone is worth owning in print.",
  },
  {
    name: "Blue Box",
    genre: "Drama",
    image: `${COVER}/bx132182-maXh2QzYPrqR.jpg`,
    bookmark: 15,
    rating: 3,
  },
  {
    name: "Vinland Saga",
    genre: "Action",
    image: `${COVER}/bx30642-0mjRDkf4THpo.jpg`,
    bookmark: 54,
    volumesOwned: 3,
    rating: 5,
  },
  {
    name: "Fullmetal Alchemist",
    genre: "Action",
    image: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30025-mpPVpCKFTowt.png",
    status: true,
    volumesOwned: 27,
    rating: 5,
    description: "Finished, and worth every volume.",
  },
];

export async function seedSampleShelf() {
  const taken = await prisma.user.findFirst({
    where: { OR: [{ username: USERNAME }, { shareCode: SHARE_CODE }] },
    select: { id: true },
  });
  if (taken) return "already there";

  await prisma.user.create({
    data: {
      username: USERNAME,
      // random and thrown away: nobody can sign in to this account
      password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      displayName: "Sample Reader",
      avatar: "kenji",
      shareEnabled: true,
      shareNotes: true,
      shareCode: SHARE_CODE,
      manga: { create: SHELF },
    },
  });
  return "created";
}

try {
  console.log(`Sample shelf: ${await seedSampleShelf()}`);
} catch (e) {
  console.error("Sample shelf not seeded:", (e as Error).message);
} finally {
  await pool.end().catch(() => {});
}

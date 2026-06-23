import { Client } from "pg";

const SQL = `
CREATE TABLE IF NOT EXISTS manga(
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name  TEXT NOT NULL UNIQUE,
  genre VARCHAR(100),
  description TEXT,
  image TEXT,
  status BOOLEAN DEFAULT FALSE NOT NULL, 
  bookmark INTEGER,
  rating SMALLINT CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS author(
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS manga_author(
  manga_id INTEGER REFERENCES manga(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES author(id) ON DELETE CASCADE,
  PRIMARY KEY (manga_id, author_id)
);

INSERT INTO author (name) VALUES
  ('Eiichiro Oda'),
  ('Masashi Kishimoto'),
  ('Hajime Isayama'),
  ('Tite Kubo'),
  ('Naoko Takeuchi'),
  ('Hiromu Arakawa'),
  ('Koyoharu Gotouge'),
  ('Tsugumi Ohba'),
  ('Kohei Horikoshi'),
  ('Gege Akutami')
ON CONFLICT (name) DO NOTHING;

INSERT INTO manga (name, genre, description, image, status, bookmark) VALUES
  (
    'One Piece', 
    'Adventure', 
    'A stretchy idiot with zero navigation skills somehow convinces people to sail with him to the end of the world. 1080 chapters in and I still cannot stop. Eiichiro Oda has not slept since 1997 and it shows in the best possible way.',
    'https://images.penguinrandomhouse.com/cover/9781569319017', 
    false, 
    1080
  ),
  (
    'Naruto', 
    'Action', 
    'Loud kid with a demon fox inside him wants adults to acknowledge him so badly it physically hurts to watch. Made me ugly cry at least four times. The talk no jutsu is ridiculous and I respect it.',
    'https://images.penguinrandomhouse.com/cover/9781569319003', 
    true, 
    700
  ),
  (
    'Attack on Titan', 
    'Dark Fantasy', 
    'Naked giants eat people for breakfast and humanity is cooked. Angry boy with the worst luck in fiction decides to do something about it. Has one of the most unhinged plot twists in manga history and I am still not over it.',
    'https://images.penguinrandomhouse.com/cover/9781612620244', 
    true, 
    139
  ),
  (
    'Bleach', 
    'Supernatural', 
    'Scowling teenager gets voluntold into becoming a ghost cop and unlocks a cool new form every three chapters like he is opening loot boxes. The Bankai arc broke my brain in a good way. Tite Kubo drew the drip first and asked questions never.',
    'https://images.penguinrandomhouse.com/cover/9781591164418', 
    true, 
    686
  ),
  (
    'Sailor Moon', 
    'Magical Girl', 
    'Clumsy crybaby finds out she is actually the chosen one destined to protect the entire universe. Still cries. Still wins. An absolute icon and the blueprint for every magical girl that came after. Non-negotiable.',
    'https://images.penguinrandomhouse.com/cover/9781646512010', 
    true, 
    60
  ),
  (
    'Fullmetal Alchemist', 
    'Steampunk', 
    'Two brothers try to science-magic their dead mum back to life and immediately regret every decision they have ever made. Hiromu Arakawa cooked so hard with this one that it should be illegal. Genuinely one of the greatest stories ever written and I will not be taking questions.',
    'https://images.penguinrandomhouse.com/cover/9781591169208', 
    true, 
    108
  ),
  (
    'Demon Slayer', 
    'Dark Fantasy', 
    'Purest boy alive joins a demon murder cult to save his sister who is, unfortunately, now a demon. The art goes stupid hard every single chapter. Cried at the Rengoku arc. Anyone who claims they did not is a liar and a coward.',
    'https://images.penguinrandomhouse.com/cover/9781974700523', 
    true, 
    205
  ),
  (
    'Death Note', 
    'Psychological Thriller', 
    'Galaxy-brained teenager finds a notebook that kills anyone whose name gets written in it and within five minutes decides he should be God. The cat and mouse with L had me pausing every chapter to figure out who was winning. Absolutely unhinged from start to finish. Peak fiction.',
    'https://images.penguinrandomhouse.com/cover/9781421501680', 
    true, 
    108
  ),
  (
    'My Hero Academia', 
    'Superhero', 
    'Quirkless kid cries his way into inheriting the most broken power in existence and somehow that is endearing. Still ongoing and still has me in a chokehold. Bakugo carried at least forty percent of this series and that is a hill I will die on.',
    'https://images.penguinrandomhouse.com/cover/9781421582696', 
    true, 
    430
  ),
  (
    'Jujutsu Kaisen', 
    'Dark Fantasy', 
    'Normal kid eats a cursed finger on a dare, becomes an unkillable vessel for the King of Curses, and enrolls in a school with a genuinely criminal mortality rate. Nobody addresses this. Gojo Satoru alone is reason enough to read this. Currently ongoing and already responsible for significant emotional damage.',
    'https://images.penguinrandomhouse.com/cover/9781974710027', 
    false, 
    250
  )
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  bookmark = EXCLUDED.bookmark;

INSERT INTO manga_author (manga_id, author_id) VALUES
  ((SELECT id FROM manga WHERE name = 'One Piece'), (SELECT id FROM author WHERE name = 'Eiichiro Oda')),
  ((SELECT id FROM manga WHERE name = 'Naruto'), (SELECT id FROM author WHERE name = 'Masashi Kishimoto')),
  ((SELECT id FROM manga WHERE name = 'Attack on Titan'), (SELECT id FROM author WHERE name = 'Hajime Isayama')),
  ((SELECT id FROM manga WHERE name = 'Bleach'), (SELECT id FROM author WHERE name = 'Tite Kubo')),
  ((SELECT id FROM manga WHERE name = 'Sailor Moon'), (SELECT id FROM author WHERE name = 'Naoko Takeuchi')),
  ((SELECT id FROM manga WHERE name = 'Fullmetal Alchemist'), (SELECT id FROM author WHERE name = 'Hiromu Arakawa')),
  ((SELECT id FROM manga WHERE name = 'Demon Slayer'), (SELECT id FROM author WHERE name = 'Koyoharu Gotouge')),
  ((SELECT id FROM manga WHERE name = 'Death Note'), (SELECT id FROM author WHERE name = 'Tsugumi Ohba')),
  ((SELECT id FROM manga WHERE name = 'My Hero Academia'), (SELECT id FROM author WHERE name = 'Kohei Horikoshi')),
  ((SELECT id FROM manga WHERE name = 'Jujutsu Kaisen'), (SELECT id FROM author WHERE name = 'Gege Akutami'))
ON CONFLICT (manga_id, author_id) DO NOTHING;
`;

async function main() {
  console.log("Database Target:", process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    console.log("seeding database with 10 certified bangers...");
    await client.connect();
    await client.query(SQL);
    console.log(
      "done! your manga library is now stocked and ready to judge you.",
    );
  } catch (e) {
    throw new Error(
      "Failed to seed database, which is ironic because these mangas are about people who never give up",
      { cause: e },
    );
  } finally {
    await client.end();
  }
}

main();

import { Client } from "pg";

const SQL = `
CREATE TABLE IF NOT EXISTS manga(
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name  TEXT NOT NULL UNIQUE,
  genre VARCHAR(100),
  description TEXT, -- Added description column
  image TEXT,
  status BOOLEAN DEFAULT FALSE NOT NULL, 
  bookmark INTEGER
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

-- 1. Insert Authors
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

-- 2. Insert Manga with Descriptions, Official Volume 1 Cover URLs, Status, and Bookmarks
INSERT INTO manga (name, genre, description, image, status, bookmark) VALUES
  (
    'One Piece', 
    'Adventure', 
    'Monkey D. Luffy sets off on an epic adventure with his crew to find the legendary treasure, One Piece, and become the King of the Pirates.',
    'https://images.penguinrandomhouse.com/cover/9781569319017', 
    false, 
    1080
  ),
  (
    'Naruto', 
    'Action', 
    'Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village leader.',
    'https://images.penguinrandomhouse.com/cover/9781569319003', 
    true, 
    700
  ),
  (
    'Attack on Titan', 
    'Dark Fantasy', 
    'In a world where humanity lives inside cities surrounded by enormous walls due to the Titans, Eren Yeager vows to cleanse the earth of them.',
    'https://images.penguinrandomhouse.com/cover/9781612620244', 
    true, 
    139
  ),
  (
    'Bleach', 
    'Supernatural', 
    'Ichigo Kurosaki is a teenager who can see ghosts, a talent that allows him to cross paths with Rukia Kuchiki, a Soul Reaper.',
    'https://images.penguinrandomhouse.com/cover/9781591164418', 
    true, 
    686
  ),
  (
    'Sailor Moon', 
    'Magical Girl', 
    'Usagi Tsukino is a normal girl until she meets a talking cat named Luna, who grants her the power to transform into Sailor Moon to fight evil.',
    'https://images.penguinrandomhouse.com/cover/9781646512010', 
    true, 
    60
  ),
  (
    'Fullmetal Alchemist', 
    'Steampunk', 
    'Two brothers use alchemy in an attempt to bring their deceased mother back to life, resulting in a horrific toll on their bodies.',
    'https://images.penguinrandomhouse.com/cover/9781591169208', 
    true, 
    108
  ),
  (
    'Demon Slayer', 
    'Dark Fantasy', 
    'Tanjiro Kamado sets out to become a demon slayer after his family is slaughtered and his younger sister Nezuko is turned into a demon.',
    'https://images.penguinrandomhouse.com/cover/9781974700523', 
    true, 
    205
  ),
  (
    'Death Note', 
    'Psychological Thriller', 
    'An intelligent high school student stumbles upon a mysterious notebook that has the power to kill anyone whose name is written in it.',
    'https://images.penguinrandomhouse.com/cover/9781421501680', 
    true, 
    108
  ),
  (
    'My Hero Academia', 
    'Superhero', 
    'In a world where most of the human population possesses superpowers, Izuku Midoriya dreams of becoming a hero despite being born without one.',
    'https://images.penguinrandomhouse.com/cover/9781421582696', 
    true, 
    430
  ),
  (
    'Jujutsu Kaisen', 
    'Dark Fantasy', 
    'Yuji Itadori swallows a cursed finger to save his friends, becoming the host of a powerful Curse and joining a secret organization of Jujutsu Sorcerers.',
    'https://images.penguinrandomhouse.com/cover/9781974710027', 
    false, 
    250
  )
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description, -- Added to the conflict update clause
  status = EXCLUDED.status,
  bookmark = EXCLUDED.bookmark;

-- 3. Map Many-to-Many Relationships Dynamically
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
    console.log("..seeding database with 10 records");
    await client.connect();
    await client.query(SQL);
    console.log("...done seeding successfully!");
  } catch (e) {
    throw new Error("Failed to seed database", { cause: e });
  } finally {
    await client.end();
  }
}

main();

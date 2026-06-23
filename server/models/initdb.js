import { Client } from "pg";

const SQL = `
CREATE TABLE IF NOT EXISTS manga(
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name  TEXT NOT NULL UNIQUE, --cannot be unique when you have multiple user id pointing to this table later
  genre VARCHAR(100),
  description TEXT,
  image TEXT,
  status BOOLEAN DEFAULT FALSE NOT NULL, 
  bookmark INTEGER,
  rating SMALLINT CHECK (rating >= 0 AND rating <= 5)
);

INSERT INTO manga (name, genre, description, image, status, bookmark, rating) VALUES
  (
    'One Piece', 
    'Adventure', 
    'A stretchy idiot with zero navigation skills somehow convinces people to sail with him to the end of the world. 1080 chapters in and I still cannot stop. Eiichiro Oda has not slept since 1997 and it shows in the best possible way.',
    'https://images.penguinrandomhouse.com/cover/9781569319017', 
    false, 
    1080,
    5
  ),
  (
    'Naruto', 
    'Action', 
    'Loud kid with a demon fox inside him wants adults to acknowledge him so badly it physically hurts to watch. Made me ugly cry at least four times. The talk no jutsu is ridiculous and I respect it.',
    'https://images.penguinrandomhouse.com/cover/9781569319003', 
    true, 
    700,
    4
  ),
  (
    'Attack on Titan', 
    'Dark Fantasy', 
    'Naked giants eat people for breakfast and humanity is cooked. Angry boy with the worst luck in fiction decides to do something about it. Has one of the most unhinged plot twists in manga history and I am still not over it.',
    'https://images.penguinrandomhouse.com/cover/9781612620244', 
    true, 
    139,
    5
  ),
  (
    'Bleach', 
    'Supernatural', 
    'Scowling teenager gets voluntold into becoming a ghost cop and unlocks a cool new form every three chapters like he is opening loot boxes. The Bankai arc broke my brain in a good way. Tite Kubo drew the drip first and asked questions never.',
    'https://images.penguinrandomhouse.com/cover/9781591164418', 
    true, 
    686,
    4
  ),
  (
    'Sailor Moon', 
    'Magical Girl', 
    'Clumsy crybaby finds out she is actually the chosen one destined to protect the entire universe. Still cries. Still wins. An absolute icon and the blueprint for every magical girl that came after. Non-negotiable.',
    'https://images.penguinrandomhouse.com/cover/9781646512010', 
    true, 
    60,
    4
  ),
  (
    'Fullmetal Alchemist', 
    'Steampunk', 
    'Two brothers try to science-magic their dead mum back to life and immediately regret every decision they have ever made. Hiromu Arakawa cooked so hard with this one that it should be illegal. Genuinely one of the greatest stories ever written and I will not be taking questions.',
    'https://images.penguinrandomhouse.com/cover/9781591169208', 
    true, 
    108,
    5
  ),
  (
    'Demon Slayer', 
    'Dark Fantasy', 
    'Purest boy alive joins a demon murder cult to save his sister who is, unfortunately, now a demon. The art goes stupid hard every single chapter. Cried at the Rengoku arc. Anyone who claims they did not is a liar and a coward.',
    'https://images.penguinrandomhouse.com/cover/9781974700523', 
    true, 
    205,
    4
  ),
  (
    'Death Note', 
    'Psychological Thriller', 
    'Galaxy-brained teenager finds a notebook that kills anyone whose name gets written in it and within five minutes decides he should be God. The cat and mouse with L had me pausing every chapter to figure out who was winning. Absolutely unhinged from start to finish. Peak fiction.',
    'https://images.penguinrandomhouse.com/cover/9781421501680', 
    true, 
    108,
    5
  ),
  (
    'My Hero Academia', 
    'Superhero', 
    'Quirkless kid cries his way into inheriting the most broken power in existence and somehow that is endearing. Still ongoing and still has me in a chokehold. Bakugo carried at least forty percent of this series and that is a hill I will die on.',
    'https://images.penguinrandomhouse.com/cover/9781421582696', 
    true, 
    430,
    4
  ),
  (
    'Jujutsu Kaisen', 
    'Dark Fantasy', 
    'Normal kid eats a cursed finger on a dare, becomes an unkillable vessel for the King of Curses, and enrolls in a school with a genuinely criminal mortality rate. Nobody addresses this. Gojo Satoru alone is reason enough to read this. Currently ongoing and already responsible for significant emotional damage.',
    'https://images.penguinrandomhouse.com/cover/9781974710027', 
    false, 
    250,
    5
  ),(
    'Dandadan', 
    'Supernatural', 
    'A girl who believes in ghosts but not aliens meets a boy who believes in aliens but not ghosts. They fight over it, get cursed by a turbo granny, and the boy loses his family jewels to an alien. It is completely unhinged and beautifully drawn.',
    'https://images.penguinrandomhouse.com/cover/9781974734634', 
    false, 
    160,
    5
  ),
  (
    'Oshi no Ko', 
    'Drama', 
    'A doctor and his terminal patient get murdered and reincarnated as the twin children of their favorite pop idol. Sounds like a weird fanfic until it turns into a brutal, pitch-black critique of the entertainment industry. Geniunely terrifying.',
    'https://images.penguinrandomhouse.com/cover/9781974739943', 
    true, 
    166,
    5
  ),
  (
    'Haikyu!!', 
    'Sports', 
    'Short kid wants to play volleyball real bad, ends up on a team with his middle school rival. There are no superpowers here, just pure, unadulterated high school sports hype that will make you want to go outside and hit a ball at a wall.',
    'https://images.penguinrandomhouse.com/cover/9781421590660', 
    true, 
    402,
    4
  ),
  (
    'Wistoria Wand And The Sword', 
    'Action', 
    'Loverboy who has a sleeper build tries to get back to love of his life. Turns out he has insane power inside him',
    'https://images.penguinrandomhouse.com/cover/9781646516247', 
    true, 
    278,
    3
  ),
  (
    'The Promised Neverland', 
    'Psychological Thriller', 
    'A bunch of genius orphans live in a beautiful house with a loving foster mom, only to discover they are actually free-range livestock for demons. The first arc is an absolute masterpiece of psychological chess.',
    'https://images.penguinrandomhouse.com/cover/9781421597126', 
    true, 
    181,
    4
  ),
  (
    'Sakamoto Days', 
    'Action', 
    'The legendary greatest assassin of all time fell in love, retired, got fat, and now runs a neighborhood convenience store. If he ever kills anyone again, his wife will divorce him. The fight choreography is John Wick levels of stupidly good.',
    'https://images.penguinrandomhouse.com/cover/9781974728947', 
    false, 
    170,
    5
  ),
  (
    'Bungo Stray Dogs', 
    'Supernatural', 
    'Famous historical literary figures are anime boys with superpowers based on their actual books. Osamu Dazai is a suicidal maniac who treats everything like a joke, and the main kid can turn into a tiger. Unironically incredibly slick.',
    'https://images.penguinrandomhouse.com/cover/9781975303846', 
    false, 
    110,
    4
  ),
  (
    'Look Back', 
    'Drama', 
    'A short, devastating one-shot about two young girls who bond over drawing manga. Tatsuki Fujimoto dialed back his usual chainsaw madness to deliver an emotional sucker punch that will leave you staring at your ceiling for an hour.',
    'https://images.penguinrandomhouse.com/cover/9781974734641', 
    true, 
    1,
    5
  ),
  (
    'Fire Punch', 
    'Dystopian', 
    'Before Chainsaw Man, the author wrote this completely unhinged tragedy about a guy who is permanently on fire due to an undying curse. He just walks through a frozen post-apocalyptic wasteland suffering. It is a wild, bleak ride.',
    'https://images.penguinrandomhouse.com/cover/9781421598185', 
    true, 
    83,
    4
  ),
  (
    'Dorohedoro', 
    'Dark Fantasy', 
    'A guy with a lizard head and amnesia spends his time hunting down sorcerers in a grimy city called The Hole to figure out who messed up his face. Gory, surreal, strangely wholesome, and everybody loves gyoza.',
    'https://images.penguinrandomhouse.com/cover/9781421533612', 
    true, 
    167,
    5
  ),
  (
    'Innocent', 
    'Historical', 
    'An incredibly intense, gothic exploration of the Royal Executioner of France during the French Revolution. The art style is so breathtakingly detailed it looks like it belongs in the Louvre, but the subject matter is pure psychological horror.',
    'https://images.penguinrandomhouse.com/cover/9781642861211', 
    true, 
    99,
    4
  ),
  (
    'Blue Lock', 
    'Sports', 
    'Japan decides they are tired of losing the World Cup, so they lock 300 high school strikers in a futuristic prison-academy to breed the ultimate, most selfish, egoist forward. It is basically a battle royale but with soccer balls.',
    'https://images.penguinrandomhouse.com/cover/9781646516544', 
    false, 
    260,
    4
  ),
  (
    'Hell’s Paradise', 
    'Dark Fantasy', 
    'An unkillable ninja on death row is sent to a mystical, terrifying island full of nightmare monsters to find the Elixir of Life. If he succeeds, the shogun pardons him. The executioners paired with criminals dynamic goes incredibly hard.',
    'https://images.penguinrandomhouse.com/cover/9781974713202', 
    true, 
    127,
    4
  ),
  (
    'Baki The Grappler', 
    'Action', 
    'A teenager trains to become stronger than his father, who is basically a demon in human form capable of stopping earthquakes with his bare hands. The anatomy makes absolutely no sense, people fight giant apes, and I love every minute of it.',
    'https://images.penguinrandomhouse.com/cover/9781634424240', 
    false, 
    300,
    3
  ),
  (
    'Monster', 
    'Psychological Thriller', 
    'A brilliant neurosurgeon saves the life of a young boy, only to discover years later that the boy grew up to become a terrifyingly charismatic serial killer. The doctor drops everything to hunt him down across Europe. Pure masterpiece.',
    'https://images.penguinrandomhouse.com/cover/9781421569062', 
    true, 
    162,
    5
  );`;

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

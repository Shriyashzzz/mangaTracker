// The names the site keeps for itself: a reader can't sign up as one or show
// one as their display name (authController signup, accountController
// update). Case, spaces and punctuation don't count: "Manga Tracker" is
// "mangatracker". The owner's own username (ADMIN_USERNAME) is kept too
import config from "../config/config.js";

const RESERVED = [
  "admin",
  "administrator",
  "moderator",
  "support",
  "mangatracker",
  "kenji",
];
const bare = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export const isReservedName = (name: string) => {
  const plain = bare(name);
  if (!plain) return false;
  const owner = config.ADMIN_USERNAME ? bare(config.ADMIN_USERNAME) : null;
  return RESERVED.includes(plain) || plain === owner;
};

// said when one is refused
export const RESERVED_MESSAGE = "That name is kept for the site. Pick another.";

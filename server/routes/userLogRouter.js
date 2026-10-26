import { Router } from "express";
import { checkIfValidSignIn } from "../controller/checkIfValidSignIn.js";
import { signUpController } from "../controller/signUpController.js";
import { requireSignIn } from "../controller/check_auth.js";
import queries from "../models/queries.js";

export const mangaEntryRouter = Router();

mangaEntryRouter.post("/login", checkIfValidSignIn);
mangaEntryRouter.get("/api/me", (req, res) => {
  //checks if the user's userId is currently in the session store
  if (req.session.userId) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

mangaEntryRouter.get("/logout", (req, res) => {
  // destroys the user's session from the session store and clears their auth state
  req.session.destroy((err) => {
    if (err) {
      res.sendStatus(500);
      return;
    } else {
      res.sendStatus(200);
    }
  });
});

mangaEntryRouter.post("/signup", signUpController);

// the values each display preference may take; anything else is ignored
const PREF_VALUES = {
  background: ["sfx", "ink", "pages", "panels"],
  theme: ["light", "dark"],
};

mangaEntryRouter.get("/api/prefs", requireSignIn, async (req, res) => {
  res.json(await queries.getPrefs(req.session.userId));
});

mangaEntryRouter.put("/api/prefs", requireSignIn, async (req, res) => {
  const patch = {};
  for (const [key, allowed] of Object.entries(PREF_VALUES)) {
    if (allowed.includes(req.body?.[key])) patch[key] = req.body[key];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).send("Nothing to save");
    return;
  }
  res.json(await queries.updatePrefs(req.session.userId, patch));
});

export default { mangaEntryRouter };

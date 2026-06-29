import express from "express";
import path from "node:path";
import cors from "cors";
import session from "express-session";
import mangaRouter from "./routes/managaRouter.js";
import { mangaDetailRouter } from "./routes/mangaDetailRouter.js";
import { mangaUpdateRouter } from "./mangaUpdateRouter.js";
import { mangaAddRouter } from "./routes/mangaAddRouter.js";
import { mangaEntryRouter } from "./routes/userLogRouter.js";
import connectPgSimple from "connect-pg-simple";

import { pool } from "./models/pool.js";
const app = express();
const port = process.env.PORT || 8080;

app.set("trust proxy", 1); //  tells express to trust Railway's proxy

app.use(
  cors({
    origin: [process.env.CLIENT_URL], // ensures only the request ocming from this address is accepted
    credentials: true, // allows you to share cookies b/w two differnt origins
  }),
);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    //maxage: sets the time that keeps the cookie valid in the clients browser
    //secure: true only sends the cookie over a secure protocol i.e http's' protocol
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: process.env.ENV === "PROD",
      sameSite: process.env.ENV === "PROD" ? "none" : "lax",
      domain: ".mangatracker.xyz",
    },
    store: new (connectPgSimple(session))({
      pool: pool,
    }),
  }),
);

//middlewares to parse incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//express.json() parses requests where the body is JSON:
//express.urlencoded() parses requests where the body is URL-encoded — the format HTML forms use by default:
// Content-Type: application/x-www-form-urlencoded
// Body: name=Alice&age=30
//Together, they ensure req.body is populated regardless of how the client sends data — whether it's a fetch/axios call sending JSON, or an HTML <form> submission.
// routers
app.use("/", mangaEntryRouter);
app.use("/api/mangadata", mangaRouter.mangaHomeRouter);
app.use("/details/:id", mangaDetailRouter);
app.use("/update/:id", mangaUpdateRouter);
app.use("/add", mangaAddRouter);

app.use((err, req, res, next) => {
  if (
    err.message == "Cannot read properties of undefined (reading 'user_id')"
  ) {
    res.status(401).send("You are not authenticated to see this resource");
    return;
  }
  console.error(err.stack);
  res.status(500).send("Server Error! Please Try again later!");
});
app.listen(port, () => {
  console.log(`server running on http://localhost:${port} `);
});

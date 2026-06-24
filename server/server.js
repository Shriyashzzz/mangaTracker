import express from "express";
import path from "node:path";
import cors from "cors";
import mangaRouter from "./routes/managaRouter.js";
import { mangaDetailRouter } from "./routes/mangaDetailRouter.js";
import { mangaUpdateRouter } from "./routes/mangaUpdateRouter.js";
import { mangaAddRouter } from "./routes/mangaAddRouter.js";
const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: [process.env.CLIENT_URL], // ensures only the request ocming from this address is accepted
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
app.use("/api/mangadata", mangaRouter.mangaHomeRouter);
app.use("/details/:id", mangaDetailRouter);
app.use("/update/:id", mangaUpdateRouter);
app.use("/add", mangaAddRouter);
app.listen(port, () => {
  console.log(`server running on http://localhost:${port} `);
});

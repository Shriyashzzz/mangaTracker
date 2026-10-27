// Entry point: start listening. Everything else is in app.ts.
import { app } from "./app.js";
import config from "./config/config.js";

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
});

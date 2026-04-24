import "dotenv/config";

import { createApp } from "./app";
import { connectToMongo } from "./db";
import { loadEnv } from "./env";

async function main() {
  const env = loadEnv(process.env);
  await connectToMongo(env.MONGODB_URI);

  const app = createApp(env);
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

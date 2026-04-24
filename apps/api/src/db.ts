import mongoose from "mongoose";

export async function connectToMongo(mongoUri: string) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
}


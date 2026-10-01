import mongoose from "mongoose";
import { getEnv } from "./env";

export async function connectMongo() {
  const { MONGO_URL } = getEnv(); // use normalized key from env.ts

  if (!MONGO_URL || typeof MONGO_URL !== "string") {
    throw new Error("MONGO_URL is missing or invalid. Check your .env file.");
  }

  try {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to MongoDB");
  } catch (err: any) {
    // Hide credentials before logging
    const safe = MONGO_URL.replace(/:\/\/[^@]+@/, "://****:****@");
    console.error("Mongo connection failed.");
    console.error("URI:", safe);
    console.error(err);
    process.exit(1);
  }

  mongoose.connection.on("error", (e) => {
    console.error("MongoDB error:", e);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
}

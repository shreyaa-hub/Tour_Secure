// backend/scripts/repair-user-password.ts
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User";

async function main() {
  const email = process.argv[2];
  const newPass = process.argv[3];

  if (!email || !newPass) {
    console.error("Usage: npx ts-node -r dotenv/config scripts/repair-user-password.ts <email> <newPassword>");
    process.exit(1);
  }

  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_ATLAS_URI ||
    "";

  if (!uri) throw new Error("MONGODB_URI (or MONGO_URI) missing in .env");

  await mongoose.connect(uri);

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
  if (!user) throw new Error("User not found: " + email);

  // @ts-ignore password may be excluded by schema normally
  if (user.password) {
    console.log("User already has a password. Nothing to do.");
  } else {
    const hash = await bcrypt.hash(newPass, 10);
    // @ts-ignore
    user.password = hash;
    await user.save();
    console.log("Password set for", email);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

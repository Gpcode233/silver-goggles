import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function requireEnv(
  name: "AUTH_GOOGLE_CLIENT_ID" | "AUTH_GOOGLE_CLIENT_SECRET" | "AUTH_SECRET",
) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const authOptions: NextAuthOptions = {
  secret: requireEnv("AUTH_SECRET"),
  providers: [
    GoogleProvider({
      clientId: requireEnv("AUTH_GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("AUTH_GOOGLE_CLIENT_SECRET"),
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth",
  },
};

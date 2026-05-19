import type {NextAuthOptions} from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? ""
    }),
    FacebookProvider({
      clientId: process.env.AUTH_FACEBOOK_ID ?? "",
      clientSecret: process.env.AUTH_FACEBOOK_SECRET ?? ""
    }),
    LinkedInProvider({
      clientId: process.env.AUTH_LINKEDIN_ID ?? "",
      clientSecret: process.env.AUTH_LINKEDIN_SECRET ?? ""
    })
  ],
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt"
  }
};

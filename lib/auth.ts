import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { firestoreAdapter } from "better-auth-firestore";
import { db } from "./firebase";
import { validateEmail } from "./email-validation";
import { Resend } from "resend"; // เพิ่มการ import

let auth;
const resend = new Resend(process.env.RESEND_API_KEY); // สร้าง instance สำหรับส่งเมล

try {
  // Validate environment variables
  const secret = process.env.BETTER_AUTH_SECRET?.trim().replace(/^"|"$/g, "");
  const baseURL = process.env.BETTER_AUTH_URL?.trim().replace(/^"|"$/g, "") || "http://localhost:3000";
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"|"$/g, "");
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim().replace(/^"|"$/g, "");
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim().replace(/^"|"$/g, "");

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set in .env.local");
  }

  console.log("🔐 Better Auth Configuration Check:");
  console.log(`  ✓ Secret: ${secret ? "✓ Present" : "❌ MISSING"}`);
  console.log(`  ✓ Base URL: ${baseURL}`);
  console.log(`  ✓ Project ID: ${projectId}`);
  console.log(`  ✓ Google OAuth: ${googleClientId && googleClientSecret ? "✓ Configured" : "⚠️  Not configured (optional)"}`);

  auth = betterAuth({
    appName: "Jeng",
    baseURL: baseURL,
    secret: secret,
    basePath: "/api/auth",

    database: firestoreAdapter({
      firestore: db,
      debugLogs: true
    }),

    emailAndPassword: {
      enabled: true,
      autoSignUpEnabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // แก้ไข: ส่งอีเมลจริงผ่าน Resend
        const { error } = await resend.emails.send({
          from: "Jeng App <onboarding@resend.dev>", // ถ้ามีโดเมนส่วนตัวให้เปลี่ยนตรงนี้
          to: [user.email],
          subject: "Verify your email for Jeng App",
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #333;">Welcome to Jeng App! 🚀</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>Please click the button below to verify your email address and activate your account:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Verify My Email
                </a>
              </div>
              <p style="font-size: 12px; color: #666;">Or copy and paste this link in your browser:</p>
              <p style="font-size: 12px; color: #007bff; word-break: break-all;">${url}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
              <p style="font-size: 10px; color: #aaa; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
          `,
        });

        if (error) {
          console.error("❌ Failed to send verification email via Resend:", error);
        } else {
          console.log(`✅ Verification email sent to: ${user.email}`);
        }
      },
    },

    socialProviders: {
      google: {
        clientId: googleClientId || "",
        clientSecret: googleClientSecret || "",
      },
    },

    user: {
      additionalFields: {},
    },

    account: {
      storeStateStrategy: "cookie",
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },

    trustedOrigins: [baseURL],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const email = ctx.body?.email;
          if (!email) {
            throw new APIError("BAD_REQUEST", {
              message: "Email address is required",
            });
          }

          const validation = validateEmail(email);
          if (!validation.isValid) {
            throw new APIError("BAD_REQUEST", {
              message: validation.error || "Invalid email address",
            });
          }
        }
      }),
    },

    rateLimit: {
      enabled: true,
      window: 60,  // 60 second window
      max: 5,      // max 5 sign-in attempts per window
      storage: "memory",
      customRules: {
        "/get-session": false,
      },
    },

    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      disableCSRFCheck: false,
    },
  });

  console.log("✅ Better Auth with Firestore initialized successfully");
} catch (error: unknown) {
  console.error("❌ Failed to initialize Better Auth:", error instanceof Error ? error.message : error);
  throw error;
}

export { auth };
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

export const passwordRecoveryCookieName = "coachos-password-recovery";

export const passwordRecoveryCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 30,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function isPasswordRecoveryNextPath(next: string) {
  return next === "/reset-password";
}

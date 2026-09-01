import { describe, it, expect } from "vitest";
import { parseRecoveryLink, recoveryErrorMessage } from "@/lib/authRecovery";

const BASE = "https://time.releafcarbon.com/reset-password";

describe("parseRecoveryLink", () => {
  it("lit les jetons du flux implicite (fragment)", () => {
    const link = parseRecoveryLink(
      `${BASE}#access_token=abc&refresh_token=def&expires_in=3600&type=recovery`
    );
    expect(link).toEqual({ kind: "implicit", accessToken: "abc", refreshToken: "def" });
  });

  it("lit un token_hash de template personnalisé", () => {
    expect(parseRecoveryLink(`${BASE}?token_hash=xyz&type=recovery`)).toEqual({
      kind: "otp",
      tokenHash: "xyz",
    });
  });

  it("lit un code PKCE", () => {
    expect(parseRecoveryLink(`${BASE}?code=123`)).toEqual({ kind: "pkce", code: "123" });
  });

  // Le client Supabase nettoie l'URL quand le lien est valide, mais la laisse
  // intacte en cas d'erreur : c'est le seul endroit où l'on apprend que le lien
  // a expiré, d'où l'importance de relire le fragment.
  it("reconnaît un lien expiré et donne un message actionnable", () => {
    const link = parseRecoveryLink(
      `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
    );
    expect(link.kind).toBe("error");
    expect(link).toMatchObject({ message: expect.stringContaining("expiré") });
  });

  it("remonte une erreur même sans code d'erreur", () => {
    const link = parseRecoveryLink(`${BASE}?error_description=Something+went+wrong`);
    expect(link).toEqual({ kind: "error", message: "Something went wrong" });
  });

  it("ne voit rien dans une URL nue ou invalide", () => {
    expect(parseRecoveryLink(BASE)).toEqual({ kind: "none" });
    expect(parseRecoveryLink("pas-une-url")).toEqual({ kind: "none" });
  });

  it("ignore un access_token sans refresh_token", () => {
    expect(parseRecoveryLink(`${BASE}#access_token=abc`)).toEqual({ kind: "none" });
  });
});

describe("recoveryErrorMessage", () => {
  it("traduit les codes d'expiration", () => {
    expect(recoveryErrorMessage("otp_expired", null)).toContain("expiré");
    expect(recoveryErrorMessage("access_denied", null)).toContain("expiré");
  });

  it("se rabat sur un message par défaut", () => {
    expect(recoveryErrorMessage(null, null)).toContain("invalide");
  });
});

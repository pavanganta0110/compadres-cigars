/** Providers go live ONLY if APP_ENV=production AND the explicit *_PRODUCTION_APPROVED flag is "true". */
export type ProviderMode = "disabled" | "sandbox" | "live";

export function providerMode(opts: { appEnv: string | undefined; configured: boolean; approved: string | undefined }): ProviderMode {
  if (!opts.configured) return "disabled";
  return opts.appEnv === "production" && opts.approved === "true" ? "live" : "sandbox";
}

/** Mock providers are refused in production regardless of flags. */
export function mockAllowed(appEnv: string | undefined): boolean {
  return appEnv !== "production";
}

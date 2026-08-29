export function getXaiClient(): never {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("not wired: XAI_API_KEY missing (set it in Replit Secrets later)");
  }
  throw new Error("not wired");
}

const apiKey = process.env.XAI_API_KEY;

export function getXaiApiKey(): string | undefined {
  return apiKey;
}

export async function runXai(): Promise<never> {
  throw new Error("not wired");
}
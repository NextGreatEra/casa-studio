function getXaiKey(): string | undefined {
  return process.env.XAI_API_KEY || process.env.XAI_API_Key;
}

export function getXaiApiKey(): string | undefined {
  return getXaiKey();
}

export function hasXaiKey(): boolean {
  return Boolean(getXaiKey());
}

export function getXaiClient(): never {
  if (!getXaiKey()) {
    throw new Error("not wired: XAI_API_KEY / XAI_API_Key missing (Replit Secrets)");
  }
  throw new Error("not wired");
}

/** xAI is the only model provider. Live calls are not wired in this harness. */
export async function runXai(_prompt: string): Promise<never> {
  void getXaiKey();
  throw new Error("not wired");
}

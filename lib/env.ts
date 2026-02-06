export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getSubjects(): string[] {
  const raw = process.env.SUBJECTS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAdminSecret(): string | null {
  return process.env.ADMIN_SECRET ?? null;
}

export type KickUser = { sub: string; role: string } | null;

export type KickContext = {
  user: KickUser;
  env: Record<string, string | undefined>;
  log: (...args: any[]) => void;
};

export type KickEvent = {
  name: string;
  method: "POST";
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
};
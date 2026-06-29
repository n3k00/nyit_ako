type LogLevel = "info" | "warn" | "error";

const REDACTED_KEYS = /token|key|secret|authorization|prompt|profile|history/i;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 160) {
      return `${value.slice(0, 80)}...[redacted:${value.length}]`;
    }
    return value;
  }
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = REDACTED_KEYS.test(key) ? "[redacted]" : redact(entry);
  }
  return output;
}

function write(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...(redact(details) as Record<string, unknown>),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, details?: Record<string, unknown>) =>
    write("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) =>
    write("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) =>
    write("error", event, details),
};

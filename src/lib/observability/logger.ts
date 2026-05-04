type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, event: string, payload: LogPayload = {}) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...payload,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logger(context: LogPayload = {}) {
  return {
    info: (event: string, payload: LogPayload = {}) =>
      emit("info", event, { ...context, ...payload }),
    warn: (event: string, payload: LogPayload = {}) =>
      emit("warn", event, { ...context, ...payload }),
    error: (event: string, payload: LogPayload = {}) =>
      emit("error", event, { ...context, ...payload }),
  };
}

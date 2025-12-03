import winston from "winston";

const { combine, timestamp, json, colorize, printf } = winston.format;

const isDev = process.env.NODE_ENV !== "production";

// 開發環境：彩色 + readable
const devFormat = combine(
  colorize(),
  timestamp(),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// 正式環境：純 JSON，方便 log 平台解析
const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: "info",
  format: isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
    // 如果你不想產生檔案，可以暫時註解掉下面兩個
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

// 小 helper：產生帶 traceId 的 child logger
export function withTrace(traceId?: string | null) {
  if (!traceId) return logger;
  return logger.child({ traceId });
}
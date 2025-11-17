import winston from 'winston';
import path from 'path';

// Define log format with timestamp, level, and message
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'audio-to-calendar' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info'
    }),
    // Write all errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // Write all warnings to warning.log
    new winston.transports.File({
      filename: path.join(logsDir, 'warning.log'),
      level: 'warn'
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// Create a request logger middleware
export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Log incoming request
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any) {
      res.send = originalSend;
      const duration = Date.now() - start;
      
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
      
      return res.send(data);
    };

    next();
  };
};

export default logger;

// utils/asyncHandler.js
const db = require("../config/db");

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ERR_NETWORK",
]);

const NETWORK_ERROR_PATTERNS = [
  /socket hang up/i,
  /network error/i,
  /connection reset/i,
  /aborted/i,
  /fetch failed/i,
  /terminated/i,
];

const isNetworkError = (err) => {
  if (!err) return false;

  const errorText = `${err.code || ""} ${err.message || ""}`.toLowerCase();
  return (
    NETWORK_ERROR_CODES.has(err.code) ||
    NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(errorText)) ||
    err.name === "AbortError" ||
    err.type === "aborted"
  );
};

const buildRetryableErrorResponse = (err) => {
  const isRetryable = isNetworkError(err);
  return {
    success: false,
    message: isRetryable
      ? "The connection dropped. Please retry the request."
      : "The request could not be completed. Please retry.",
    code: isRetryable ? "NETWORK_ERROR" : "REQUEST_FAILED",
  };
};

const createNetworkGuardMiddleware = () => {
  return (req, res, next) => {
    req.isAborted = false;
    req.networkGuardEnabled = true;

    const markAborted = () => {
      req.isAborted = true;
    };

    req.on("close", markAborted);
    req.on("aborted", markAborted);

    if (req.timedout) {
      return res.status(503).json(buildRetryableErrorResponse(new Error("Request timed out")));
    }

    next();
  };
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    let currentConnection = null;

    const cleanupConnection = async () => {
      if (!res.headersSent && currentConnection && currentConnection.threadId) {
        console.log(`Client left! Automatically killing MySQL Thread ID: ${currentConnection.threadId}`);
        try {
          await db.query(`KILL ${currentConnection.threadId}`);
        } catch (killError) {
          console.error("Failed to kill thread:", killError.message);
        }
      }
    };

    req.on("close", cleanupConnection);
    req.on("aborted", cleanupConnection);

    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (req.isAborted || req.aborted || res.headersSent) {
        return;
      }

      if (isNetworkError(err)) {
        return res.status(503).json(buildRetryableErrorResponse(err));
      }

      next(err);
    });
  };
};

module.exports = asyncHandler;
module.exports.createNetworkGuardMiddleware = createNetworkGuardMiddleware;
module.exports.isNetworkError = isNetworkError;
module.exports.buildRetryableErrorResponse = buildRetryableErrorResponse;
module.exports.asyncHandler = asyncHandler;

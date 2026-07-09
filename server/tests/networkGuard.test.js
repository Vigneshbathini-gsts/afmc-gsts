const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createNetworkGuardMiddleware, isNetworkError, buildRetryableErrorResponse } = require('../utils/asyncHandler');

test('createNetworkGuardMiddleware marks aborted requests and reports retryable errors', () => {
  const req = new EventEmitter();
  req.aborted = false;
  req.timedout = false;
  req.isAborted = false;
  req.headersSent = false;

  const res = new EventEmitter();
  res.headersSent = false;
  res.statusCode = 200;
  res.writableEnded = false;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.writableEnded = true;
    return res;
  };

  let nextCalled = false;
  const middleware = createNetworkGuardMiddleware();
  middleware(req, res, () => {
    nextCalled = true;
  });

  req.emit('close');

  assert.equal(req.isAborted, true);
  assert.equal(nextCalled, true);

  const error = new Error('socket hang up');
  error.code = 'ECONNRESET';
  assert.equal(isNetworkError(error), true);
  assert.deepEqual(buildRetryableErrorResponse(error), {
    success: false,
    message: 'The connection dropped. Please retry the request.',
    code: 'NETWORK_ERROR'
  });
});

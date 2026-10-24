// Turns whatever MindAR (or our own code) rejected with into a user message and a log entry.
// MindARThree.start() 1.2.5 rejects with `undefined` when getUserMedia fails, so the rejection value can NOT be trusted to
// be an Error. Measured on Chrome 155 and Firefox 158 (I03-P03 report): reading `err.name` threw a TypeError inside the
// catch block, the camera was never cleaned up and the status stayed on "Loading…". Browser-safe, no DOM access.

const DENIED = 'Camera permission was denied.';
const MESSAGES = {
  NotAllowedError: DENIED,
  SecurityError: DENIED,
  NotFoundError: 'No camera was found.',
  NotReadableError: 'The camera is in use by another app or could not be read.',
  UnsupportedError: 'AR is not supported here (needs HTTPS and camera access).',
  PreparationUnavailable: 'The prepared target is unavailable.',
};
const GENERIC_UNKNOWN = 'AR could not start (the camera was denied or is unavailable).';

const nameOf = (value) => (value && typeof value === 'object' && typeof value.name === 'string' && value.name ? value.name : undefined);
const describe = (value) => (value === undefined ? 'undefined' : value === null ? 'null' : nameOf(value) ? `error:${nameOf(value)}` : typeof value);

/**
 * Order of evidence: the rejected error itself, then the last error our getUserMedia wrapper saw, then the browser's
 * camera permission state, otherwise an honest generic message. Never throws, whatever was rejected.
 */
export function classifyStartFailure({ error, lastGetUserMediaError, cameraPermission } = {}) {
  let name = nameOf(error);
  let source = 'error';
  if (!name) {
    name = nameOf(lastGetUserMediaError);
    source = 'getUserMedia-error';
  }
  if (!name && cameraPermission === 'denied') {
    name = 'NotAllowedError';
    source = 'permissions-api';
  }
  if (!name) {
    name = 'UnknownStartFailure';
    source = 'none';
  }
  return {
    name,
    source,
    rejectedWith: describe(error),
    text: MESSAGES[name] ?? (name === 'UnknownStartFailure' ? GENERIC_UNKNOWN : 'AR failed to start.'),
    denied: name === 'NotAllowedError' || name === 'SecurityError',
    disableStart: name === 'UnsupportedError',
  };
}

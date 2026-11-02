/** Error with a message that is safe to show to the user (never contains URLs or keys). */
export class ApiError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.code = code
    this.status = status
  }
}
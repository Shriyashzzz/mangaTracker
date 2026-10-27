// an error the client is meant to see. `status` becomes the HTTP status and
// `message` is sent as { error: [{ msg }] }, the shape every page reads
export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class UpstreamError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

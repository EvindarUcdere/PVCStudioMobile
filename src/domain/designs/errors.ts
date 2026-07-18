export class DomainValidationError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = options?.cause;
  }
}

export class EntityNotFoundError extends RepositoryError {
  constructor(entityName: string, id: string) {
    super(`${entityName} not found: ${id}`);
    this.name = 'EntityNotFoundError';
  }
}

export class DataCorruptionError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataCorruptionError';
  }
}

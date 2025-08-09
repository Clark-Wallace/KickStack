export declare enum ErrorType {
    DOCKER_NOT_RUNNING = "DOCKER_NOT_RUNNING",
    SERVICE_NOT_RUNNING = "SERVICE_NOT_RUNNING",
    DATABASE_CONNECTION = "DATABASE_CONNECTION",
    DATABASE_AUTH = "DATABASE_AUTH",
    DATABASE_MISSING = "DATABASE_MISSING",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    INVALID_SYNTAX = "INVALID_SYNTAX",
    TEMPLATE_ERROR = "TEMPLATE_ERROR",
    MIGRATION_ERROR = "MIGRATION_ERROR",
    UNKNOWN = "UNKNOWN"
}
export interface KickStackError {
    type: ErrorType;
    message: string;
    originalError?: Error;
    suggestions?: string[];
    context?: Record<string, any>;
}
export declare class ErrorHandler {
    static categorizeError(error: Error, context?: Record<string, any>): KickStackError;
    static formatError(kickStackError: KickStackError): string;
    static handleError(error: Error, context?: Record<string, any>): never;
    static logWarning(message: string, suggestions?: string[]): void;
    static validateEnvironment(): Promise<void>;
}
//# sourceMappingURL=error-handler.d.ts.map
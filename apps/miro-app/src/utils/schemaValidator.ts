/**
 * Schema Validator
 * 
 * Simple JSON schema validation utility
 */

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Validation error */
export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

/** Simple schema definition */
export interface Schema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: unknown[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | Schema;
}

/**
 * Validate a value against a schema
 */
export function validate(value: unknown, schema: Schema, path = ''): ValidationResult {
  const errors: ValidationError[] = [];

  // Type check
  const actualType = getType(value);
  if (actualType !== schema.type) {
    if (!(schema.type === 'null' && value === null)) {
      errors.push({
        path: path || 'root',
        message: `Expected type "${schema.type}", got "${actualType}"`,
        value,
      });
      return { valid: false, errors };
    }
  }

  // Object validation
  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Check required properties
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Missing required property "${key}"`,
          });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propPath = path ? `${path}.${key}` : key;
          const result = validate(obj[key], propSchema, propPath);
          errors.push(...result.errors);
        }
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Additional property "${key}" is not allowed`,
          });
        }
      }
    }
  }

  // Array validation
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = `${path}[${i}]`;
        const result = validate(value[i], schema.items, itemPath);
        errors.push(...result.errors);
      }
    }
  }

  // String validation
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path: path || 'root',
          message: `Value does not match pattern "${schema.pattern}"`,
          value,
        });
      }
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path: path || 'root',
        message: `String length must be at least ${schema.minLength}`,
        value,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path: path || 'root',
        message: `String length must be at most ${schema.maxLength}`,
        value,
      });
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path: path || 'root',
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }
  }

  // Number validation
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path: path || 'root',
        message: `Value must be at least ${schema.minimum}`,
        value,
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path: path || 'root',
        message: `Value must be at most ${schema.maximum}`,
        value,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the type of a value for schema comparison
 */
function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Create a validator function for a schema
 */
export function createValidator(schema: Schema): (value: unknown) => ValidationResult {
  return (value: unknown) => validate(value, schema);
}

import { z } from "zod";

// Minimal Zod -> JSON Schema converter covering the shapes used by Product-Advisor
// tools: objects, strings (with enums), numbers (with int/min/max), arrays,
// booleans, records, optionals, and .describe() metadata. Avoids adding a
// dependency.

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(s: z.ZodTypeAny): Record<string, unknown> {
  const description = (s._def as { description?: string }).description;

  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convert(value);
      if (!isOptional(value)) required.push(key);
    }
    const out: Record<string, unknown> = {
      type: "object",
      properties,
    };
    if (required.length) out.required = required;
    if (description) out.description = description;
    return out;
  }

  if (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    const inner = (s._def as { innerType: z.ZodTypeAny }).innerType;
    const converted = convert(inner);
    if (description && !converted.description) converted.description = description;
    return converted;
  }

  if (s instanceof z.ZodNullable) {
    const inner = (s._def as { innerType: z.ZodTypeAny }).innerType;
    return convert(inner);
  }

  if (s instanceof z.ZodEnum) {
    return withDescription({ type: "string", enum: (s._def as { values: string[] }).values }, description);
  }

  if (s instanceof z.ZodString) {
    return withDescription({ type: "string" }, description);
  }

  if (s instanceof z.ZodNumber) {
    const def = s._def as { checks?: { kind: string; value?: number }[] };
    const out: Record<string, unknown> = { type: "number" };
    for (const c of def.checks || []) {
      if (c.kind === "int") out.type = "integer";
      if (c.kind === "min" && typeof c.value === "number") out.minimum = c.value;
      if (c.kind === "max" && typeof c.value === "number") out.maximum = c.value;
    }
    return withDescription(out, description);
  }

  if (s instanceof z.ZodBoolean) {
    return withDescription({ type: "boolean" }, description);
  }

  if (s instanceof z.ZodArray) {
    const inner = (s._def as { type: z.ZodTypeAny }).type;
    return withDescription({ type: "array", items: convert(inner) }, description);
  }

  if (s instanceof z.ZodRecord) {
    const valueType = (s._def as { valueType: z.ZodTypeAny }).valueType;
    return withDescription(
      { type: "object", additionalProperties: convert(valueType) },
      description,
    );
  }

  if (s instanceof z.ZodUnknown || s instanceof z.ZodAny) {
    return withDescription({}, description);
  }

  // Fallback: accept anything.
  return withDescription({}, description);
}

function isOptional(s: z.ZodTypeAny): boolean {
  return s instanceof z.ZodOptional || s instanceof z.ZodDefault;
}

function withDescription(
  obj: Record<string, unknown>,
  description?: string,
): Record<string, unknown> {
  if (description) obj.description = description;
  return obj;
}

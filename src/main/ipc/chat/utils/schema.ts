import { StructuredOutputSchema } from "../types";

export function buildJsonSchema(schema: StructuredOutputSchema): object {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const prop of schema.properties) {
    let propSchema: any;

    if (prop.isArray) {
      propSchema = {
        type: "array",
        items: { type: prop.type === "array" ? "string" : prop.type },
      };
    } else {
      propSchema = { type: prop.type };
    }

    properties[prop.name] = propSchema;

    if (prop.isRequired) {
      required.push(prop.name);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

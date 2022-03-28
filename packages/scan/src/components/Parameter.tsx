import { useState, useEffect } from "react";
import { useFormContext, useController } from "react-hook-form";
import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";

import type { OasSchema, ResolvedOasParameter } from "@xliic/common/oas30";

export default function Parameter({
  name,
  parameter,
  schema,
}: {
  name: string;
  parameter: ResolvedOasParameter;
  schema: OasSchema;
}) {
  const { control } = useFormContext();

  const {
    field,
    fieldState: { isTouched, isDirty, error },
    formState: { touchedFields, dirtyFields },
  } = useController({
    name,
    control,
    rules: {
      validate: (value) => validate(schema, value),
    },
  });

  const [value, setValue] = useState(convertDataToForm(schema, field.value));

  useEffect(() => {
    setValue(convertDataToForm(schema, field.value));
  }, [control._defaultValues]);

  return (
    <>
      <FloatingLabel className="m-1" label={parameter.name}>
        <Form.Control
          type="text"
          className={error ? "is-invalid" : undefined}
          onChange={(e) => {
            field.onChange(convertFormToData(schema, e.target.value));
            setValue(e.target.value);
          }}
          onBlur={field.onBlur}
          value={value}
          ref={field.ref}
        />
        {error && <div className="invalid-feedback">{error.message}</div>}
      </FloatingLabel>
    </>
  );
}

function validate(schema: OasSchema, value: any): any {
  if (value instanceof Error) {
    return value.message;
  }
}

function convertDataToForm(schema: OasSchema, value: any): string {
  if (value === undefined) {
    return "";
  }

  const type = schema.type;
  if (
    type === undefined ||
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean"
  ) {
    return `${value}`;
  }

  // object or array
  return JSON.stringify(value);
}

function convertFormToData(schema: OasSchema, value: any): any {
  const type = schema.type;
  if (type === undefined || type === "string") {
    return value;
  }
  if (type === "integer") {
    return convertToInteger(value);
  }
  if (type === "number") {
    return convertToNumber(value);
  }
  if (type === "boolean") {
    return value == "true" ? true : false;
  }
  if (type === "object" || type === "array") {
    return convertToObjectOrArray(value);
  }
  return new Error(`failed to convert, unsupported type: ${type}`);
}

function convertToInteger(value: string): number | Error {
  const converted = Number.parseInt(value, 10);
  return isNaN(converted) ? new Error("failed to convert to 'integer'") : converted;
}

function convertToNumber(value: string): number | Error {
  const converted = Number.parseFloat(value);
  return isNaN(converted) ? new Error("failed to convert to 'number'") : converted;
}

function convertToObjectOrArray(value: string): number | Error {
  try {
    return JSON.parse(value);
  } catch (e) {
    return new Error(`failed to convert: ${e}`);
  }
}

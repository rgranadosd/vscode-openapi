import { JSONPath } from "jsonpath-plus";
import { Cookie } from "tough-cookie";

import { Environment } from "@xliic/common/env";
import { HttpRequest, HttpResponse } from "@xliic/common/http";
import { find } from "@xliic/preserving-json-yaml-parser";
import { Playbook } from "@xliic/scanconf";
import { NullableResult, Result } from "@xliic/result";

import {
  PlaybookEnv,
  PlaybookEnvStack,
  PlaybookVariableAssignments,
  PlaybookVariableFailedAssignment,
} from "./playbook-env";
import { MockHttpResponse, MockHttpResponseType } from "./mock-http";

export function assignVariables(
  id: string,
  responses: Playbook.Responses | undefined,
  httpRequest: HttpRequest,
  httpResponse: HttpResponse | MockHttpResponseType,
  parameters: Playbook.ParameterValues
): Result<PlaybookEnvStack, string> {
  const result: PlaybookEnvStack = [];

  if (responses === undefined) {
    return [[], undefined];
  }

  const matchingResponses = extractMatchingResponses(responses, httpResponse);

  for (const [code, response] of matchingResponses) {
    const [env, assignmentError] = assignValues(
      `${id}-${code}`,
      response,
      httpRequest,
      httpResponse,
      parameters
    );

    if (assignmentError !== undefined) {
      return [
        undefined,
        `failed to assign variables for response code: ${code}: ${assignmentError}`,
      ];
    }

    result.push(env);
  }

  return [result, undefined];
}

function extractMatchingResponses(
  responses: Playbook.Responses,
  httpResponse: HttpResponse | MockHttpResponseType
): [string, Playbook.Response][] {
  const result: [string, Playbook.Response][] = [];
  const codes = Object.keys(responses).sort(httpStatusSort);
  for (const code of codes) {
    if (checkResponseCodeMatch(code, httpResponse)) {
      result.push([code, responses[code]]);
    }
  }
  return result;
}

function checkResponseCodeMatch(
  code: string,
  httpResponse: HttpResponse | MockHttpResponseType
): boolean {
  // return all Responses if we have MockHttpResponse
  return (
    httpResponse === MockHttpResponse ||
    httpResponse.statusCode.toString() === code ||
    getHttpStatusCategory(httpResponse.statusCode) === code
  );
}

function assignValues(
  id: string,
  response: Playbook.Response,
  httpRequest: HttpRequest,
  httpResponse: HttpResponse | MockHttpResponseType,
  parameters: Playbook.ParameterValues
): Result<PlaybookEnv, string> {
  const env: Environment = {};
  const result: PlaybookVariableAssignments = [];
  for (const [varname, assignment] of Object.entries(response.variableAssignments || {})) {
    const [value, valueError] = extractValue(assignment, httpRequest, httpResponse, parameters);
    if (valueError !== undefined) {
      return [
        undefined,
        `Failed to extract value for variable '${varname}' in context '${id}': ${valueError}`,
      ];
    }

    if (value !== undefined) {
      env[varname] = value;
      result.push({ name: varname, value, error: undefined });
    } else {
      result.push({ name: varname, error: "not found", value: undefined, assignment });
    }
  }

  return [{ id, env, assignments: result }, undefined];
}

function extractValue(
  assignment: Playbook.VariableAssignment,
  httpRequest: HttpRequest,
  httpResponse: HttpResponse | MockHttpResponseType,
  parameters: Playbook.ParameterValues
): NullableResult<unknown, string> {
  // in case of mock response simply pretend that we've successfully extracted
  // a value for any given assignment
  if (httpResponse === MockHttpResponse) {
    return ["foo", undefined];
  }

  if (assignment.in === "body" && assignment?.path?.type == "jsonPointer") {
    if (assignment.from === "request") {
      return extractByJsonPointer(httpRequest.body as string, assignment.path.value);
    } else {
      return extractByJsonPointer(httpResponse.body as string, assignment.path.value);
    }
  } else if (assignment.in === "body" && assignment?.path?.type == "jsonPath") {
    if (assignment.from === "request") {
      return extractByJsonPath(httpRequest.body as string, assignment.path.value);
    } else {
      return extractByJsonPath(httpResponse.body as string, assignment.path.value);
    }
  } else if (assignment.in === "header") {
    if (assignment.from === "request") {
      return extractFromRequestHeaders(httpRequest.headers, assignment.name);
    } else {
      return extractFromResponseHeaders(httpResponse.headers, assignment.name);
    }
  } else if (assignment.in === "cookie") {
    if (assignment.from === "request") {
      return extractFromRequestCookies(httpRequest.headers, assignment.name);
    } else {
      return extractFromResponseCookies(httpResponse.headers, assignment.name);
    }
  } else if (assignment.in === "query") {
    if (assignment.from === "request") {
      return extractFromRequestParameters(parameters.query, assignment.name);
    } else {
      // not allowed
    }
  } else if (assignment.in === "path") {
    if (assignment.from === "request") {
      return extractFromRequestParameters(parameters.path, assignment.name);
    } else {
      // not allowed
    }
  }

  return [undefined, `unsupported assignment: from ${assignment.from} in ${assignment.in}`];
}

function extractByJsonPointer(from: string, pointer: string): NullableResult<unknown, string> {
  try {
    const parsed = JSON.parse(from);
    const value = find(parsed, pointer);
    return [value, undefined];
  } catch (e) {
    return [undefined, `Failed to extract value using JSON Pointer "${pointer}": ${e}`];
  }
}

function extractByJsonPath(from: string, path: string): NullableResult<unknown, string> {
  try {
    const parsed = JSON.parse(from);
    const result = JSONPath({ json: parsed, path });
    return [result?.[0], undefined];
  } catch (e) {
    return [undefined, `Failed to extract value using JSON Path "${path}": ${e}`];
  }
}

function extractFromRequestHeaders(
  container: Record<string, string>,
  name: string
): NullableResult<unknown, string> {
  for (const [key, value] of Object.entries(container)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return [value, undefined];
    }
  }

  return [undefined, `Failed to find request header name: ${name}`];
}

function extractFromResponseHeaders(
  container: [string, string][],
  name: string
): NullableResult<unknown, string> {
  for (const [key, value] of container) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return [value, undefined];
    }
  }

  return [undefined, `Failed to find response header name: ${name}`];
}

function extractFromResponseCookies(
  container: [string, string][],
  name: string
): NullableResult<unknown, string> {
  for (const [key, value] of container) {
    if (key.toLowerCase() === "set-cookie") {
      const cookie = Cookie.parse(value);
      if (cookie !== undefined && cookie.key === name) {
        return [cookie.value, undefined];
      }
    }
  }

  return [undefined, `Failed to find response cookie name: ${name}`];
}

function extractFromRequestCookies(
  container: Record<string, string>,
  name: string
): NullableResult<unknown, string> {
  for (const [key, value] of Object.entries(container)) {
    if (key.toLowerCase() === "cookie") {
      const cookiePairs = value.split("; ");
      for (const cookiePair of cookiePairs) {
        const cookie = Cookie.parse(cookiePair);
        if (cookie !== undefined && cookie.key === name) {
          return [cookie.value, undefined];
        }
      }
    }
  }

  return [undefined, `Failed to find request cookie name: ${name}`];
}

function extractFromRequestParameters(
  container: Playbook.ParameterList,
  name: string
): NullableResult<unknown, string> {
  for (const { key, value } of container) {
    if (key === name) {
      return [value, undefined];
    }
  }
  return [undefined, `Failed to find request query parameter name: ${name}`];
}

function httpStatusSort(a: string, b: string): number {
  const sortingOrder: { [status: string]: number } = {
    default: 0,
    "1XX": 1,
    "2XX": 2,
    "3XX": 3,
    "4XX": 4,
    "5XX": 5,
  };

  const orderA = a in sortingOrder ? sortingOrder[a] : Number.MAX_SAFE_INTEGER;
  const orderB = b in sortingOrder ? sortingOrder[b] : Number.MAX_SAFE_INTEGER;

  return orderA - orderB;
}

export function getHttpStatusCategory(httpStatus: number): string {
  if (httpStatus >= 100 && httpStatus <= 199) {
    return "1XX";
  } else if (httpStatus >= 200 && httpStatus <= 299) {
    return "2XX";
  } else if (httpStatus >= 300 && httpStatus <= 399) {
    return "3XX";
  } else if (httpStatus >= 400 && httpStatus <= 499) {
    return "4XX";
  } else if (httpStatus >= 500 && httpStatus <= 599) {
    return "5XX";
  } else {
    return "default";
  }
}

export function failedAssigments(env: PlaybookEnvStack): PlaybookVariableFailedAssignment[] {
  const result: PlaybookVariableFailedAssignment[] = [];
  for (const { assignments } of env) {
    for (const assignment of assignments) {
      if (assignment.error !== undefined) {
        result.push(assignment);
      }
    }
  }
  return result;
}

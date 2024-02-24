import { Swagger, HttpMethod } from "@xliic/openapi";

export function getParameters(
  oas: Swagger.BundledSwaggerSpec,
  path: string,
  method: HttpMethod
): Swagger.OperationParametersMap {
  const pathParameters = Swagger.getPathItemParameters(oas, oas.paths[path]);
  const operation = Swagger.getOperation(oas, path, method);
  const operationParameters = Swagger.getOperationParameters(oas, operation);
  const result = Swagger.getParametersMap(oas, pathParameters, operationParameters);
  return result;
}

export function hasSecurityRequirements(
  oas: Swagger.BundledSwaggerSpec,
  path: string,
  method: HttpMethod
): boolean {
  const operation = Swagger.getOperation(oas, path, method);
  const requirements = operation?.security ?? oas.security ?? [];
  return requirements.length > 0;
}

export function getSecurity(
  oas: Swagger.BundledSwaggerSpec,
  path: string,
  method: HttpMethod
): Swagger.ResolvedSwaggerOperationSecurity {
  const operation = Swagger.getOperation(oas, path, method);
  const requirements = operation?.security ?? oas.security ?? [];
  const result: Swagger.ResolvedSwaggerOperationSecurity = [];
  for (const requirement of requirements) {
    const resolved: Record<string, Swagger.SwaggerSecurityScheme> = {};
    for (const schemeName of Object.keys(requirement)) {
      // check if the requsted security scheme is defined in the OAS
      if (oas?.securityDefinitions?.[schemeName]) {
        resolved[schemeName] = oas?.securityDefinitions?.[schemeName]!;
      }
    }
    result.push(resolved);
  }
  return result;
}

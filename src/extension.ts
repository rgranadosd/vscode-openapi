/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as vscode from "vscode";
import * as semver from "semver";
import { configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./types";
import { parserOptions } from "./parser-options";
import { registerOutlines } from "./outline";
import { JsonSchemaDefinitionProvider, YamlSchemaDefinitionProvider } from "./reference";
import {
  ExternalRefDocumentProvider,
  ApproveHostnameAction,
  registerAddApprovedHost,
} from "./external-ref-provider";
import { CompletionItemProvider } from "./completion";
import { updateContext } from "./context";
import { registerCommands } from "./commands";
import { create as createWhatsNewPanel } from "./whatsnew";
import { Cache } from "./cache";

import * as yamlSchemaContributor from "./yaml-schema-contributor";
import * as audit from "./audit/activate";
import * as preview from "./preview";

/*
 FIXME: this probably should be removed, - it shows general parsing errors 
which are shown anyways by json/yaml plugins
async function updateDiagnostics(current: CacheEntry, diagnostics: vscode.DiagnosticCollection) {
  if (current.errors) {
    diagnostics.set(current.uri, current.errors);
    vscode.commands.executeCommand("setContext", "openapiErrors", true);
  } else {
    diagnostics.delete(current.uri);
    vscode.commands.executeCommand("setContext", "openapiErrors", false);
  }
}
*/

export function activate(context: vscode.ExtensionContext) {
  const versionProperty = "openapiVersion";
  const openapiExtension = vscode.extensions.getExtension(extensionQualifiedId);
  const currentVersion = semver.parse(openapiExtension.packageJSON.version);
  const previousVersion = context.globalState.get<string>(versionProperty)
    ? semver.parse(context.globalState.get<string>(versionProperty))
    : semver.parse("0.0.1");
  const yamlConfiguration = new Configuration("yaml");
  context.globalState.update(versionProperty, currentVersion.toString());
  parserOptions.configure(yamlConfiguration);

  const selectors = {
    json: { language: "json" },
    jsonc: { language: "jsonc" },
    yaml: { language: "yaml" },
  };

  const cache = new Cache(parserOptions, Object.values(selectors));

  cache.onDidActiveDocumentChange((document) => updateContext(cache, document));
  // FIXME decide what to do in case of parsing errors in OAS
  // cache.onDidChange((entry) => updateDiagnostics(entry, runtimeContext.diagnostics));

  context.subscriptions.push(...registerOutlines(context, cache));
  context.subscriptions.push(...registerCommands(cache));
  context.subscriptions.push(registerAddApprovedHost(context));

  const completionProvider = new CompletionItemProvider(context, cache);
  for (const selector of Object.values(selectors)) {
    vscode.languages.registerCompletionItemProvider(selector, completionProvider, '"');
  }

  const jsonSchemaDefinitionProvider = new JsonSchemaDefinitionProvider(cache);
  const yamlSchemaDefinitionProvider = new YamlSchemaDefinitionProvider(cache);

  vscode.languages.registerDefinitionProvider(selectors.json, jsonSchemaDefinitionProvider);
  vscode.languages.registerDefinitionProvider(selectors.jsonc, jsonSchemaDefinitionProvider);
  vscode.languages.registerDefinitionProvider(selectors.yaml, yamlSchemaDefinitionProvider);

  // FIXME a part of OAS parsing diagnostics handling
  //vscode.workspace.onDidCloseTextDocument((document) => {
  //  runtimeContext.diagnostics.delete(document.uri);
  //});

  const externalRefProvider = new ExternalRefDocumentProvider();
  vscode.workspace.registerTextDocumentContentProvider(
    "openapi-external-http",
    externalRefProvider
  );
  vscode.workspace.registerTextDocumentContentProvider(
    "openapi-external-https",
    externalRefProvider
  );

  const approveHostnameAction = new ApproveHostnameAction();
  for (const selector of Object.values(selectors)) {
    vscode.languages.registerCodeActionsProvider(selector, approveHostnameAction, {
      providedCodeActionKinds: ApproveHostnameAction.providedCodeActionKinds,
    });
  }

  vscode.window.onDidChangeActiveTextEditor((e) => cache.onActiveEditorChanged(e));
  vscode.workspace.onDidChangeTextDocument((e) => cache.onDocumentChanged(e));

  yamlSchemaContributor.activate(context, cache);
  audit.activate(context, cache);
  preview.activate(context, cache);

  if (previousVersion.major < currentVersion.major) {
    createWhatsNewPanel(context);
  }

  configuration.configure(context);
  yamlConfiguration.configure(context);

  if (vscode.window.activeTextEditor) {
    cache.onActiveEditorChanged(vscode.window.activeTextEditor);
  }
}

export function deactivate() {}

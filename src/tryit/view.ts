/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as vscode from "vscode";

import { OasWithOperation } from "@xliic/common/tryit";
import { Preferences } from "@xliic/common/prefs";

import { Webapp } from "@xliic/common/webapp/tryit";

import { WebView } from "../web-view";
import { executeHttpRequest } from "./http-handler";
import { executeCreateSchemaRequest } from "./create-schema-handler";
import { Cache } from "../cache";
import { EnvStore } from "../envstore";

export function getWebview(
  extensionPath: string,
  cache: Cache,
  envStore: EnvStore,
  prefs: Record<string, Preferences>,
  document: vscode.TextDocument,
  existingView: TryItWebView | undefined
): TryItWebView {
  if (existingView !== undefined) {
    existingView.setDocument(document);
    return existingView;
  }

  return new TryItWebView(extensionPath, cache, envStore, prefs, document);
}

export class TryItWebView extends WebView<Webapp> {
  hostHandlers: Webapp["hostHandlers"] = {
    sendHttpRequest: executeHttpRequest,
    createSchema: async (response: any) => {
      executeCreateSchemaRequest(this.document, this.cache, response);
    },
    saveConfig: async (config: any) => {
      vscode.workspace
        .getConfiguration("openapi")
        .update("tryit.insecureSslHostnames", config.insecureSslHostnames);
    },
    savePrefs: async (prefs: Preferences) => {
      this.prefs[this.document.uri.toString()] = {
        ...this.prefs[this.document.uri.toString()],
        ...prefs,
      };
    },
    showEnvWindow: async () => {
      vscode.commands.executeCommand("openapi.showEnvironment");
    },
  };

  constructor(
    extensionPath: string,
    private cache: Cache,
    private envStore: EnvStore,
    private prefs: Record<string, Preferences>,
    private document: vscode.TextDocument
  ) {
    super(extensionPath, "tryit", "Try It", vscode.ViewColumn.Two, false);
    envStore.onEnvironmentDidChange((env) => {
      if (this.isActive()) {
        this.sendRequest({
          command: "loadEnv",
          payload: { default: undefined, secrets: undefined, [env.name]: env.environment },
        });
      }
    });
    vscode.window.onDidChangeActiveColorTheme((e) => {
      if (this.isActive()) {
        this.sendColorTheme(e);
      }
    });
  }

  setDocument(document: vscode.TextDocument) {
    this.document = document;
  }

  async sendTryOperation(payload: OasWithOperation) {
    this.sendRequest({ command: "loadEnv", payload: await this.envStore.all() });
    const prefs = this.prefs[this.document.uri.toString()];
    if (prefs) {
      this.sendRequest({ command: "loadPrefs", payload: prefs });
    }
    return this.sendRequest({ command: "tryOperation", payload });
  }
}

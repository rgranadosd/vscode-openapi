/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as vscode from "vscode";
import { OpenApiVersion } from "../../types";
import { PlatformStore } from "../stores/platform-store";

export class DataDictionaryCompletionProvider implements vscode.CompletionItemProvider {
  version: OpenApiVersion = OpenApiVersion.Unknown;
  constructor(private store: PlatformStore) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ) {
    const line = document.lineAt(position).text;
    if (!line.includes("x-42c-format")) {
      return undefined;
    }

    const quote = document.languageId === "yaml" ? "" : '"';
    const formats = await this.store.getDataDictionaryFormats();

    const completions = formats.map(
      (format) =>
        new vscode.CompletionItem(
          { label: `${quote}${format.name}${quote}`, description: format.description },
          vscode.CompletionItemKind.Value
        )
    );

    return completions;
  }
}

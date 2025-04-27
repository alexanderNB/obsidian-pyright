import { Plugin, MarkdownView, WorkspaceLeaf } from "obsidian";
// import { MarkdownRenderer, editorEditorField, editorInfoField, editorLivePreviewField } from "obsidian";
import { EditorView, ViewUpdate, Decoration, DecorationSet, WidgetType, ViewPlugin, PluginValue } from "@codemirror/view";
import { Extension, EditorState, StateField, StateEffect, StateEffectType, Range, RangeSetBuilder, Transaction, Line, SelectionRange, Compartment, ChangeSet } from "@codemirror/state";
// import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
// import { SyntaxNodeRef } from "@lezer/common";

// import { CodeStylerSettings, CodeStylerThemeSettings, SPECIAL_LANGUAGES } from "./Settings";
// import { CodeblockParameters, parseCodeblockParameters, testOpeningLine, trimParameterLine, isCodeblockIgnored, isLanguageIgnored } from "./Parsing/CodeblockParsing";
// import { InlineCodeParameters, parseInlineCode } from "./Parsing/InlineCodeParsing";
// import { createHeader, createInlineOpener, getLanguageIcon, getLineClass, isHeaderHidden } from "./CodeblockDecorating";
// import CodeStylerPlugin from "./main";
// import { addReferenceSyntaxHighlight } from "./SyntaxHighlighting";
// import { cpSync } from "fs";
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { filePath, basePath } from './main';

interface SettingsState {
	excludedLanguages: string;
	processedCodeblocksWhitelist: string;
}



let jsonData: any;

function offsetToPos(state: EditorState, offset: number) {
    const line = state.doc.lineAt(offset); // Get the line information for the offset
    const lineNumber = line.number; // Line number (1-based)
    const column = offset - line.from; // Column (0-based)
    return { line: lineNumber, column };
}

function posToOffset(state: EditorState, line: number, column: number): number {
    const lineInfo = state.doc.line(line); // Get the line information (1-based line number)
    return lineInfo.from + column; // Add the column offset to the start of the line
}
let counter = 0;
	// tests
// Define an effect to add decorations
let allowUpdate = false;
// Define the StateField to manage decorations


interface Diagnostics {
    from: number
    to: number
    severity: string
    message: string
    extra: Set<string>
}


const processPyrightOutput = StateField.define<DecorationSet>({
    create() {
        return Decoration.none; // Start with no decorations
    },
    update(decorations, transaction) {
        counter++;
        const builder = new RangeSetBuilder<Decoration>();
        if (!allowUpdate) return decorations; // Don't update if not allowed
        allowUpdate = false
        counter++;
        if (!jsonData) return builder.finish(); // No data to process

        const editorView = lastUpdate.view;

        let pendingDiagnostics: Diagnostics[] = [];

        for (const diagnostic of jsonData.generalDiagnostics) {
            // if (diagnostic.rule === "reportUnknownArgumentType") continue; // Ignoring those for now
            let from = posToOffset(transaction.state, diagnostic.range.start.line + 1, diagnostic.range.start.character); // Convert to 0-based index
            let to = posToOffset(transaction.state, diagnostic.range.end.line + 1, diagnostic.range.end.character); // Convert to 0-based index
            while (offsetToPos(transaction.state, to).column == 0){
                to--;
            }
            if (from >= to){
                from = to-1
            }    
            if (from < 0 || to < 0){
                continue;
            }

            let currentDiagnostic : Diagnostics = {
                from: from,
                to: to,
                severity: diagnostic.severity,
                message: diagnostic.message,
                extra: new Set()
            };
            if (diagnostic.rule === "reportUndefinedVariable"){
                currentDiagnostic.extra.add("reportUndefinedVariable")
            }

            for (const i in pendingDiagnostics){
                let pendingDiagnostic = pendingDiagnostics[i]
                if (pendingDiagnostic.to <= currentDiagnostic.from) continue;


                let combinedDiagnostic : Diagnostics = {
                    from: currentDiagnostic.from,
                    to: Math.min(currentDiagnostic.to, pendingDiagnostic.to),
                    severity: (currentDiagnostic.severity === "error" || pendingDiagnostic.severity === "error") ? "error" : "warning",
                    message: currentDiagnostic.message + "\n" + pendingDiagnostic.message,
                    extra: new Set([...currentDiagnostic.extra, ...pendingDiagnostic.extra])
                }



                if (pendingDiagnostic.to > combinedDiagnostic.to){
                    const splitPendingDiagnostic : Diagnostics = {
                        from: combinedDiagnostic.to,
                        to: pendingDiagnostic.to,
                        severity: pendingDiagnostic.severity,
                        message: pendingDiagnostic.message,
                        extra: pendingDiagnostic.extra
                    }
                    pendingDiagnostics.push(splitPendingDiagnostic)
                }
                pendingDiagnostic.to = combinedDiagnostic.from;
                currentDiagnostic.from = combinedDiagnostic.to;

                pendingDiagnostics.push(combinedDiagnostic)

                // What happens if I push things to pendingDiagnistics at this point=
            }

            pendingDiagnostics.push(currentDiagnostic)

            let i = 0
            while (i < pendingDiagnostics.length) {
                const pendingDiagnostic = pendingDiagnostics[i]
                if(pendingDiagnostic.from >= pendingDiagnostic.to){
                    pendingDiagnostics.remove(pendingDiagnostic);
                    continue;
                } 
                if (pendingDiagnostic.to <= from){
                    pendingDiagnostics.remove(pendingDiagnostic);
                    let cssClass = pendingDiagnostic.severity; // Use a CSS class for styling
                    if (pendingDiagnostic.extra.has("reportUndefinedVariable")){
                        cssClass += " pyright-not-defined"
                        
                    }


                    builder.add(
                        pendingDiagnostic.from,
                        pendingDiagnostic.to,
                        Decoration.mark({ class: cssClass })
                    );
                

                    builder.add(
                        pendingDiagnostic.from,
                        pendingDiagnostic.to,
                        Decoration.mark({ 
                            class: "pyright-tooltip", 
                            attributes: { 
                                "tooltip-content": pendingDiagnostic.message, 
                            }})
                    );
                    continue;
                }
                i++;
            }
        }
        for (const i in pendingDiagnostics){
            const pendingDiagnostic = pendingDiagnostics[i]
            pendingDiagnostics.remove(pendingDiagnostic);
            if (pendingDiagnostic.from >= pendingDiagnostic.to) continue;
            let cssClass = pendingDiagnostic.severity; // Use a CSS class for styling
            if (pendingDiagnostic.extra.has("reportUndefinedVariable")){
                cssClass += " pyright-not-defined"
            }
            builder.add(
                pendingDiagnostic.from,
                pendingDiagnostic.to,
                Decoration.mark({ class: cssClass })
            );
        
            builder.add(
                pendingDiagnostic.from,
                pendingDiagnostic.to,
                Decoration.mark({ 
                    class: "pyright-tooltip", 
                    attributes: { 
                        "tooltip-content": pendingDiagnostic.message, 
                    }})
            );
            
        }




        return builder.finish();




    },
    provide(field) {
        return EditorView.decorations.from(field);
    },
});


let oldDoc : string;
let timer = 0;
let lastFileContents : string;
let lastUpdate : ViewUpdate;
let lastFile;
// Create a ViewPlugin to listen for changes and dispatch effects
const changeListener = EditorView.updateListener.of((update) => {
    if (update.changes) {
        counter++;
        const editorView = update.view; // Get the EditorView instance
        const doc = editorView.state.doc.toString(); // Get the document content
        if (doc === oldDoc) return; // No changes, exit early
        oldDoc = doc; // Update the oldDoc variable
        
        let fileContents = "";
        

        let inCodeBlock = false;
        let first = true;
        for (const line in doc.split("\n")) {
            if (!first){
                fileContents += "\n"
            }
            first = false;
            const lineText = doc.split("\n")[line];
            if (!inCodeBlock){
                if(lineText.startsWith("```python") || lineText.startsWith("```Python")){
                    inCodeBlock = true;
                    continue;
                }
            }
            else if (lineText.startsWith("```")){
                inCodeBlock = false;
            }
            if (inCodeBlock){
                fileContents += lineText
            }
        }

        // if(fileContents == lastFileContents) return;


        lastFileContents = fileContents;
        lastUpdate = update;
        timer = Date.now()
        hasRun = false;

        jsonData = null; // Reset jsonData to null
        allowUpdate = true; // Reset allowUpdate to false
        lastUpdate.view.dispatch({
            effects: StateEffect.appendConfig.of([
                processPyrightOutput
            ]),
        });
    }
});

const waitTimer = 250; // ms
let hasRun = false;
export function tryRunPyright(){
    counter++;
    if (hasRun) return;
    if (Date.now() < timer + waitTimer){
        return;
    } 
    
    
    hasRun = true;
    runPyright(lastFileContents, lastUpdate)
}


export const pyrightExtension = [changeListener];


function runPyright(fileContents: string, update: ViewUpdate) {
    if (fileContents === undefined) return;
    fs.writeFile(filePath, fileContents, (err) => {
        if (err) {
            console.error('Error writing to code.py:', err);
        } else {
            const pythonPath = "c:\\Python312";
            const command = 'python -m basedpyright -p ' + basePath + ' --outputjson'
            exec(command, (error, stdout, stderr) => {
                if (stdout){

                    jsonData = JSON.parse(stdout)
                    counter++;
                    allowUpdate = true
                    update.view.dispatch({
                        effects: StateEffect.appendConfig.of([
                            processPyrightOutput
                        ]),
                    });


                }
            });
        }
    });
}
// Export the extension
import { App, debounce, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, View } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { pyrightExtension, tryRunPyright } from 'EditingView';

import { spawn } from 'child_process';


interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

interface Paths {
	basePath: string;
	filePath: string;
	outputPath: string;
}

export let basePath: string;
export let filePath: string;

// const basePath = path.join(this.app.vault.adapter.getBasePath(), '.obsidian', 'plugins', 'obsidian-pyright', 'Pyright');

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
        basePath = path.join((this.app.vault.adapter as any).getBasePath(), '.obsidian', 'plugins', 'obsidian-pyright', 'Pyright');
        filePath = path.join(basePath, 'pyright_watcher.py');

		
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {

				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
				
			}
		});


		this.addCommand({
			id: 'Get-pyright-info-json',
			name: 'Debug pyright info json',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const command = 'python -m basedpyright -p ' + basePath + ' --outputjson'
				exec(command, (error, stdout, stderr) => {
					if (stdout){
						console.log(JSON.parse(stdout))
					}
				});
				
			}
		});

		this.addCommand({
			id: 'Get-pyright-info-verbose',
			name: 'Debug pyright info verbose',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const command = 'python -m basedpyright -p ' + basePath + ' --verbose'
				exec(command, (error, stdout, stderr) => {
					if (stdout){
						console.log(stdout)
					}
				});
				
			}
		});


		this.registerEditorExtension(pyrightExtension);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => tryRunPyright(), 100));
		

		
		// const serverProcess = spawn('basedpyright-langserver', ['--stdio']);

		// serverProcess.stdout.on('data', (data) => {
		// // Handle data received from the language server
		// 	console.log(`stdout: ${data}`);
		// });

		// serverProcess.stderr.on('data', (data) => {
		// // Handle error messages from the language server
		// 	console.log(`stderr: ${data}`);
		// });

		// serverProcess.on('exit', (code) => {
		// // Handle server exit
		// 	console.log(`exit: ${code}`);
		// });
	}

	onunload() {
		
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}



class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

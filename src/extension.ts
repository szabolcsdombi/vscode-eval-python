// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function compareSelection(a:vscode.Selection, b:vscode.Selection) {
	if (a.start.line < b.start.line) {
		return -1;
	}
	if (a.start.line > b.start.line) {
		return 1;
	}
	if (a.start.character < b.start.character) {
		return -1;
	}
	if (a.start.character > b.start.character) {
		return 1;
	}
	return 0;
}

function indentOf(x:string) {
	return x.substr(0, x.indexOf(x.trim()));
}

const input_handler = `(lambda: (__import__('json').dump(__builtins__.list(__builtins__.map(__builtins__.repr, __builtins__.map(eval, __import__('json').load(__import__('sys').stdin)))), __import__('sys').stdout)))()\n`;
const default_context_py_content = `i = iter(range(1000000000))\n`;


export function activate(context: vscode.ExtensionContext) {
	let disposable1 = vscode.commands.registerCommand('extension.evaluate', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			vscode.window.showErrorMessage('No active text editor');
			return;
		}

		let context_py = undefined;
		if (vscode.workspace.rootPath !== undefined) {
			context_py = path.resolve(vscode.workspace.rootPath, '.vscode', 'context.py');
		}

		// get the content of the context.py
		let context_py_content = default_context_py_content;
		if (context_py !== undefined && fs.existsSync(context_py)) {
			context_py_content = fs.readFileSync(context_py, 'utf8');
		}

		// turn selection into JSON
		let selections: vscode.Selection[] = editor.selections;
		selections = selections.sort(compareSelection);

		const input = JSON.stringify(selections.map(selection => editor.document.getText(selection).trim()));
		let output = undefined;

		// pass selection to Python
		try {
			const args = ['-c', context_py_content + '\n' + input_handler];
			output = child_process.execFileSync('python', args, { encoding: 'utf8', input });
		} catch (ex) {
			console.log(ex);
			vscode.window.showErrorMessage('' + ex);
			return;
		}

		const results = JSON.parse(output);

		// replace selection with result
		editor.edit(builder => {
			let index = 0;
			for (const selection of selections) {
				let text = editor.document.getText(selection);
				builder.replace(selection, indentOf(text) + results[index]);
				index += 1;
			}
		});
	});

	let disposable2 = vscode.commands.registerCommand('extension.create_context', () => {
		// must have a workspace
		if (vscode.workspace.rootPath === undefined) {
			vscode.window.showErrorMessage('No workspace selected');
			return;
		}

		let dot_vscode = path.resolve(vscode.workspace.rootPath, '.vscode');
		let context_py = path.resolve(dot_vscode, 'context.py');

		// context.py already exists
		if (fs.existsSync(context_py)) {
			vscode.workspace.openTextDocument(context_py).then(doc => {
				vscode.window.showTextDocument(doc);
			});
			return;
		}

		// no .vscode folder
		if (!fs.existsSync(dot_vscode)) {
			fs.mkdirSync(dot_vscode);
		}

		// populate context.py
		fs.writeFile(context_py, default_context_py_content, function (err) {
			if (err) {
				vscode.window.showErrorMessage('' + err);
			}
		});
	});

	context.subscriptions.push(disposable1);
	context.subscriptions.push(disposable2);
}

// this method is called when your extension is deactivated
export function deactivate() {}

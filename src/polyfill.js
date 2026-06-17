// Tauri v2 API polyfill — uses the plugin globals injected by the runtime
var __tauri = (function () {
    var t = window.__TAURI__;
    if (!t || !t.core || !t.core.invoke) {
        var stub = function () { return Promise.reject(new Error('Not inside Tauri')); };
        return { invoke: stub, open: stub, save: stub,
            readTextFile: stub, writeTextFile: stub, writeFile: stub, writeText: stub };
    }
    var invoke = t.core.invoke.bind(t.core);

    // Plugins are injected as separate globals: __TAURI_PLUGIN_DIALOG__, etc.
    var dlg = window.__TAURI_PLUGIN_DIALOG__;
    var fs = window.__TAURI_PLUGIN_FS__;
    var clip = window.__TAURI_PLUGIN_CLIPBOARD_MANAGER__;

    return {
        invoke: invoke,
        open:  dlg ? dlg.open.bind(dlg)  : function () { return invoke('plugin:dialog|open', { options: {} }); },
        save:  dlg ? dlg.save.bind(dlg)  : function () { return invoke('plugin:dialog|save', { options: {} }); },
        readTextFile:  fs ? fs.readTextFile.bind(fs)  : function (p) { return invoke('plugin:fs|read_text_file', { path: p }); },
        writeTextFile: fs ? fs.writeTextFile.bind(fs) : function (p,c) { return invoke('plugin:fs|write_text_file', { path: p, contents: c }); },
        writeFile:     fs ? fs.writeFile.bind(fs)     : function (p,c) { return invoke('plugin:fs|write_file', { path: p, contents: Array.from(new Uint8Array(c)) }); },
        writeText:     clip ? clip.writeText.bind(clip) : function (t) { return invoke('plugin:clipboard-manager|write_text', { text: t }); }
    };
})();

export var invoke = __tauri.invoke;
export var open = __tauri.open;
export var save = __tauri.save;
export var readTextFile = __tauri.readTextFile;
export var writeTextFile = __tauri.writeTextFile;
export var writeFile = __tauri.writeFile;
export var writeText = __tauri.writeText;

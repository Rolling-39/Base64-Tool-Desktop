import { getCurrentWindow } from '@tauri-apps/api/window';

// Tauri v2 API polyfill — uses plugin globals injected by the runtime
var __tauri = (function () {
    var t = window.__TAURI__;
    if (!t || !t.core || !t.core.invoke) {
        var stub = function () { return Promise.reject(new Error('Not inside Tauri')); };
        return { invoke: stub, open: stub, save: stub,
            readTextFile: stub, writeTextFile: stub, writeFile: stub, writeText: stub,
            listen: stub, minimize: stub, toggleMaximize: stub, close: stub };
    }
    var invoke = t.core.invoke.bind(t.core);

    var dlg = window.__TAURI_PLUGIN_DIALOG__;
    var fp   = window.__TAURI_PLUGIN_FS__;
    var clip = window.__TAURI_PLUGIN_CLIPBOARD_MANAGER__;

    var win = null;
    try { win = getCurrentWindow(); } catch(e) {}

    return {
        invoke: invoke,
        open:  dlg ? dlg.open.bind(dlg)  : function () { return invoke('plugin:dialog|open', { options: {} }); },
        save:  dlg ? dlg.save.bind(dlg)  : function () { return invoke('plugin:dialog|save', { options: {} }); },
        readTextFile:  fp ? fp.readTextFile.bind(fp)  : function (p) { return invoke('plugin:fs|read_text_file', { path: p }); },
        writeTextFile: fp ? fp.writeTextFile.bind(fp) : function (p,c) { return invoke('plugin:fs|write_text_file', { path: p, contents: c }); },
        writeFile:     fp ? fp.writeFile.bind(fp)     : function (p,c) { return invoke('plugin:fs|write_file', { path: p, contents: Array.from(new Uint8Array(c)) }); },
        writeText:     clip ? clip.writeText.bind(clip) : function (t) { return invoke('plugin:clipboard-manager|write_text', { text: t }); },
        // Window controls
        minimize:       win ? function() { return win.minimize(); }        : function() { return Promise.resolve(); },
        toggleMaximize: win ? function() { return win.toggleMaximize(); }  : function() { return Promise.resolve(); },
        close:          win ? function() { return win.close(); }           : function() { return Promise.resolve(); },
        // Events
        listen: function(evt, cb) {
            if (t.event && t.event.listen) {
                return t.event.listen(evt, cb);
            }
            // Fallback: use invoke to listen
            return invoke('plugin:event|listen', { event: evt, handler: cb }).then(function() {
                return function() {};
            });
        }
    };
})();

export var invoke = __tauri.invoke;
export var open = __tauri.open;
export var save = __tauri.save;
export var readTextFile = __tauri.readTextFile;
export var writeTextFile = __tauri.writeTextFile;
export var writeFile = __tauri.writeFile;
export var writeText = __tauri.writeText;
export var minimize = __tauri.minimize;
export var toggleMaximize = __tauri.toggleMaximize;
export var closeWindow = __tauri.close;
export var listen = __tauri.listen;

import { invoke, open, save, readTextFile, writeTextFile, writeFile, writeText } from './polyfill.js';

// ── Sidebar navigation ──
document.getElementById('sidebarNav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showPanel(btn.dataset.panel);
});

function showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    const panel = document.getElementById('panel-' + name);
    panel.style.display = 'flex';
    panel.classList.add('active');
}

// ── Snackbar ──
function snack(msg, dur = 2500) {
    const existing = document.querySelector('.snackbar');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'snackbar';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), dur);
}

function fmtSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ── Debug logger ──
var _logLines = [];
function log(msg) {
    var ts = new Date().toLocaleTimeString();
    var line = '[' + ts + '] ' + msg;
    _logLines.push(line);
    var el = $('logArea');
    if (el) el.textContent = _logLines.join('\n');
    console.log(line);
}

// Helper: element shorthand
function $(id) { return document.getElementById(id); }

// ═══════════════════════════════════════
//  PANELS: HTML
// ═══════════════════════════════════════

function buildUI() {
    $('content').innerHTML = `
        <!-- ENCODE -->
        <div class="panel active" id="panel-encode" style="display:flex">
            <div class="card">
                <div class="card-header">加密模式</div>
                <div class="toggle-group" id="encToggle">
                    <button class="toggle-btn active" data-mode="text">加密文本</button>
                    <button class="toggle-btn" data-mode="file">加密文件</button>
                </div>
            </div>
            <textarea class="textarea" id="encInput" placeholder="输入要加密的文本"></textarea>
            <div id="encFileArea" style="display:none">
                <button class="btn btn-outline" id="encPickFile">选择文件</button>
                <span class="label" id="encFileLabel" style="display:none"></span>
            </div>
            <div class="btn-row">
                <button class="btn btn-primary" id="encBtn">开始加密</button>
            </div>
            <div class="loading-row" id="encLoading">
                <div class="spinner"></div>
                <span class="label">正在加密中...</span>
                <button class="btn btn-text" id="encCancel">取消</button>
            </div>
            <div id="encResult" style="display:none">
                <div class="card">
                    <div class="card-header">加密结果</div>
                    <div class="result-scroll" id="encResultScroll"></div>
                </div>
                <div class="btn-row" style="margin-top:12px">
                    <button class="btn btn-tonal" id="encCopy">复制到剪贴板</button>
                    <button class="btn btn-outline" id="encSave">另存为文本文件</button>
                </div>
            </div>
            <span class="label" id="encStatus"></span>
            <div class="sidebar-footer" style="margin-top:24px;border:none">Rolling</div>
        </div>

        <!-- DECODE -->
        <div class="panel" id="panel-decode" style="display:none">
            <div class="card">
                <div class="card-header">解密模式</div>
                <div class="toggle-group" id="decToggle">
                    <button class="toggle-btn active" data-mode="text">解密文本</button>
                    <button class="toggle-btn" data-mode="file">解密文件</button>
                </div>
            </div>
            <textarea class="textarea" id="decInput" placeholder="粘贴 Base64 文本"></textarea>
            <button class="btn btn-outline" id="decLoadFile" style="display:none">从文本文件加载 Base64</button>
            <span class="label label-primary" id="decLoaded" style="display:none"></span>
            <button class="btn btn-primary" id="decBtn">开始解密</button>
            <div class="loading-row" id="decLoading">
                <div class="spinner"></div>
                <span class="label">正在解密中...</span>
            </div>
            <div id="decTextResult" style="display:none">
                <div class="card">
                    <div class="card-header">解密结果</div>
                    <div class="result-scroll" id="decResultScroll"></div>
                </div>
                <button class="btn btn-tonal" id="decCopy" style="margin-top:12px">复制到剪贴板</button>
            </div>
            <div id="decImageResult" style="display:none">
                <div class="card-header">解密结果 - 图片</div>
                <span class="label" id="decImageInfo"></span>
                <img class="result-image" id="decImage" />
                <button class="btn btn-tonal" id="decSaveImg" style="margin-top:12px">另存为</button>
            </div>
            <div id="decFileResult" style="display:none">
                <div class="card-header">解密结果 - 二进制文件</div>
                <span class="label" id="decFileInfo"></span>
                <button class="btn btn-tonal" id="decSaveFile" style="margin-top:12px">另存为</button>
            </div>
            <span class="label label-primary" id="decSaved" style="display:none"></span>
            <div class="sidebar-footer" style="margin-top:24px;border:none">Rolling</div>
        </div>

        <!-- BATCH -->
        <div class="panel" id="panel-batch" style="display:none">
            <div class="card">
                <div class="card-header">操作模式</div>
                <div class="toggle-group" id="batToggle">
                    <button class="toggle-btn active" data-mode="encrypt">加密</button>
                    <button class="toggle-btn" data-mode="decrypt">解密</button>
                </div>
            </div>
            <button class="btn btn-outline" id="batPickFolder">选择文件夹</button>
            <span class="label" id="batFolder" style="display:none"></span>
            <div class="btn-row">
                <button class="btn btn-primary" id="batStart">开始处理</button>
                <button class="btn btn-text" id="batCancel" style="display:none">取消</button>
            </div>
            <div class="progress-bar" id="batProgressBar" style="display:none">
                <div class="progress-fill" id="batProgressFill" style="width:0%"></div>
            </div>
            <span class="label" id="batProgressText" style="display:none"></span>
            <span class="label label-primary" id="batSummary" style="display:none"></span>
            <div class="card-header">处理结果</div>
            <div class="result-list" id="batResults"></div>
            <div class="sidebar-footer" style="margin-top:24px;border:none">Rolling</div>
        </div>

        <!-- LOG -->
        <div class="panel" id="panel-log" style="display:none">
            <div class="card-header">运行日志</div>
            <div class="result-scroll" id="logArea" style="max-height:none;min-height:400px;font-size:11px;"></div>
            <button class="btn btn-tonal" id="logCopy" style="margin-top:10px">复制日志</button>
        </div>
    `;
}

// ═══════════════════════════════════════
//  ENCODE
// ═══════════════════════════════════════

let encMode = 'text';
let encFilePath = '';
let encFileName = '';
let encFileSize = 0;
let encResult = '';

function initEncode() {
    const toggle = $('encToggle');
    toggle.addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        toggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        encMode = btn.dataset.mode;
        $('encInput').style.display = encMode === 'text' ? '' : 'none';
        $('encFileArea').style.display = encMode === 'file' ? 'flex' : 'none';
        $('encResult').style.display = 'none';
    });

    $('encPickFile').addEventListener('click', async () => {
        const file = await open({ multiple: false });
        if (!file) return;
        encFilePath = file;
        encFileName = file.split(/[\\/]/).pop();
        try {
            encFileSize = Number(await invoke('file_size', { path: encFilePath }));
            $('encFileLabel').textContent = '已选: ' + encFileName + ' (' + fmtSize(encFileSize) + ')';
            $('encFileLabel').style.display = '';
        } catch (e) { snack('无法读取文件: ' + e); }
    });

    $('encBtn').addEventListener('click', async () => {
        $('encLoading').classList.add('show');
        $('encBtn').disabled = true;
        $('encStatus').textContent = '';

        if (encMode === 'text') {
            // ── Text mode: encode in memory (small data) ──
            if (!$('encInput').value.trim()) { snack('请输入要加密的文本'); $('encLoading').classList.remove('show'); $('encBtn').disabled = false; return; }
            try {
                const result = await invoke('encode_text', { input: $('encInput').value });
                encResult = result;
                const display = result.length > 3000
                    ? result.slice(0, 3000) + '\n\n... 结果过长已省略 (共 ' + result.length + ' 字符)'
                    : result;
                $('encResultScroll').textContent = display;
                $('encResult').style.display = 'flex';
                $('encCopy').style.display = '';
                $('encCopy').disabled = false;
                $('encStatus').textContent = '加密成功，共 ' + result.length + ' 字符';
                snack('加密成功');
            } catch (e) { snack('加密失败: ' + e); }
            finally { $('encLoading').classList.remove('show'); $('encBtn').disabled = false; }

        } else {
            // ── File mode: stream directly to user-chosen output ──
            if (!encFilePath) { snack('请选择文件'); $('encLoading').classList.remove('show'); $('encBtn').disabled = false; return; }
            var outPath = await save({ defaultPath: encFileName + '.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
            if (!outPath) { $('encLoading').classList.remove('show'); $('encBtn').disabled = false; return; }
            try {
                var bytesOut = await invoke('encode_file_stream', { inputPath: encFilePath, outputPath: outPath });
                encResult = ''; // no in-memory result for file mode
                $('encResultScroll').textContent = '文件已保存到: ' + outPath.replace(/\\/g, '/').split('/').pop();
                $('encResult').style.display = 'flex';
                $('encCopy').style.display = 'none';
                $('encSave').style.display = 'none';
                $('encStatus').textContent = '加密完成 (' + fmtSize(encFileSize) + ' -> ' + fmtSize(bytesOut) + ')';
                snack('加密完成');
            } catch (e) { snack('加密失败: ' + e); }
            finally { $('encLoading').classList.remove('show'); $('encBtn').disabled = false; }
        }
    });

    $('encCancel').addEventListener('click', () => {
        $('encLoading').classList.remove('show');
        $('encBtn').disabled = false;
    });

    $('encCopy').addEventListener('click', async () => {
        if (!encResult) return;
        await writeText(encResult);
        snack('已复制到剪贴板');
    });

    $('encSave').addEventListener('click', async () => {
        if (!encResult) return;
        const path = await save({ defaultPath: 'base64_result.txt' });
        if (!path) return;
        try { await writeTextFile(path, encResult); snack('已保存'); }
        catch (e) { snack('保存失败: ' + e); }
    });
}

// ═══════════════════════════════════════
//  DECODE
// ═══════════════════════════════════════

let decMode = 'text';
let decBytes = null;
let decLoadedPath = '';
let decBaseName = '';
let decDetectedExt = '';

function initDecode() {
    const toggle = $('decToggle');
    toggle.addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        toggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        decMode = btn.dataset.mode;
        $('decInput').style.display = decMode === 'text' ? '' : 'none';
        $('decLoadFile').style.display = decMode === 'file' ? '' : 'none';
        hideDecResults();
    });

    $('decLoadFile').addEventListener('click', async () => {
        const file = await open({ multiple: false, filters: [{ name: 'Text', extensions: ['txt'] }] });
        if (!file) return;
        decLoadedPath = file;
        var name = file.split(/[\\/]/).pop();
        // Strip .txt suffix to guess the original filename
        decBaseName = name.replace(/\.txt$/i, '') || 'decoded_file';
        $('decLoaded').textContent = '已加载: ' + name + ' -> ' + decBaseName;
        $('decLoaded').style.display = '';
        snack('已加载，点击解密');
    });

    $('decBtn').addEventListener('click', async () => {
        if (decMode === 'text') {
            // ── Text mode: decode from textarea (small data) ──
            const input = $('decInput').value.trim();
            if (!input) { snack('请输入 Base64 文本'); return; }
            $('decLoading').classList.add('show');
            $('decBtn').disabled = true;
            hideDecResults();
            $('decSaved').style.display = 'none';
            try {
                const text = await invoke('decode_text', { base64Input: input });
                const display = text.length > 5000 ? text.slice(0, 5000) + '\n\n... 文本过长 (共 ' + text.length + ' 字符)' : text;
                $('decResultScroll').textContent = display;
                $('decTextResult').style.display = 'flex';
                $('decCopy').disabled = false;
            } catch (e) { snack('解密失败: ' + e); }
            finally { $('decLoading').classList.remove('show'); $('decBtn').disabled = false; }

        } else {
            // ── File mode: stream decode → temp → detect → save dialog → copy ──
            if (!decLoadedPath) { snack('请先加载 Base64 文本文件'); return; }
            $('decLoading').classList.add('show');
            $('decBtn').disabled = true;
            hideDecResults();
            $('decSaved').style.display = 'none';
            try {
                // Decode to temp file
                var tmpPath = decLoadedPath + '.tmp_decoded';
                await invoke('decode_file_stream', { inputPath: decLoadedPath, outputPath: tmpPath });
                // Detect file type from temp
                var ext = await invoke('detect_file_type_from_path', { path: tmpPath });
                decDetectedExt = ext || '';
                // Build default filename: keep original name (minus .txt), add detected extension
                var defName = decBaseName;
                if (ext && !defName.toLowerCase().endsWith('.' + ext)) {
                    defName += '.' + ext;
                }
                // Ask user where to save
                var outPath = await save({ defaultPath: defName });
                if (!outPath) { $('decLoading').classList.remove('show'); $('decBtn').disabled = false; return; }
                await invoke('copy_file', { src: tmpPath, dst: outPath });
                // Clean up temp file (ignore errors)
                invoke('delete_file', { path: tmpPath }).catch(() => {});
                var outSize = await invoke('file_size', { path: outPath });
                var info = '大小: ' + fmtSize(outSize);
                if (ext) info = '格式: .' + ext + ' | ' + info;
                $('decFileInfo').textContent = info;
                $('decFileResult').style.display = 'flex';
                $('decSaveFile').style.display = 'none';
                $('decSaveImg').style.display = 'none';
                $('decSaved').textContent = '已保存到 ' + outPath.replace(/\\/g, '/').split('/').pop();
                $('decSaved').style.display = '';
                snack('解密完成');
            } catch (e) { snack('解密失败: ' + e); }
            finally { $('decLoading').classList.remove('show'); $('decBtn').disabled = false; }
        }
    });

    $('decCopy').addEventListener('click', async () => {
        const text = $('decResultScroll').textContent;
        if (!text) return;
        await writeText(text);
        snack('已复制到剪贴板');
    });

    $('decSaveImg').addEventListener('click', async () => {
        if (!decBytes) return;
        var name = 'decoded_image';
        if (decDetectedExt) name += '.' + decDetectedExt;
        const path = await save({ defaultPath: name });
        if (!path) return;
        try { await writeFile(path, decBytes); snack('已保存'); } catch (e) { snack('保存失败: ' + e); }
    });

    $('decSaveFile').addEventListener('click', async () => {
        if (!decBytes) return;
        var name = 'decoded_file';
        if (decDetectedExt) name += '.' + decDetectedExt;
        const path = await save({ defaultPath: name });
        if (!path) return;
        try { await writeFile(path, decBytes); snack('已保存'); } catch (e) { snack('保存失败: ' + e); }
    });
}

function hideDecResults() {
    $('decTextResult').style.display = 'none';
    $('decImageResult').style.display = 'none';
    $('decFileResult').style.display = 'none';
}

// ═══════════════════════════════════════
//  BATCH
// ═══════════════════════════════════════

let batMode = 'encrypt';
let batFolder = '';

function initBatch() {
    $('batToggle').addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        $('batToggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        batMode = btn.dataset.mode;
    });

    $('batPickFolder').addEventListener('click', async () => {
        const dir = await open({ directory: true, multiple: false });
        if (!dir) return;
        batFolder = dir;
        const files = await invoke('list_files', { path: batFolder });
        $('batFolder').textContent = '已选: ' + dir.split(/[\\/]/).pop() + ' (' + files.length + ' 个文件)';
        $('batFolder').style.display = '';
    });

    $('batStart').addEventListener('click', async () => {
        if (!batFolder) { snack('请先选择文件夹'); return; }
        const list = $('batResults');
        list.innerHTML = '';
        $('batSummary').style.display = 'none';

        const files = await invoke('list_files', { path: batFolder });
        if (files.length === 0) { snack('文件夹中没有文件'); return; }

        $('batStart').style.display = 'none';
        $('batCancel').style.display = '';
        $('batProgressBar').style.display = '';
        $('batProgressText').style.display = '';

        let success = 0, fail = 0, skip = 0;
        const base = batFolder.replace(/\\/g, '/');

        for (let i = 0; i < files.length; i++) {
            const fn = files[i];
            const ip = base + '/' + fn;
            try {
                if (batMode === 'encrypt') {
                    await invoke('encode_file_stream', { inputPath: ip, outputPath: ip + '.txt' });
                    list.innerHTML += '<div class="result-item success"><span class="icon">OK</span><span class="name">' + fn + '</span><span class="msg">' + fn + '.txt</span></div>';
                    success++;
                } else {
                    if (!fn.endsWith('.txt')) {
                        list.innerHTML += '<div class="result-item fail"><span class="icon">--</span><span class="name">' + fn + '</span><span class="msg">跳过(非.txt)</span></div>';
                        skip++;
                    } else {
                        const out = fn.slice(0, -4);
                        await invoke('decode_file_stream', { inputPath: ip, outputPath: base + '/' + out });
                        list.innerHTML += '<div class="result-item success"><span class="icon">OK</span><span class="name">' + fn + '</span><span class="msg">' + out + '</span></div>';
                        success++;
                    }
                }
            } catch (e) {
                list.innerHTML += '<div class="result-item fail"><span class="icon">!!</span><span class="name">' + fn + '</span><span class="msg">失败: ' + e + '</span></div>';
                fail++;
            }
            $('batProgressFill').style.width = Math.round(((i + 1) / files.length) * 100) + '%';
            $('batProgressText').textContent = (i + 1) + ' / ' + files.length;
            list.scrollTop = list.scrollHeight;
        }

        $('batStart').style.display = '';
        $('batCancel').style.display = 'none';
        const summary = '完成。成功: ' + success + '，失败: ' + fail + (skip > 0 ? '，跳过: ' + skip : '');
        $('batSummary').textContent = summary;
        $('batSummary').style.display = '';
        snack(summary);
    });

    $('batCancel').addEventListener('click', () => {
        $('batStart').style.display = '';
        $('batCancel').style.display = 'none';
        $('batProgressBar').style.display = 'none';
        $('batProgressText').style.display = 'none';
        snack('已取消');
    });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    buildUI();
    initEncode();
    initDecode();
    initBatch();

    // Log panel
    $('logCopy').addEventListener('click', () => {
        var text = _logLines.join('\n');
        if (text) { writeText(text); snack('已复制日志'); }
    });

    // Debug: dump Tauri runtime info
    log('=== Base64 Tool Desktop ===');
    log('UserAgent: ' + navigator.userAgent.substring(0, 50) + '...');
    var t = window.__TAURI__;
    var ti = window.__TAURI_INTERNALS__;
    log('__TAURI__: ' + (t ? typeof t : 'UNDEFINED'));
    log('__TAURI_INTERNALS__: ' + (ti ? typeof ti : 'UNDEFINED'));
    // List all window properties containing "tauri" or "TAURI"
    var keys = Object.keys(window).filter(k => /tauri/i.test(k));
    log('tauri keys on window: ' + (keys.length ? keys.join(', ') : 'NONE'));
    if (t) {
        log('  .core: ' + (t.core ? Object.keys(t.core).join(', ') : 'MISSING'));
        log('  .plugins: ' + (t.plugins ? Object.keys(t.plugins).join(', ') : 'MISSING'));
    }
    log('  invoke type: ' + typeof invoke);
    log('  open type: ' + typeof open);
});

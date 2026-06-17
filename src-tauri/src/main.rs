use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::fs;
use std::io::{BufReader, BufWriter, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

// ── Window control commands ──
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}
#[tauri::command]
async fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}
#[tauri::command]
async fn close_app_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// ── Reset cancel flag ──
#[tauri::command]
fn cancel_encode() { CANCEL_FLAG.store(true, Ordering::SeqCst); }
fn reset_cancel() { CANCEL_FLAG.store(false, Ordering::SeqCst); }

// ── Reset cancel flag from JS before starting batch ──
#[tauri::command]
fn reset_encode_flag() { reset_cancel(); }

// ── Encode text to Base64 string ──
#[tauri::command]
fn encode_text(input: String) -> String {
    STANDARD.encode(input.as_bytes())
}

// ── Encode a file to a Base64 string (small files only, returns full string) ──
#[tauri::command]
fn encode_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("无法读取文件: {e}"))?;
    Ok(STANDARD.encode(&bytes))
}

// ── Stream-encode a file → output file with progress events ──
#[tauri::command]
async fn encode_file_stream(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
) -> Result<u64, String> {
    let input_size = fs::metadata(&input_path)
        .map_err(|e| format!("无法读取: {e}"))?
        .len();
    let ip = input_path.clone();
    let op = output_path.clone();

    tokio::task::spawn_blocking(move || {
        let input = BufReader::new(fs::File::open(&ip).map_err(|e| format!("无法打开: {e}"))?);
        let output = BufWriter::new(fs::File::create(&op).map_err(|e| format!("无法创建: {e}"))?);
        let mut encoder = base64::write::EncoderWriter::new(output, &STANDARD);
        let mut reader = BufReader::new(input);
        let mut buf = [0u8; 131072]; // 128KB chunks
        let mut total: u64 = 0;
        let mut last_pct: u32 = 0;
        loop {
            let n = reader.read(&mut buf).map_err(|e| format!("读取失败: {e}"))?;
            if n == 0 { break; }
            encoder.write_all(&buf[..n]).map_err(|e| format!("写入失败: {e}"))?;
            total += n as u64;
            // Cancel check
            if CANCEL_FLAG.load(Ordering::SeqCst) {
                let _ = fs::remove_file(&op);
                return Err("已取消".into());
            }
            let pct = if input_size > 0 { (total * 100 / input_size) as u32 } else { 100 };
            if pct > last_pct {
                last_pct = pct;
                let _ = app.emit("encode-progress", serde_json::json!({
                    "done": total, "total": input_size, "percent": pct
                }));
            }
        }
        encoder.finish().map_err(|e| format!("完成失败: {e}"))?;
        let out_size = fs::metadata(&op)
            .map_err(|e| format!("无法获取输出大小: {e}"))?
            .len();
        Ok(out_size)
    })
    .await
    .map_err(|e| format!("任务失败: {e}"))?
}

// ── Decode Base64 string → bytes, detect if it's text ──
#[tauri::command]
fn decode_text(base64_input: String) -> Result<String, String> {
    let cleaned: String = base64_input
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    let bytes = STANDARD
        .decode(&cleaned)
        .or_else(|_| {
            base64::engine::general_purpose::URL_SAFE.decode(&cleaned)
        })
        .map_err(|e| format!("无效的 Base64: {e}"))?;

    String::from_utf8(bytes).map_err(|_| "解码结果不是文本".into())
}

// ── Decode Base64 string → bytes (as Vec<u8>, for binary/file use) ──
#[tauri::command]
fn decode_binary(base64_input: String) -> Result<Vec<u8>, String> {
    let cleaned: String = base64_input
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    let bytes = STANDARD
        .decode(&cleaned)
        .or_else(|_| {
            base64::engine::general_purpose::URL_SAFE.decode(&cleaned)
        })
        .map_err(|e| format!("无效的 Base64: {e}"))?;
    Ok(bytes)
}

// ── Stream-decode Base64 from file → binary output file with progress ──
#[tauri::command]
async fn decode_file_stream(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
) -> Result<u64, String> {
    let ip = input_path.clone();
    let op = output_path.clone();
    let input_size = fs::metadata(&ip).map_err(|e| format!("无法读取: {e}"))?.len();

    tokio::task::spawn_blocking(move || {
        reset_cancel();
        let input = BufReader::new(fs::File::open(&ip).map_err(|e| format!("无法打开: {e}"))?);
        let output = BufWriter::new(fs::File::create(&op).map_err(|e| format!("无法创建: {e}"))?);
        let mut decoder = base64::read::DecoderReader::new(input, &STANDARD);
        let mut writer = BufWriter::new(output);
        let mut buf = [0u8; 131072];
        let mut total: u64 = 0;
        let mut last_pct: u32 = 0;
        loop {
            let n = decoder.read(&mut buf).map_err(|e| format!("解码失败: {e}"))?;
            if n == 0 { break; }
            writer.write_all(&buf[..n]).map_err(|e| format!("写入失败: {e}"))?;
            total += n as u64;
            // Cancel check
            if CANCEL_FLAG.load(Ordering::SeqCst) {
                let _ = fs::remove_file(&op);
                return Err("已取消".into());
            }
            // Estimate progress: input is base64, ~75% of output size
            let est = (total * 4 / 3).min(input_size);
            let pct = if input_size > 0 { (est * 100 / input_size) as u32 } else { 100 };
            if pct > last_pct {
                last_pct = pct;
                let _ = app.emit("decode-progress", serde_json::json!({
                    "done": total, "total": input_size, "percent": pct
                }));
            }
        }
        drop(writer);
        let out_size = fs::metadata(&op)
            .map_err(|e| format!("无法获取输出大小: {e}"))?
            .len();
        Ok(out_size)
    })
    .await
    .map_err(|e| format!("任务失败: {e}"))?
}

// ── Get file size ──
#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
    let meta = fs::metadata(&path).map_err(|e| format!("无法获取: {e}"))?;
    Ok(meta.len())
}

// ── List files in a directory (non-recursive) ──
#[tauri::command]
fn list_files(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("无法读取目录: {e}"))?;
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                files.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    Ok(files)
}

// ── Copy a file ──
#[tauri::command]
fn copy_file(src: String, dst: String) -> Result<u64, String> {
    fs::copy(&src, &dst).map_err(|e| format!("复制失败: {e}"))
}

// ── Delete a file ──
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| format!("删除失败: {e}"))
}

// ── detect_file_type: return file extension from magic bytes, or "" if unknown ──
#[tauri::command]
fn detect_file_type(bytes: Vec<u8>) -> String {
    if bytes.len() < 4 { return String::new(); }

    // ── Images ──
    if bytes.len() >= 8 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" { return "png".into(); }
    if bytes[0..2] == [0xff, 0xd8] { return "jpg".into(); }
    if &bytes[0..6] == b"GIF87a" || &bytes[0..6] == b"GIF89a" { return "gif".into(); }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { return "webp".into(); }
    if bytes[0..2] == [0x42, 0x4d] { return "bmp".into(); }
    if bytes.len() >= 4 && &bytes[0..4] == [0x00, 0x00, 0x01, 0x00] { return "ico".into(); }
    if bytes.len() >= 4 && (&bytes[0..4] == [0x49, 0x49, 0x2a, 0x00] || &bytes[0..4] == [0x4d, 0x4d, 0x00, 0x2a]) { return "tiff".into(); }

    // ── Documents ──
    if &bytes[0..4] == b"%PDF" { return "pdf".into(); }
    if &bytes[0..4] == b"PK\x03\x04" {
        // ZIP — could be docx/xlsx/pptx/jar/apk. Check further for Office.
        // Look for "[Content_Types].xml" in the first 512 bytes
        let end = bytes.len().min(512);
        if let Some(_) = bytes[..end].windows(20).find(|w| *w == b"[Content_Types].xml") {
            // Office file — can't distinguish docx/xlsx/pptx without more parsing
            return "zip".into(); // "docx" is too specific; user can rename
        }
        return "zip".into();
    }
    if &bytes[0..4] == b"Rar!" { return "rar".into(); }
    if &bytes[0..2] == [0x37, 0x7a] { return "7z".into(); }
    if bytes[0..2] == [0x1f, 0x8b] { return "gz".into(); }
    if bytes[0..2] == [0x42, 0x5a] { return "bz2".into(); }

    // ── Audio / Video ──
    if bytes.len() >= 3 && &bytes[0..3] == [0x49, 0x44, 0x33] { return "mp3".into(); } // ID3 tag
    if bytes.len() >= 12 && &bytes[4..12] == b"ftypmp42" { return "mp4".into(); }
    if bytes.len() >= 12 && &bytes[4..12] == b"ftypisom" { return "mp4".into(); }
    if bytes.len() >= 12 && &bytes[4..12] == b"ftypMSNV" { return "mp4".into(); }
    if bytes.len() >= 4 && &bytes[0..4] == b"fLaC" { return "flac".into(); }
    if bytes.len() >= 4 && &bytes[0..4] == b"OggS" { return "ogg".into(); }
    if &bytes[0..4] == b"RIFF" && bytes.len() >= 12 && &bytes[8..12] == b"WAVE" { return "wav".into(); }
    if &bytes[0..4] == b"RIFF" && bytes.len() >= 12 && &bytes[8..12] == b"AVI " { return "avi".into(); }
    if bytes.len() >= 8 && &bytes[0..4] == [0x1a, 0x45, 0xdf, 0xa3] { return "webm".into(); }

    // ── Executables ──
    if &bytes[0..2] == b"MZ" { return "exe".into(); }  // EXE/DLL
    if bytes.len() >= 4 && &bytes[0..4] == [0x7f, 0x45, 0x4c, 0x46] { return "elf".into(); }
    if bytes.len() >= 4 && (&bytes[0..4] == [0xcf, 0xfa, 0xed, 0xfe] || &bytes[0..4] == [0xfe, 0xed, 0xfa, 0xcf]) { return "macho".into(); }

    // ── Other ──
    if &bytes[0..4] == b"SQLi" { return "db".into(); }
    if bytes.len() >= 4 && &bytes[0..4] == [0x00, 0x01, 0x00, 0x00] { return "ttf".into(); }
    if &bytes[0..4] == b"<?xml" || &bytes[0..5] == b"<html " || &bytes[0..6] == b"<!DOCT" { return "html".into(); }

    String::new()
}

// ── detect file type from a file path (reads first 512 bytes) ──
#[tauri::command]
fn detect_file_type_from_path(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("无法读取: {e}"))?;
    let head = &bytes[..bytes.len().min(512)];
    Ok(detect_file_type(head.to_vec()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            encode_text,
            encode_file,
            encode_file_stream,
            decode_text,
            decode_binary,
            decode_file_stream,
            file_size,
            list_files,
            detect_file_type,
            detect_file_type_from_path,
            copy_file,
            delete_file,
            cancel_encode,
            reset_encode_flag,
            minimize_window,
            toggle_maximize_window,
            close_app_window,
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}

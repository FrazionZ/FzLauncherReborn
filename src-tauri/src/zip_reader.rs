extern crate zip;
use std::fs::File;
use std::io::prelude::*;
use std::io::Cursor; use base64::engine::general_purpose;
use base64::Engine;
// Required for synchronous IO
use tokio::fs::File as AsyncFile;
use tokio::io::AsyncReadExt;
use zip::read::ZipArchive;

pub async fn read_file_from_zip(zip_path: &str, file_name: &str) -> Result<String, String> {
    // Open the ZIP file synchronously
    let file = File::open(zip_path).map_err(|e| format!("Error opening ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Error opening ZIP archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        if file.name() == file_name {
            // Read the file's contents into a Vec<u8> buffer synchronously
            let mut content = Vec::new();
            file.read_to_end(&mut content).unwrap(); // Unwrap here is safe because file.read_to_end returns Result

            // Convert Vec<u8> buffer to String
            let content_str = String::from_utf8(content).unwrap(); // Unwrap here is safe because from_utf8 returns Result

            return Ok(content_str);
        }
    }

    Err(format!("File '{}' not found in ZIP archive.", file_name))
}

pub async fn read_base64_from_zip(zip_path: &str, file_name: &str) -> Result<String, String> {
    // Open the ZIP file synchronously
    let file = File::open(zip_path).map_err(|e| format!("Error opening ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Error opening ZIP archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        if file.name() == file_name {
            // Read the file's contents into a Vec<u8> buffer synchronously
            let mut content = Vec::new();
            file.read_to_end(&mut content).unwrap(); // Unwrap here is safe because file.read_to_end returns Result

            let encoded = general_purpose::STANDARD.encode(&content);
            return Ok(encoded);
        }
    }

    Err(format!("File '{}' not found in ZIP archive.", file_name))
}
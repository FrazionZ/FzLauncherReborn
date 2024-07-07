use std::{fs::File, io::{Read, Write}};
use tokio::{fs, io::{self, AsyncReadExt, AsyncWriteExt}};
use std::path::Path;
use zip::ZipArchive;

pub async fn extract_file(
    app: tauri::AppHandle,
    uuid: String,
    zip_file_path: String,
    output_dir: String,
    index: usize,
) -> Result<(), String> {
    println!("Unzipping in subclass.. 41");
    
    let file = File::open(&zip_file_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut zip_file = match archive.by_index(index) {
        Ok(file) => file,
        Err(e) => return Err(e.to_string()),
    };
    
    let output_file_path = format!("{}/{}", output_dir, zip_file.name());

    if zip_file.name().ends_with('/') {
        println!("Unzipping in subclass.. 42");
        fs::create_dir_all(&output_file_path).await.map_err(|e| e.to_string())?;
    } else {
        println!("Unzipping in subclass.. 43");
        if let Some(p) = Path::new(&output_file_path).parent() {
            fs::create_dir_all(p).await.map_err(|e| e.to_string())?;
        }

        let mut buffer = Vec::new();
        zip_file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

        let mut output_file = File::create(&output_file_path).map_err(|e| e.to_string())?;
        output_file.write_all(&buffer).map_err(|e| e.to_string())?;
    }

    Ok(())
}

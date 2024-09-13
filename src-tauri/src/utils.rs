pub(crate) struct Utils;

use std::fs;
use std::fs::OpenOptions;
use std::io;
use std::io::Read;
use std::io::Write;
use std::path::Path;

use async_std::fs::File;
use async_std::io::ReadExt;
use base64::encode;
use base64::engine::general_purpose;
use base64::Engine;
use futures_util::TryFutureExt;
use reqwest::blocking::get;
use reqwest::Error as ReqwestError;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Error as SerdeError;
use serde_json::Value;
use thiserror::Error;

use crate::interface_profile_game::InterfaceProfileGame;
use crate::interface_profile_game::ProfileGame;
use crate::interface_profile_game::TraitProfileGame;

#[derive(Error, Debug)]
pub enum FetchError {
    #[error("Request error: {0}")]
    Reqwest(#[from] ReqwestError),
    #[error("JSON parse error: {0}")]
    Serde(#[from] SerdeError),
}

impl Utils {
    pub fn fetch_url_content(url: &str) -> Result<Vec<ProfileGame>, FetchError> {
        let response = get(url)?;
        let content = response.text()?;
        let json: Vec<ProfileGame> = serde_json::from_str(&content)?;
        Ok(json)
    }

    pub fn load_json_file<T>(file_path: &str) -> io::Result<Vec<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        if Path::new(file_path).exists() {
            let mut file = fs::File::open(file_path)?;
            let mut contents = String::new();
            file.read_to_string(&mut contents)?;
            let data: Vec<T> = serde_json::from_str(&contents)?;
            Ok(data)
        } else {
            Ok(Vec::new())
        }
    }

    pub fn save_json_file<T>(file_path: &str, data: &Vec<T>) -> io::Result<()>
    where
        T: Serialize,
    {
        let json_data = serde_json::to_string_pretty(data)?;
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(file_path)?;
        file.write_all(json_data.as_bytes())?;
        Ok(())
    }

    pub async fn read_base64_from_file(file_path: &str) -> Result<String, String> {
        // Open the file asynchronously
        let mut file = File::open(file_path).await.map_err(|e| e.to_string())?;

        // Read the file contents into a vector asynchronously
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).await.map_err(|e| e.to_string())?;

        // Convert the file contents to Base64
        let encoded = encode(&contents);

        return Ok(encoded);
    }
}

pub(crate) struct Utils;

use reqwest::blocking::get;
use reqwest::Error as ReqwestError;
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

}
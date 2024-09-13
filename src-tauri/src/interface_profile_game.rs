pub(crate) struct InterfaceProfileGame;

use reqwest::Error;
use serde::{Deserialize, Serialize};
use std::{fs, io, path::PathBuf};

use crate::utils;
pub trait TraitProfileGame {
    type ProfileGame;
}

#[derive(Serialize, Clone, Deserialize, Debug)]
pub struct ProfileGame {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub game: Game,
    pub jre: String,
    pub game_type: String,
    pub profile_type: String,
    pub jvm_args: String,
    pub custom_args: String,
}

#[derive(Serialize, Clone, Deserialize, Debug)]
pub struct Game {
    pub version: String,
    pub custom_client: Option<CustomClient>,
    pub classMain: String,
    #[serde(rename = "clientJarName")]
    pub client_jar_name: String,
    pub modloader_version: Option<String>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceObject {
    pub id: u32,
    pub game_id: String,
}

#[derive(Serialize, Clone, Deserialize, Debug)]
pub struct CustomClient {
    pub github: Github,
}

#[derive(Serialize, Clone, Deserialize, Debug)]
pub struct Github {
    pub repo: String,
}

impl TraitProfileGame for InterfaceProfileGame {
    type ProfileGame = ProfileGame;
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct ConfigObject {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub fn init_config_profile(file_path: &str) -> Result<(), String> {
    use utils::Utils;

    // Créer un vecteur de ConfigObject
    let configs = vec![ConfigObject {
        key: "ram_allocate".to_string(),
        value: "1".to_string(),
    }];

    // Charger les données actuelles du fichier JSON
    let mut current_data: Vec<ConfigObject> =
        Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    // Ajouter les nouveaux objets de configuration s'ils n'existent pas déjà
    for config in configs {
        if !current_data.iter().any(|data| data.key == config.key) {
            current_data.push(config);
        }
    }

    // Sauvegarder les données mises à jour dans le fichier JSON
    Utils::save_json_file(file_path, &current_data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_config_profile(file_path: &str, key: &str, new_value: &str) -> Result<(), String> {
    use utils::Utils;

    let mut current_data: Vec<ConfigObject> =
        Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    if let Some(config) = current_data.iter_mut().find(|c| c.key == key) {
        config.value = new_value.to_string();
    } else {
        let new_config = ConfigObject {
            key: key.to_owned(),
            value: new_value.to_string()
        };

        current_data.push(new_config);
    }

    Utils::save_json_file(file_path, &current_data).map_err(|e| e.to_string())?;

    Ok(())
}
 
pub async fn add_profiles_list(file_path: &str, profile_game: ProfileGame) -> Result<(), String> {
    use utils::Utils;

    println!("Adding.. {}", profile_game.id);

    let mut current_data: Vec<ProfileGame> = Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    current_data.push(profile_game);

    Utils::save_json_file(file_path, &current_data).map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn remove_profiles_list(file_path: &str, uuid: String) -> Result<(), String> {
    use utils::Utils;

    println!("Remove.. {}", uuid);

    let mut current_data: Vec<ProfileGame> = Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    let index = current_data.iter().position(|x| *x.id == uuid).unwrap();
    current_data.remove(index);

    Utils::save_json_file(file_path, &current_data).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_list_profiles(file_path: &str) -> Result<Vec<ProfileGame>, String> {
    use utils::Utils;

    // Charger les données actuelles du fichier JSON
    let current_data: Vec<ProfileGame> =
        Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    Ok(current_data)
}

#[tauri::command]
pub async fn get_java_data(java_version: String) -> Result<String, String> {
    // Construire l'URL
    let url = format!(
        "https://api.azul.com/metadata/v1/zulu/packages?arch=x64&java_version={}&os=windows&archive_type=zip&javafx_bundled=false&java_package_type=jre&page_size=1",
        java_version
    );

    // Faire la requête GET
    let response = reqwest::get(&url).await;

    // Gérer la réponse et les erreurs
    match response {
        Ok(resp) => {
            let text = resp.text().await;
            match text {
                Ok(body) => {
                    // Créer un objet JavaData
                    let java_data = body;
                    
                    // Convertir en JSON
                    match serde_json::to_string(&java_data) {
                        Ok(json) => Ok(json),
                        Err(e) => Err(format!("Erreur de sérialisation JSON: {}", e)),
                    }
                }
                Err(e) => Err(format!("Erreur lors de la lecture de la réponse: {}", e)),
            }
        }
        Err(e) => Err(format!("Erreur lors de la requête GET: {}", e)),
    }
}


pub fn get_config_profile(file_path: &str) -> Result<Vec<ConfigObject>, String> {
    use utils::Utils;

    // Charger les données actuelles du fichier JSON
    let current_data: Vec<ConfigObject> =
        Utils::load_json_file(file_path).map_err(|e| e.to_string())?;

    Ok(current_data)
}

impl InterfaceProfileGame {}

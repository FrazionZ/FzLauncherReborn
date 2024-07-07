pub(crate) struct InterfaceProfileGame;

use serde::{Serialize, Deserialize};
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
    pub game_type: String,
    pub profile_type: String,
    pub custom_args: String,
}

#[derive(Serialize, Clone, Deserialize, Debug)]
pub struct Game {
    pub version: String,
    pub custom_client: Option<CustomClient>,
    pub classMain: String,
    #[serde(rename = "clientJarName")]
    pub client_jar_name: String
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

impl InterfaceProfileGame {}

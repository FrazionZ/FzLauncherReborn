pub(crate) struct Auth;

use async_std::future::Future;
use futures_util::future::err;
use futures_util::FutureExt as _;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fmt;
use std::option::Option;
use std::{any, ptr::null};
use tokio::sync::futures;

use crate::auth;
// Définition du trait Example avec un type associé XboxLiveResponse
pub trait Example {
    type MinecraftProfile;
    type XboxLiveResponse;
    type MinecraftSession;
}

#[derive(Debug, Deserialize)]
pub struct XboxLiveResponse {
    #[serde(rename = "Token")]
    token: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenResponse {
    access_token: String,
    refresh_token: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct XstsResponse {
    #[serde(rename = "DisplayClaims")]
    display_claims: DisplayClaims,
    #[serde(rename = "Token")]
    token: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DisplayClaims {
    xui: Vec<Xui>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Xui {
    uhs: String,
}

impl fmt::Display for XstsResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "XstsResponse {{ display_claims: {} }}",
            self.display_claims
        )
    }
}

impl fmt::Display for DisplayClaims {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "DisplayClaims {{ xui: {:?} }}", self.xui)
    }
}

impl fmt::Display for Xui {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Xui {{ uhs: {} }}", self.uhs)
    }
}

impl XstsResponse {
    pub fn get_uhs(&self) -> Option<&String> {
        self.display_claims.get_uhs()
    }
}

impl DisplayClaims {
    pub fn new(xui: Vec<Xui>) -> Self {
        DisplayClaims { xui }
    }

    pub fn get_uhs(&self) -> Option<&String> {
        self.xui.get(0).map(|xui| &xui.uhs)
    }
}

impl Xui {
    pub fn new(uhs: String) -> Self {
        Xui { uhs }
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct MinecraftAuthRequest {
    identityToken: String,
    ensureLegacyEnabled: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct MinecraftAuthResponse {
    access_token: String, // Ajoutez d'autres champs selon la réponse JSON de l'API
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<Skins>,
    pub capes: Vec<Capes>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MinecraftSession {
    pub accessToken: String,
    pub refreshToken: String,
    pub mcProfile: MinecraftProfile,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Skins {
    pub id: String,
    pub state: String,
    pub url: String,
    pub textureKey: String,
    pub variant: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Capes {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

impl MinecraftAuthRequest {
    pub fn new(user_hash: &str, token: &str) -> Self {
        MinecraftAuthRequest {
            identityToken: format!("XBL3.0 x={};{}", user_hash, token),
            ensureLegacyEnabled: "true".to_string(),
        }
    }
}

impl Example for Auth {
    type XboxLiveResponse = XboxLiveResponse;
    type MinecraftProfile = MinecraftProfile;
    type MinecraftSession = MinecraftSession;
}

#[derive(Debug)]
enum AuthError {
    MinecraftProfileFetchError(reqwest::Error),
    AuthenticationFailed,
    ReqwestError(String), // Nouvelle variante pour stocker le message d'erreur de reqwest
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthError::MinecraftProfileFetchError(e) => {
                write!(f, "Failed to fetch Minecraft profile: {}", e)
            }
            AuthError::AuthenticationFailed => write!(f, "Authentication failed ma gueule"),
            AuthError::ReqwestError(msg) => write!(f, "{}", msg),
        }
    }
}

impl Error for AuthError {}

impl Auth {
    pub const MICROSOFT_AUTHORIZATION_ENDPOINT: &'static str =
        "https://login.live.com/oauth20_authorize.srf";
    pub const MICROSOFT_TOKEN_ENDPOINT: &'static str = "https://login.live.com/oauth20_token.srf";
    pub const MICROSOFT_REDIRECTION_ENDPOINT: &'static str =
        "https://login.live.com/oauth20_desktop.srf";
    pub const XBOX_LIVE_AUTH_HOST: &'static str = "user.auth.xboxlive.com";
    pub const XBOX_LIVE_CLIENT_ID: &'static str = "00000000402B5328";
    pub const XBOX_LIVE_SERVICE_SCOPE: &'static str = "service::user.auth.xboxlive.com::MBI_SSL";
    pub const XBOX_LIVE_AUTHORIZATION_ENDPOINT: &'static str =
        "https://user.auth.xboxlive.com/user/authenticate";
    pub const XSTS_AUTHORIZATION_ENDPOINT: &'static str =
        "https://xsts.auth.xboxlive.com/xsts/authorize";
    pub const MINECRAFT_AUTH_ENDPOINT: &'static str =
        "https://api.minecraftservices.com/authentication/login_with_xbox";
    pub const XBOX_LIVE_AUTH_RELAY: &'static str = "http://auth.xboxlive.com";
    pub const MINECRAFT_AUTH_RELAY: &'static str = "rp://api.minecraftservices.com/";
    pub const MINECRAFT_STORE_ENDPOINT: &'static str =
        "https://api.minecraftservices.com/entitlements/mcstore";
    pub const MINECRAFT_PROFILE_ENDPOINT: &'static str =
        "https://api.minecraftservices.com/minecraft/profile";
    pub const MINECRAFT_STORE_IDENTIFIER: &'static str = "game_minecraft";

    pub fn url_obtain_token() -> String {
        format!(
            "{}?client_id={}&redirect_uri={}&scope={}&response_type=code&prompt=select_account",
            Self::MICROSOFT_AUTHORIZATION_ENDPOINT,
            Self::XBOX_LIVE_CLIENT_ID,
            Self::MICROSOFT_REDIRECTION_ENDPOINT,
            Self::XBOX_LIVE_SERVICE_SCOPE
        )
    }

    pub fn get_extract_value(url: &str, key: &str) -> String {
        let regex = Regex::new(&(key.to_owned() + "=([^&]*)")).unwrap();
        if let Some(captures) = regex.captures(url) {
            if let Some(value) = captures.get(1) {
                return value.as_str().to_string();
            }
        }
        String::new()
    }

    pub async fn login_from_refresh_tokens(
        refresh_token: &str,
    ) -> Result<<Auth as Example>::MinecraftSession, Box<dyn Error>> {
        let params = [
            ("client_id", self::Auth::XBOX_LIVE_CLIENT_ID),
            ("refresh_token", refresh_token),
            ("redirect_uri", self::Auth::MICROSOFT_REDIRECTION_ENDPOINT),
            ("grant_type", "refresh_token"),
            ("scope", self::Auth::XBOX_LIVE_SERVICE_SCOPE),
        ];

        let refresh_token_response: String = reqwest::Client::new()
            .post(self::Auth::MICROSOFT_TOKEN_ENDPOINT)
            .form(&params)
            .send()
            .await?
            .text()
            .await?;

        println!("EXAMPLE RTR RESPONSE: {}", refresh_token_response);

        let refresh_token_response: RefreshTokenResponse = serde_json::from_str(&refresh_token_response)?;

        match Self::authenticate(refresh_token_response).await {
            Ok(data) => Ok(data),
            Err(err) => Err(Box::new(AuthError::ReqwestError(
                format!("Aucun profil Minecraft détecté sur ce compte {}", err),
            ))),
        }
    }

    pub async fn login_from_code(
        authorization_code: &str,
    ) -> Result<<Auth as Example>::MinecraftSession, Box<dyn Error>> {
        let params = [
            ("client_id", self::Auth::XBOX_LIVE_CLIENT_ID),
            ("code", authorization_code),
            ("redirect_uri", self::Auth::MICROSOFT_REDIRECTION_ENDPOINT),
            ("grant_type", "authorization_code"),
        ];

        let refresh_token_response: RefreshTokenResponse = reqwest::Client::new()
            .post(self::Auth::MICROSOFT_TOKEN_ENDPOINT)
            .form(&params)
            .send()
            .await?
            .json()
            .await?;

        match Self::authenticate(refresh_token_response).await {
            Ok(data) => Ok(data),
            Err(err) => Err(Box::new(AuthError::ReqwestError(
                "Aucun profil Minecraft détecté sur ce compte".to_string(),
            ))),
        }
    }

    pub async fn authenticate( 
        refresh_response: RefreshTokenResponse,
    ) -> Result<<Auth as Example>::MinecraftSession, Box<dyn Error>> {
        println!("XboxLiveResponse Requesst"); 

        let xbox_live_response: XboxLiveResponse = reqwest::Client::new()
            .post(self::Auth::XBOX_LIVE_AUTHORIZATION_ENDPOINT)
            .json(&serde_json::json!({
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": self::Auth::XBOX_LIVE_AUTH_HOST,
                    "RpsTicket": refresh_response.access_token
                },
                "RelyingParty": self::Auth::XBOX_LIVE_AUTH_RELAY,
                "TokenType": "JWT"
            }))
            .send()
            .await?
            .json()
            .await?;

        println!("XstsResponse Request");
        let _xsts_response: XstsResponse = reqwest::Client::new()
            .post(self::Auth::XSTS_AUTHORIZATION_ENDPOINT)
            .json(&serde_json::json!({
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [xbox_live_response.token],
                },
                "RelyingParty": self::Auth::MINECRAFT_AUTH_RELAY,
                "TokenType": "JWT"
            }))
            .send()
            .await?
            .json()
            .await?;

        if let Some(uhs) = _xsts_response.get_uhs() {
            let auth_request = MinecraftAuthRequest::new(uhs, &_xsts_response.token);
            let client: Client = Client::new();
            let auth_response_minecraft = client
                .post(self::Auth::MINECRAFT_AUTH_ENDPOINT)
                .header("Content-Type", "application/json")
                .json(&auth_request)
                .send()
                .await?;

            let minecraft_response: MinecraftAuthResponse = auth_response_minecraft.json().await?;
            let access_token = minecraft_response.access_token;

            let client = Client::new();

            let mut headers = HeaderMap::new();
            headers.insert("Content-Type", HeaderValue::from_static("application/json"));

            // Ajouter l'en-tête Authorization avec Bearer token
            let auth_header_value = format!("Bearer {}", access_token);
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_header_value).unwrap(),
            );

            let store_response_minecraft = client
                .get(self::Auth::MINECRAFT_STORE_ENDPOINT)
                .headers(headers)
                .send()
                .await?;

            let mc_store_data: Value = store_response_minecraft.json().await?;
            let minecraft_game = mc_store_data["items"].as_array().and_then(|items| {
                items.iter().find(|element| {
                    element["name"].as_str() == Some(self::Auth::MINECRAFT_STORE_IDENTIFIER)
                })
            });

            match minecraft_game {
                Some(game) => {
                    let mut headers = HeaderMap::new();
                    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

                    // Ajouter l'en-tête Authorization avec Bearer token
                    let auth_header_value = format!("Bearer {}", access_token);
                    headers.insert(
                        AUTHORIZATION,
                        HeaderValue::from_str(&auth_header_value).unwrap(),
                    );

                    let profile_response_minecraft = client
                        .get(self::Auth::MINECRAFT_PROFILE_ENDPOINT)
                        .headers(headers)
                        .send()
                        .await
                        .map_err(|e| {
                            Box::new(AuthError::MinecraftProfileFetchError(e.into()))
                                as Box<dyn Error>
                        })?;

                    if profile_response_minecraft.status().is_success() {
                        println!("TEST: {}", access_token);
                        let mc_profile_data: MinecraftProfile =
                            profile_response_minecraft.json().await.map_err(|e| {
                                Box::new(AuthError::MinecraftProfileFetchError(e.into()))
                                    as Box<dyn Error>
                            })?;

                        let mc_profile_session = MinecraftSession {
                            accessToken: access_token,
                            refreshToken: refresh_response.refresh_token,
                            mcProfile: mc_profile_data,
                        };

                        Ok(mc_profile_session)
                    } else {
                        Err(Box::new(AuthError::ReqwestError(
                            "Aucun profil Minecraft détecté sur ce compte".to_string(),
                        )))
                    }
                }
                None => Err(Box::new(AuthError::ReqwestError(
                    "Vous semblez ne pas avoir acheté Minecraft.".to_string(),
                ))),
            }
        } else {
            return Err(Box::new(AuthError::ReqwestError(
                "Compte Xbox non trouvé".to_string(),
            )));
        }
    }
}

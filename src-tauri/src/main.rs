// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod zip_reader;
use libc::remove;
use uuid::Uuid;
use zip_reader::*;
mod auth;
use async_std::task::Task;
mod utils;
use auth::{Auth, Example, MinecraftProfile, MinecraftSession, XboxLiveResponse};
use utils::Utils;
use utils::*;
mod task_manager;
use task_manager::{TaskManager, TaskManagerState, TaskObject, TypesTaskManager};
mod interface_profile_game;
use base64::{engine::general_purpose, Engine as _};
use futures_util::{FutureExt, StreamExt};
use interface_profile_game::{InstanceObject, InterfaceProfileGame, ProfileGame, TraitProfileGame};
use reqwest::{Client, Error};
use serde::{Deserialize, Serialize};
use serde_json::Error as JsonError;
use std::collections::HashMap;
use std::env;
use std::fmt::format;
use std::fs::{self, File, OpenOptions};
use std::future::IntoFuture;
use std::io::Error as IOError;
use std::io::{self, BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::api::path::{app_data_dir, resolve_path};
use tauri::{
    async_runtime::spawn, InvokeError, LogicalSize, PhysicalPosition, PhysicalSize, Window,
    WindowUrl,
};
use tauri::{Manager, State, WindowBuilder};
use tokio::fs::File as AsyncFile;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::oneshot;
use tokio::task;

use interface_profile_game::*;
use std::process::{Command, Stdio};
use task_manager::*;
use tokio::io::AsyncBufReadExt;
use tokio::process::{Child, Command as TokioCommand};
use url::Url;
use zip::ZipArchive;

#[derive(Serialize)]
struct DownloadProgress {
    uuid_download: String,
    percentage: f64,
    downloaded_bytes: u64,
    total_bytes: u64,
}

#[derive(Serialize)]
struct ExtractProgress {
    uuid_extract: String,
    percentage: f32,
    file_name: String,
}

struct AppState {
    sessions: Mutex<HashMap<String, <Auth as Example>::MinecraftSession>>,
    profiles_games: Arc<Mutex<Vec<ProfileGame>>>,
    profiles_instance: Arc<Mutex<Vec<InstanceObject>>>,
}
#[tauri::command]
async fn download_file(
    app: tauri::AppHandle,
    uuid: String,
    url: String,
    filename: String,
) -> Result<(), String> {
    let client = Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let content_length = response.content_length().unwrap_or(0);
    let mut file = AsyncFile::create(filename)
        .await
        .map_err(|e| e.to_string())?;
    let mut downloaded_bytes = 0;

    let mut byte_stream = response.bytes_stream();

    while let Some(chunk) = byte_stream.next().await {
        match chunk {
            Ok(chunk) => {
                let bytes_read = chunk.len();
                file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                downloaded_bytes += bytes_read as u64;
                let percentage = (downloaded_bytes as f64 / content_length as f64) * 100.0;
                let uuid_download = uuid.clone();
                let progress = DownloadProgress {
                    uuid_download,
                    percentage,
                    downloaded_bytes,
                    total_bytes: content_length,
                };
                app.emit_all("download-progress-frazionz", Some(&progress))
                    .unwrap_or(());

                // Appel du callback avec le nombre de bytes téléchargés et la taille totale du fichier
                //progress_callback(downloaded_bytes, content_length);
            }
            Err(err) => return Err(err.to_string()),
        }
    }

    Ok(())
}

#[tauri::command]
async fn unzip_file(
    app: tauri::AppHandle,
    uuid: String,
    file_path: String,
    dest_path: String,
    target_folder: Option<String>,
) -> Result<(), String> {
    let _ = task::spawn_blocking::<_, Result<(), String>>(move || {
        let file = File::open(&file_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let total_files = archive.len();

        for i in 0..total_files {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let file_name = file.name().to_string();

            // Check if the file should be extracted based on the target_folder
            if let Some(ref target_folder) = target_folder {
                if !file_name.starts_with(target_folder) {
                    continue; // Skip files not in target_folder
                }
            }

            let out_path = Path::new(&dest_path).join(&file_name);

            if file_name.ends_with('/') {
                std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = out_path.parent() {
                    if !p.exists() {
                        std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                    }
                }
                let mut outfile = File::create(&out_path).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }

            // Emit progress to the frontend
            let percentage = ((i + 1) as f32 / total_files as f32) * 100.0;
            println!("Percentage extract: {}", percentage);
            let uuid_extract = uuid.clone();
            let progress = ExtractProgress {
                uuid_extract,
                percentage,
                file_name,
            };
            app.emit_all("extract-progress-frazionz", Some(&progress))
                .unwrap_or(());
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn center_window(window: Window) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No primary monitor found")?;
    let screen_size = monitor.size();
    let window_size: PhysicalSize<u32> = window.outer_size().map_err(|e| e.to_string())?;

    let center_x = (screen_size.width / 2) as i32 - (window_size.width / 2) as i32;
    let center_y = (screen_size.height / 2) as i32 - (window_size.height / 2) as i32;

    window
        .set_position(PhysicalPosition::new(center_x, center_y))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(unix)]
fn start_process(
    command: String,
    args: Vec<String>,
) -> Result<std::process::Child, std::io::Error> {
    let mut child = Command::new(command)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(child_res) => Ok(child_res),
        Err(e) => Err(e),
    }
}

#[cfg(windows)]
fn start_process(
    command: String,
    args: Vec<String>,
) -> Result<std::process::Child, std::io::Error> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut child = Command::new(command)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    match child {
        Ok(child_res) => Ok(child_res),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn start_child_process(
    window: Window,
    command: String,
    args: Vec<String>,
) -> Result<(), String> {
    let result = task::spawn_blocking(move || {
        match start_process(command, args.to_vec()) {
            Ok(mut child) => {
                let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
                let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

                let stdout_reader = BufReader::new(stdout);
                let stderr_reader = BufReader::new(stderr);

                // Handle stdout
                for line in stdout_reader.lines() {
                    let line = line.map_err(|e| e.to_string())?;
                    window
                        .emit("process-output", format!("stdout: {}", line))
                        .map_err(|e| e.to_string())?;
                }

                // Handle stderr
                for line in stderr_reader.lines() {
                    let line = line.map_err(|e| e.to_string())?;
                    window
                        .emit("process-output", format!("stderr: {}", line))
                        .map_err(|e| e.to_string())?;
                }

                child.wait().map_err(|e| e.to_string())?;

                Ok(())
            }
            Err(_) => Err("Error".to_string()),
        }
    })
    .await;

    match result {
        Ok(inner_result) => inner_result,
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn authenticate_microsoft(
    app_handle: tauri::AppHandle,
    source: String,
    data_source: Option<String>,
) -> Result<<Auth as Example>::MinecraftSession, String> {
    // Créez un canal pour envoyer le résultat de l'authentification
    let (tx, rx) = oneshot::channel();

    // Créez une nouvelle fenêtre
    let url_obtain_token = Auth::url_obtain_token();

    let app_clone = app_handle.clone();
    if source == "add_account" {
        let tx = Arc::new(Mutex::new(Some(tx)));
        let _auth_window = tauri::async_runtime::spawn(async move {
            WindowBuilder::new(
                &app_handle,
                "auth_msa_window",
                tauri::WindowUrl::App((&url_obtain_token).into()),
            )
            .title("FzLauncher - Connexion via Microsoft")
            .on_navigation(move |url| {
                if url
                    .to_string()
                    .starts_with(Auth::MICROSOFT_REDIRECTION_ENDPOINT)
                {
                    let authorization_code = Auth::get_extract_value(&url.to_string(), "code");
                    let window = app_clone.get_window("auth_msa_window").unwrap();
                    let _ = window.close();

                    let tx_clone = Arc::clone(&tx);
                    tauri::async_runtime::spawn(async move {
                        match Auth::login_from_code(&authorization_code).await {
                            Ok(minecraft_profile_session) => {
                                if let Some(tx) = tx_clone.lock().unwrap().take() {
                                    let _ = tx.send(Ok(minecraft_profile_session));
                                    // Envoyer le résultat
                                }
                            }
                            Err(err) => {
                                // Gérez l'erreur ici
                                if let Some(tx) = tx_clone.lock().unwrap().take() {
                                    let _ = tx.send(Err(err.to_string())); // Envoyer une erreur
                                }
                            }
                        }
                    });
                }
                true
            })
            .closable(false)
            .center()
            .build()
            .map_err(|e| e.to_string())?;

            // Attendez que l'authentification soit terminée
            let result = rx
                .await
                .unwrap_or_else(|_| Err("Authentication failed to complete".to_string()))?;
            Ok(result)
        });

        _auth_window.await.unwrap_or_else(|e| Err(e.to_string()))
    } else {
        let tx = Arc::new(Mutex::new(Some(tx)));
        let tx_clone = Arc::clone(&tx);
        let _auth_refresh_token = tauri::async_runtime::spawn(async move {
            let _ = tauri::async_runtime::spawn(async move {
                let source = data_source.clone().unwrap();
                match Auth::login_from_refresh_tokens(&source).await {
                    Ok(minecraft_profile_session) => {
                        if let Some(tx) = tx_clone.lock().unwrap().take() {
                            let _ = tx.send(Ok(minecraft_profile_session));
                            // Envoyer le résultat
                        }
                    }
                    Err(err) => {
                        // Gérez l'erreur ici
                        if let Some(tx) = tx_clone.lock().unwrap().take() {
                            let _ = tx.send(Err(err.to_string())); // Envoyer une erreur
                        }
                    }
                }
            })
            .await;

            let result = rx
                .await
                .unwrap_or_else(|_| Err("Authentication failed to complete".to_string()))?;
            Ok(result)
        });

        _auth_refresh_token
            .await
            .unwrap_or_else(|e| Err(e.to_string()))
    }
}

#[tauri::command]
fn create_session(
    state: State<'_, AppState>,
    session_id: String,
    mc_session: MinecraftSession,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.insert(session_id, mc_session);
    Ok(())
}

#[tauri::command]
fn get_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<MinecraftSession>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions.get(&session_id).cloned())
}

#[tauri::command]
fn delete_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}

#[tauri::command]
fn get_profiles_game(state: State<'_, AppState>) -> Result<Vec<ProfileGame>, String> {
    let list: std::sync::MutexGuard<Vec<ProfileGame>> =
        state.profiles_games.lock().map_err(|e| e.to_string())?;
    Ok(list.clone())
}

#[tauri::command]
fn is_directory_empty(directory_path: String) -> Result<bool, String> {
    let path = Path::new(&directory_path);
    if !path.is_dir() {
        return Err(format!(
            "Le chemin spécifié n'est pas un répertoire : {}",
            directory_path
        ));
    }

    match fs::read_dir(path) {
        Ok(mut entries) => Ok(entries.next().is_none()),
        Err(e) => Err(format!("Erreur lors de la lecture du répertoire : {}", e)),
    }
}

#[tauri::command]
async fn get_instance_from_gameid(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<Option<InstanceObject>, String> {
    let instance = state.profiles_instance.lock().unwrap();
    let instance = instance.clone();
    let instance = instance.iter().find(|i| i.game_id == game_id);
    Ok(instance.cloned())
}

#[cfg(unix)]
fn start_process_async(
    runtime_dir: String,
    java_args: Vec<String>,
) -> Result<Child, std::io::Error> {
    let child = TokioCommand::new(runtime_dir)
        .args(java_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(child_res) => Ok(child_res),
        Err(e) => Err(e),
    }
}

#[cfg(windows)]
fn start_process_async(
    runtime_dir: String,
    java_args: Vec<String>,
) -> Result<Child, std::io::Error> {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let combined_string = java_args.clone().join(" ");
    let child = TokioCommand::new(runtime_dir)
        .args(java_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    println!("JAVA ARGS: {}", combined_string);

    match child {
        Ok(child_res) => Ok(child_res),
        Err(e) => Err(e),
    }
}

fn visit_dirs(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                files.extend(visit_dirs(&path)?); // Appel récursif pour parcourir les sous-dossiers
            } else {
                files.push(path);
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn java_jar_spawn_command(
    java_path: String,
    class_path: String,
    main_class: String,
    args: Vec<String>,
) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;
    use tokio::process::Child;
    // Crée et lance le processus enfant
    let mut child: Child = Command::new(java_path)
        .arg("-cp")
        .arg(class_path)
        .arg(main_class)
        .args(args)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    // Gère la sortie standard
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        tokio::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                println!("stdout: {}", line);
            }
        });
    }

    // Attend la fin du processus enfant
    let status = child.wait().await.map_err(|e| format!("Failed to wait on child: {}", e))?;

    // Vérifie si le processus s'est terminé avec succès
    if !status.success() {
        return Err(format!("Process exited with status: {}", status));
    }

    Ok(())
}

#[tauri::command]
async fn launch_minecraft(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    data: <InterfaceProfileGame as TraitProfileGame>::ProfileGame,
    assetIndex: String,
    minecraft_jar_path: String,
    game_dir: String,
    assets_dir: String,
    runtime_dir: String,
    natives_dir: String,
    libs_dir: String,
) -> Result<(), String> {
    let state_clone = state.clone();
    let mut main_class = "net.minecraft.client.main.Main";
    if data.game_type != "default" {
        main_class = &data.game.classMain;
    }

    match visit_dirs(Path::new(&libs_dir)) {
        Ok(files) => {
            //-Xms1g -Xmx2g
            let pathconfig = format!("{}/{}", game_dir, "config.json".to_string());
            let configs = interface_profile_game::get_config_profile(&pathconfig);
            let configs_clone = configs.unwrap();

            let ramAllocate = configs_clone.iter().find(|data| data.key == "ram_allocate");

            let mut ramAllocateFormatted = "1".to_string();
            let config_to_capture: Option<&ConfigObject>;
            match ramAllocate {
                Some(config) => {
                    config_to_capture = Some(config); // Capture de la valeur dans la variable externe
                }
                None => {
                    println!("No RAM allocation found");
                    config_to_capture = None; // Affectation si aucun élément n'est trouvé
                }
            }

            if let Some(config) = config_to_capture {
                ramAllocateFormatted = config.value.clone()
            }

            let mut paths_string = String::new();
            for path in files {
                println!("{}", &path.to_string_lossy());
                paths_string.push_str(&path.to_string_lossy());
                paths_string.push(';');
            }
            paths_string.push_str(&minecraft_jar_path);

            let session = get_session(state, "msa_session".to_string());
            if let Ok(Some(session)) = session {
                println!("SESSION {}", session.mcProfile.id);

                let mut jvm_args_default = vec![
                    "-Xms1g".to_string(),
                    format!("-Xmx{}g", ramAllocateFormatted),
                    format!("-Djava.library.path=\"{}\"", natives_dir.replace(" ", "")),
                ];

                let classpath_args = vec!["-cp".to_string(), paths_string, main_class.to_string()];

                let game_args = vec![
                    "--gameDir".to_string(),
                    game_dir,
                    "--assetsDir".to_string(),
                    assets_dir,
                    "--assetIndex".to_string(),
                    assetIndex,
                    "--username".to_string(),
                    session.mcProfile.name,
                    "--userType".to_string(),
                    "msa".to_string(),
                    "--accessToken".to_string(),
                    session.accessToken,
                    "--uuid".to_string(),
                    session.mcProfile.id,
                    "--version".to_string(),
                    data.game.version,
                ];

                let jvm_args: Vec<String> = data
                    .jvm_args
                    .split(" ")
                    .map(|s| s.to_string().replace(" ", ""))
                    .collect();
                let custom_args: Vec<String> = data
                    .custom_args
                    .split(" ")
                    .map(|s| s.to_string().replace(" ", ""))
                    .collect();

                let modified_jvm_args: Vec<String> = jvm_args
                    .into_iter() // Convertir en itérateur
                    .map(|arg| {
                        arg.replace("${classpath_separator}", ";")
                            .replace("${library_directory}", &libs_dir)
                    }) // Remplacer dans chaque chaîne
                    .collect();

                let mut java_args_final = jvm_args_default;

                if data.jvm_args.clone().len() > 0 {
                    java_args_final = java_args_final
                        .iter()
                        .chain(modified_jvm_args.iter())
                        .chain(classpath_args.iter())
                        .chain(game_args.iter())
                        .chain(custom_args.iter())
                        .cloned() // Clone each element during collection
                        .collect();
                } else {
                    java_args_final = java_args_final
                        .iter()
                        .chain(classpath_args.iter())
                        .chain(game_args.iter())
                        .chain(custom_args.iter())
                        .cloned() // Clone each element during collection
                        .collect();
                }

                println!("RuntimeDir {}", runtime_dir);

                match start_process_async(runtime_dir, java_args_final) {
                    Ok(mut child) => {
                        let pid = child.id().unwrap();

                        let instance: InstanceObject = InstanceObject {
                            id: pid,
                            game_id: data.id,
                        };

                        let instance_clone = instance.clone();

                        {
                            println!("Add instance with pid {}", pid);
                            let mut pinstance = state_clone.profiles_instance.lock().unwrap();
                            pinstance.push(instance);
                        }

                        app.emit_all("launch-game-profile-frazionz", Some(instance_clone.clone()))
                            .unwrap();

                        let app_clone = app.clone();

                        if let Some(stdout) = child.stdout.take() {
                            let _ = tokio::spawn(async move {
                                let reader = tokio::io::BufReader::new(stdout);
                                let mut lines = reader.lines();
                                while let Ok(Some(line)) = lines.next_line().await {
                                    println!("stdout: {}", line);
                                    let event_name =
                                        format!("console-game-profile-frazionz-{}", pid);
                                    app_clone.emit_all(&event_name, line).unwrap();
                                }
                            })
                            .await;
                        }

                        if let Some(stderr) = child.stderr.take() {
                            let _ = tokio::spawn(async move {
                                let reader = tokio::io::BufReader::new(stderr);
                                let mut lines = reader.lines();
                                while let Ok(Some(line)) = lines.next_line().await {
                                    eprintln!("stderr: {}", line);
                                }
                            })
                            .await;
                        }

                        let mut pinstance = state_clone.profiles_instance.lock().unwrap();
                        if let Some(pos) = pinstance.iter().position(|instance| instance.id == pid)
                        {
                            println!("Remove instance with pid {}", pid);
                            pinstance.remove(pos);
                            app.emit_all("launch-game-profile-frazionz", Some(()))
                                .unwrap();
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to wait on child process: {}", e);
                    }
                }
            }
        }
        Err(e) => println!("Erreur: {}", e),
    }

    Ok(())
}

#[derive(Serialize, Deserialize)]
struct Profile {
    name: String,
    id: String,
    refresh_token: String,
}

//let app_handle = app.handle();
//let app_data_path = app_data_dir(&app_handle.config());
#[tauri::command]
fn add_profile(
    name: String,
    id: String,
    refresh_token: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let profile = Profile {
        name,
        id: id.clone(),
        refresh_token,
    };

    let app_data_path =
        app_data_dir(&app_handle.config()).ok_or("Failed to get app data directory")?;
    let file_path = app_data_path.join("Launcher/profiles.json");

    let mut profiles: Vec<Profile> = if file_path.exists() {
        let file_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_else(|_| vec![])
    } else {
        vec![]
    };

    if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[pos] = profile;
    } else {
        profiles.push(profile);
    }

    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&file_path)
        .map_err(|e| e.to_string())?;
    serde_json::to_writer(file, &profiles).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_profiles(app_handle: tauri::AppHandle) -> Result<Vec<Profile>, String> {
    let app_data_path =
        app_data_dir(&app_handle.config()).ok_or("Failed to get app data directory")?;
    let file_path = app_data_path.join("Launcher/profiles.json");

    // Vérifie si le fichier existe
    if !file_path.exists() {
        return Ok(vec![]); // Retourne une liste vide si le fichier n'existe pas encore
    }

    // Lecture du contenu du fichier et désérialisation des profils
    let file_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let profiles: Vec<Profile> = serde_json::from_str(&file_content).map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
fn get_profiles_game_user(app_handle: tauri::AppHandle) -> Result<Vec<ProfileGame>, String> {
    let app_data_path =
        app_data_dir(&app_handle.config()).ok_or("Failed to get app data directory")?;
    let file_path = app_data_path.join("Launcher/game_profiles.json");

    // Vérifie si le fichier existe
    if !file_path.exists() {
        return Ok(vec![]); // Retourne une liste vide si le fichier n'existe pas encore
    }

    let file_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let profiles: Vec<ProfileGame> =
        serde_json::from_str(&file_content).map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
fn open_directory(path: String) {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(path).spawn().unwrap();
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn().unwrap();
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn().unwrap();
    }
}

#[tauri::command]
async fn get_base64_from_file(path: String) -> Result<String, String> {
    let encode = Arc::new(Mutex::new(String::new()));
    let encode_clone = Arc::clone(&encode);

    tauri::async_runtime::spawn(async move {
        let mut file = match tokio::fs::File::open(Path::new(&path)).await {
            Ok(file) => file,
            Err(e) => {
                *encode_clone.lock().unwrap() = format!("Failed to open file: {}", e);
                return;
            }
        };

        let mut buffer = Vec::new();
        if let Err(e) = file.read_to_end(&mut buffer).await {
            *encode_clone.lock().unwrap() = format!("Failed to read file: {}", e);
            return;
        }

        let encoded = general_purpose::STANDARD.encode(&buffer);
        *encode_clone.lock().unwrap() = encoded;
    })
    .await
    .unwrap();

    let encoded_result = encode.lock().unwrap().clone();
    if encoded_result.starts_with("Failed") {
        Err(encoded_result)
    } else {
        Ok(encoded_result)
    }
}

#[tauri::command]
async fn read_file_from_zip_sync(zip_path: String, file_name: String) -> Result<String, String> {
    zip_reader::read_file_from_zip(&zip_path, &file_name).await
}

#[tauri::command]
async fn read_base64_from_zip_sync(zip_path: String, file_name: String) -> Result<String, String> {
    zip_reader::read_base64_from_zip(&zip_path, &file_name).await
}

#[tauri::command]
async fn read_base64_from_file_sync(file_path: String) -> Result<String, String> {
    Utils::read_base64_from_file(&file_path).await
}

#[tauri::command]
async fn add_profile_custom(
    _file_path: String,
    _version: String,
    _uuid: String,
    _class_name: String,
    _modloader_version: String,
    _name: String,
    _icon: String,
    _game_type: String,
    _profile_type: String,
    _jre: String,
    _jvm_args: String,
    _custom_args: String,
) -> Result<ProfileGame, String> {
    let _github = Github {
        repo: "".to_string(),
    };

    let _custom_client = CustomClient { github: _github };

    let _game = Game {
        version: _version,
        modloader_version: Some(_modloader_version),
        custom_client: Some(_custom_client),
        classMain: _class_name,
        client_jar_name: "minecraft.jar".to_string(),
    };

    let _profile = ProfileGame {
        name: _name.to_string(),
        id: _uuid,
        description: "".to_string(),
        icon: _icon,
        game: _game,
        jre: _jre,
        game_type: _game_type,
        profile_type: _profile_type,
        jvm_args: _jvm_args.to_string(),
        custom_args: _custom_args.to_string(),
    };

    let _profile_clone = _profile.clone();

    let _ = add_profiles_list(&_file_path, _profile).await;

    Ok(_profile_clone.clone())
}

#[tauri::command]
async fn remove_profile(file_path: String, uuid: String) -> Result<String, String> {
    let _ = remove_profiles_list(&file_path, uuid)
        .await
        .map_err(|e| e.to_string())?;

    Ok(String::new())
}

#[cfg(unix)]
fn kill_process(pid: i32) -> Result<(), String> {
    use libc::c_int;
    type pid_t = i32;
    extern "C" {
        fn kill(pid: pid_t, sig: c_int) -> c_int;
    }

    let pid: pid_t = pid; // Remplacez par l'ID du processus cible

    // Signal à envoyer (SIGTERM dans cet exemple)
    let sig: c_int = libc::SIGTERM;

    // Envoyer le signal
    let result = unsafe { kill(pid, sig) };

    // Vérifier le résultat
    if result == 0 {
        println!("Signal envoyé avec succès");
    } else {
        eprintln!("Échec de l'envoi du signal");
    }

    Ok(())
}

#[cfg(windows)]
fn kill_process(pid: u32) -> Result<(), String> {
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::processthreadsapi::TerminateProcess;
    use winapi::um::winnt::PROCESS_TERMINATE;

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if handle.is_null() {
            return Err("Failed to open process".into());
        }
        let result = TerminateProcess(handle, 1);
        CloseHandle(handle);
        if result == 0 {
            return Err("Failed to terminate process".into());
        }
    }
    Ok(())
}

#[cfg(unix)]
#[tauri::command]
fn kill_process_command(pid: i32) -> Result<(), String> {
    kill_process(pid)
}

#[cfg(windows)]
#[tauri::command]
fn kill_process_command(pid: u32) -> Result<(), String> {
    kill_process(pid)
}

async fn rename_folder(old_path: &str, new_path: &str) -> std::io::Result<()> {
    // Convertir les chemins en Path
    let old_path = Path::new(old_path);
    let new_path = Path::new(new_path);

    // Renommer le dossier
    tokio::fs::rename(old_path, new_path).await?;

    Ok(())
}

#[tauri::command]
async fn rename_directory(old_path: String, new_path: String) -> Result<(), String> {
    println!("Rename: {} to {}", old_path, new_path);
    let _ = rename_folder(&old_path, &new_path).await;

    Ok(())
}

fn main() {
    use tauri::api::path::app_data_dir;
    let url = "https://download.frazionz.net/internal_profiles.json";
    let profiles_game: Vec<ProfileGame> = match Utils::fetch_url_content(url) {
        Ok(profiles_game) => profiles_game,
        Err(e) => {
            eprintln!("Erreur lors de la lecture du fichier JSON : {}", e);
            return;
        }
    };

    let profiles_game_list = Arc::new(Mutex::new(profiles_game));
    let tasks_list: Arc<Mutex<Vec<TaskObject>>> = Arc::new(Mutex::new(Vec::new()));
    let profiles_instance: Arc<Mutex<Vec<InstanceObject>>> = Arc::new(Mutex::new(Vec::new()));

    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
            profiles_games: Arc::clone(&profiles_game_list),
            profiles_instance: Arc::clone(&profiles_instance),
        })
        .manage(TaskManagerState {
            tasks: Arc::clone(&tasks_list),
        })
        .invoke_handler(tauri::generate_handler![
            download_file,
            unzip_file,
            center_window,
            start_child_process,
            authenticate_microsoft,
            create_session,
            get_session,
            delete_session,
            get_profiles,
            get_profiles_game,
            is_directory_empty,
            launch_minecraft,
            add_profile,
            get_profiles,
            open_directory,
            find_task_by_uuid,
            add_task,
            get_tasks,
            start_task,
            update_task,
            get_base64_from_file,
            read_file_from_zip_sync,
            read_base64_from_zip_sync,
            get_instance_from_gameid,
            kill_process_command,
            init_config_profile,
            update_config_profile,
            read_base64_from_file_sync,
            get_profiles_game_user,
            add_profile_custom,
            remove_profile,
            get_java_data,
            rename_directory,
            java_jar_spawn_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

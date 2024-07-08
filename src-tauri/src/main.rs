// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod zip_reader;
use zip_reader::*;
mod auth;
use async_std::task::Task;
use auth::{Auth, Example, MinecraftProfile, MinecraftSession, XboxLiveResponse};
mod utils;
use utils::Utils;
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
use tauri::api::path::app_data_dir;
use tauri::{
    async_runtime::spawn, InvokeError, LogicalSize, PhysicalPosition, PhysicalSize, Window,
    WindowUrl,
};
use tauri::{Manager, State, WindowBuilder};
use tokio::fs::File as AsyncFile;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::oneshot;
use tokio::task;

use std::process::{Command, Stdio};
use tokio::io::AsyncBufReadExt;
use tokio::process::{Child, Command as TokioCommand};

use task_manager::*;
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
            },
            Err(_) => Err("Error".to_string())
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
    println!("Authenticate Microsoft!");
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
                    println!("{}", &url.to_string());
                    let authorization_code = Auth::get_extract_value(&url.to_string(), "code");
                    println!("Authenticate Minecraft..");
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
        println!("Authenticate Microsoft!2");
        let tx = Arc::new(Mutex::new(Some(tx)));
        let tx_clone = Arc::clone(&tx);
        let _auth_refresh_token = tauri::async_runtime::spawn(async move {
            let _ = tauri::async_runtime::spawn(async move {
                println!("Authenticate Microsoft!3");
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
    let child = TokioCommand::new(runtime_dir)
        .args(java_args)
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

    let paths = match fs::read_dir(&libs_dir) {
        Ok(paths) => paths,
        Err(err) => return Err(err.to_string()),
    };

    let mut paths_vec: Vec<PathBuf> = Vec::new();
    for path in paths {
        if let Ok(entry) = path {
            if entry.path().is_file() {
                paths_vec.push(entry.path());
            }
        }
    }

    let mut paths_string = String::new();
    for path in paths_vec {
        paths_string.push_str(&path.to_string_lossy());
        paths_string.push(';');
    }
    paths_string.push_str(&minecraft_jar_path);

    let session = get_session(state, "msa_session".to_string());
    if let Ok(Some(session)) = session {
        println!("SESSION {}", session.mcProfile.id);
        let java_args = [
            format!("-Djava.library.path={}", natives_dir),
            "-DFabricMcEmu= net.minecraft.client.main.Main ".to_string(),
            "-cp".to_string(),
            paths_string,
            main_class.to_string(),
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

        println!("RuntimeDir {}", runtime_dir);

        match start_process_async(runtime_dir, java_args.to_vec()) {
            Ok(mut child) => {

                let pid = child.id().unwrap();
        
                let instance = InstanceObject {
                    id: pid,
                    game_id: data.id,
                };
        
                {
                    println!("Add instance with pid {}", pid);
                    let mut pinstance = state_clone.profiles_instance.lock().unwrap();
                    pinstance.push(instance);
                }
        
                app.emit_all("launch-game-profile-frazionz", Some(pid))
                    .unwrap();
        
                if let Some(stdout) = child.stdout.take() {
                    let _ = tokio::spawn(async move {
                        let reader = tokio::io::BufReader::new(stdout);
                        let mut lines = reader.lines();
                        while let Ok(Some(line)) = lines.next_line().await {
                            println!("stdout: {}", line);
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
                if let Some(pos) = pinstance.iter().position(|instance| instance.id == pid) {
                    println!("Remove instance with pid {}", pid);
                    pinstance.remove(pos);
                    app.emit_all("launch-game-profile-frazionz", Some(()))
                        .unwrap();
                }
            },
            Err(e) => {
                eprintln!("Failed to wait on child process: {}", e);
            }
        }

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

#[cfg(unix)]
fn kill_process(pid: i32) -> Result<(), String> {
    use libc::{c_int};
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

fn main() {
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
            kill_process_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

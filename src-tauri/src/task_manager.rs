use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    thread::{self, Thread},
};

use async_std::{fs, stream::StreamExt, task::Task};
use futures_util::TryFutureExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::fs::File as AsyncFile;
use tokio::{fs::File, io::AsyncWriteExt, runtime::Runtime};

use std::path::Path;

use crate::DownloadProgress;

pub(crate) struct TaskManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskState {
    percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDisplay {
    title: String,
    subtitle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskFile {
    url: String,
    file: String,
    path: String,
    hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskObject {
    task_type: i32,
    uuid: String,
    state: TaskState,
    files: Vec<TaskFile>,
    display: TaskDisplay,
}

pub trait TypesTaskManager {
    type State;
    type TaskObject;
}

impl TypesTaskManager for TaskManager {
    type TaskObject = TaskObject;
    type State = TaskManagerState;
}

impl TaskObject {
    fn new(task_type: i32, uuid: String, files: Vec<TaskFile>, display: TaskDisplay) -> Self {
        let state = TaskState { percentage: 0.0 };
        TaskObject {
            task_type,
            uuid,
            state,
            files,
            display,
        }
    }
}

#[derive(Serialize)]
pub struct TaskProgress {
    uuid: String,
    percentage: f64,
    subtitle: String,
    counter: i32,
    max: usize,
}

impl TaskManagerState {
    pub fn add_task(
        &self,
        app: tauri::AppHandle,
        task_type: &i32,
        uuid: &str,
        files: Vec<TaskFile>,
        display: TaskDisplay,
    ) {
        let mut tasks = self.tasks.lock().unwrap();
        let newTask = TaskObject::new(*task_type, uuid.to_string(), files, display);
        tasks.push(newTask.clone());
        app.emit_all("task-new-instance", Some(&newTask.clone()))
            .unwrap_or(());
    }

    // Méthode pour convertir les tâches en JSON
    fn tasks_to_json(&self) -> String {
        let tasks = self.tasks.lock().unwrap();
        serde_json::to_string(&*tasks).unwrap()
    }

    pub fn find_task_by_uuid(&self, uuid: &str) -> Option<TaskObject> {
        let tasks = self.tasks.lock().unwrap();
        for task in tasks.iter() {
            if task.uuid == uuid {
                return Some(task.clone()); // Cloner l'élément trouvé
            }
        }
        None
    }

    fn find_task_index(&self, task_id: String) -> Option<usize> {
        let tasks = self.tasks.lock().unwrap();
        tasks.iter().position(|task| task.uuid == task_id)
    }

    pub async fn start(state: State<'_, TaskManagerState>, app: tauri::AppHandle, uuid: String) {}
}

pub struct TaskManagerState {
    pub(crate) tasks: Arc<Mutex<Vec<<TaskManager as TypesTaskManager>::TaskObject>>>,
}

#[tauri::command]
pub fn add_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, TaskManagerState>,
    task_type: i32,
    uuid: &str,
    files: Vec<TaskFile>,
    display: TaskDisplay,
) -> Result<(), String> {
    state.add_task(app, &task_type, uuid, files, display);
    Ok(())
}

#[tauri::command]
pub async fn update_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, TaskManagerState>,
    uuid: String,
    task_type: i32,
    files: Vec<TaskFile>,
    display: TaskDisplay,
) -> Result<(), String> {
    // Lock the tasks asynchronously
    let mut tasks = state.tasks.lock().unwrap();

    if let Some(task_id) = tasks.iter().position(|task| task.uuid == uuid) {
        tasks[task_id].task_type = task_type.clone();
        tasks[task_id].files = files.clone();
        tasks[task_id].display = display.clone();

        let updated_task = tasks[task_id].clone();

        println!(
            "{};{}",
            updated_task.display.title, updated_task.display.subtitle
        );

        app.emit_all("update-task-frazionz", Some(&updated_task))
            .unwrap();

        return Ok(());
    }

    Ok(())
}

#[tauri::command]
pub fn find_task_by_uuid(
    state: tauri::State<'_, TaskManagerState>,
    uuid: &str,
) -> Result<Option<TaskObject>, String> {
    Ok(state.find_task_by_uuid(uuid))
}

#[tauri::command]
pub fn get_tasks(state: State<'_, TaskManagerState>) -> Result<Vec<TaskObject>, String> {
    let tasks = state.tasks.lock().unwrap();
    Ok(tasks.to_vec())
}

pub fn get_tasks_wt(state: &TaskManagerState) -> Result<Vec<TaskObject>, String> {
    let tasks = state.tasks.lock().unwrap();
    Ok(tasks.to_vec())
}

#[tauri::command]
pub async fn start_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, TaskManagerState>,
    uuid: String,
) -> Result<(), String> {
    let app = app.clone(); // Clone the AppHandle
    let state_clone = state.clone();
    let task = state_clone.find_task_by_uuid(&uuid).clone().unwrap();
    let uuid_task = task.uuid.clone();
    let files_count = task.files.len();
    let mut counter = 0;
    let tasks = state.tasks.clone();
    tauri::async_runtime::spawn(async move {
        for file in &task.files {
            let base_path = PathBuf::from(&file.path);
            let full_path = base_path.join(&file.file);
            if let Some(full_path_str) = full_path.to_str() {
                counter += 1;
                if !dir_exists(&base_path).await {
                    let _ = tokio::fs::create_dir_all(&base_path).await;
                }
                let _ = download_file(
                    task.clone(),
                    uuid_task.clone(),
                    file.url.clone(),
                    full_path_str.to_string(),
                )
                .await;
            }

            let percentage = (counter as f64 / files_count as f64) * 100.0;

            let tasks: Vec<TaskObject> = tasks.lock().unwrap().clone();
            let mut tasks = tasks.clone();
            let task_id = tasks.iter().position(|t| t.uuid == task.uuid);
            tasks[task_id.unwrap()].state.percentage = percentage;
            tasks[task_id.unwrap()].display.subtitle =
                format!("{} fichiers téléchargés sur {}", counter, files_count);

            let task_test = TaskProgress {
                uuid: task.clone().uuid,
                percentage,
                subtitle: format!("{} fichiers téléchargés sur {}", counter, files_count),
                counter,
                max: files_count,
            };

            let app_clone = app.clone();

            tauri::async_runtime::spawn(async move {
                // Simulez un travail asynchrone
                app_clone
                    .emit_all("update-state-frazionz", Some(&task_test))
                    .unwrap();
            });

            //let tasks = get_tasks(state_clone.into());

            //println!("{}/{}", counter, files_count);
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn dir_exists(path: &Path) -> bool {
    match fs::metadata(path).await {
        Ok(metadata) => metadata.is_dir(),
        Err(_) => false,
    }
}

async fn download_file(
    task: TaskObject,
    uuid: String,
    url: String,
    filename: String,
) -> Result<(), String> {
    let mut _task = task;

    let client = Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let content_length = response.content_length().unwrap_or(0);
    let mut file = AsyncFile::create(filename)
        .await
        .map_err(|e| e.to_string())?;
    let mut downloaded_bytes = 0;

    let mut byte_stream = response.bytes_stream();

    tauri::async_runtime::spawn(async move {
        Ok(while let Some(chunk) = byte_stream.next().await {
            match chunk {
                Ok(chunk) => {
                    let bytes_read = chunk.len();
                    file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                    downloaded_bytes += bytes_read as u64;
                    // Appel du callback avec le nombre de bytes téléchargés et la taille totale du fichier
                    //progress_callback(downloaded_bytes, content_length);
                }
                Err(err) => return Err(err.to_string()),
            }
        })
    });

    Ok(())
}

impl TaskManager {}

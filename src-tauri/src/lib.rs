mod host;
mod settings;
use serde::Serialize;
use settings::Settings;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

const SERVICE: &str = match option_env!("CORELUM_SERVICE_URL") {
    Some(s) => s,
    None => "",
};
#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateStatus {
    phase: String,
    message: String,
    version: Option<String>,
    progress: u32,
    notes: String,
    checked_at: Option<u64>,
}
struct Pending {
    update: tauri_plugin_updater::Update,
    bytes: Option<Vec<u8>>,
    channel: String,
}
struct AppState {
    settings: Mutex<Settings>,
    settings_error: Mutex<Option<String>>,
    status: Mutex<UpdateStatus>,
    pending: tokio::sync::Mutex<Option<Pending>>,
    operation: tokio::sync::Mutex<()>,
    token: Mutex<Option<String>>,
    selected: Mutex<Option<(String, Vec<u8>)>>,
    path: PathBuf,
}
fn publish(app: &tauri::AppHandle, status: UpdateStatus) {
    *app.state::<AppState>().status.lock().unwrap() = status.clone();
    let _ = app.emit("update-status", status);
}
fn stamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
#[tauri::command]
fn app_info(app: tauri::AppHandle, state: State<AppState>) -> serde_json::Value {
    serde_json::json!({"version":app.package_info().version.to_string(),"serviceConfigured":!SERVICE.is_empty(),"service":SERVICE,"settingsError":state.settings_error.lock().unwrap().clone(),"dataDirectory":state.path.parent().unwrap().to_string_lossy(),"build":"Windows x64 · Tauri 2"})
}
#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}
#[tauri::command]
fn save_settings(
    value: Settings,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let mut current = state.settings.lock().unwrap();
    settings::save(&state.path, &value)?;
    *current = value.clone();
    drop(current);
    if let Some(window) = app.get_webview_window("main") {
        let theme = match value.appearance.as_str() {
            "light" => Some(tauri::Theme::Light),
            "dark" => Some(tauri::Theme::Dark),
            _ => None,
        };
        let _ = window.set_theme(theme);
    }
    Ok(())
}
#[tauri::command]
fn update_status(state: State<AppState>) -> UpdateStatus {
    state.status.lock().unwrap().clone()
}
#[tauri::command]
async fn check_updates(app: tauri::AppHandle) -> Result<(), String> {
    perform_check(&app, true).await
}
async fn perform_check(app: &tauri::AppHandle, manual: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let _guard = match state.operation.try_lock() {
        Ok(g) => g,
        Err(_) => return Ok(()),
    };
    let prefs = state.settings.lock().unwrap().clone();
    if !manual && !prefs.auto_check {
        return Ok(());
    }
    if SERVICE.is_empty() {
        publish(
            app,
            UpdateStatus {
                phase: "unconfigured".into(),
                message: "Update service has not been connected to this build.".into(),
                ..Default::default()
            },
        );
        return Ok(());
    }
    {
        let mut p = state.pending.lock().await;
        if let Some(ref pending) = *p {
            if pending.channel == prefs.channel {
                return Ok(());
            } else {
                *p = None;
            }
        }
    }
    let mut status = UpdateStatus {
        phase: "checking".into(),
        message: "Checking for updates…".into(),
        checked_at: Some(stamp()),
        ..Default::default()
    };
    publish(app, status.clone());
    let result=async{
   let endpoint=format!("{}/updates/{}/windows/x86_64/{}",SERVICE.trim_end_matches('/'),prefs.channel,app.package_info().version).parse::<url::Url>().map_err(|_|"Invalid update service")?;
   let updater=app.updater_builder().endpoints(vec![endpoint]).map_err(|_|"Invalid update endpoint")?.timeout(Duration::from_secs(20)).build().map_err(|_|"Updater could not start")?;
   let update=updater.check().await.map_err(|_|"Could not reach the update service. Retrying automatically.")?;
   if let Some(update)=update{
     status.version=Some(update.version.clone());status.notes=update.body.clone().unwrap_or_default();status.phase="available".into();status.message="A signed update is available.".into();publish(app,status.clone());
     if !prefs.auto_download { *state.pending.lock().await=Some(Pending{update,bytes:None,channel:prefs.channel.clone()});return Ok(())}
     status.phase="downloading".into();status.message="Downloading and verifying update…".into();publish(app,status.clone());
     let progress=Arc::new(Mutex::new(0u64));let progress_copy=progress.clone();let handle=app.clone();let base=status.clone();
     let bytes=update.download(move |chunk,total|{let mut n=progress_copy.lock().unwrap();*n+=chunk as u64;let mut s=base.clone();s.progress=total.map(|t|((*n*100)/t.max(1)).min(99) as u32).unwrap_or(0);publish(&handle,s);},||{}).await.map_err(|_|"Download or signature verification failed. The installed application is unchanged; a fresh download will be attempted.")?;
     *state.pending.lock().await=Some(Pending{update,bytes:Some(bytes),channel:prefs.channel});
     status.phase="ready".into();status.progress=100;status.message="Verified update ready. Automatic restart in 20 seconds.".into();publish(app,status.clone());
     if prefs.installation=="automatic"{let handle=app.clone();tauri::async_runtime::spawn(async move{tokio::time::sleep(Duration::from_secs(20)).await;let automatic=handle.state::<AppState>().settings.lock().unwrap().installation=="automatic";if automatic{let _=install_update(handle).await;}});}
   }else{status.phase="current".into();status.message="You’re running the latest release.".into();publish(app,status.clone());}Ok::<(),String>(())
 }.await;
    if let Err(ref error) = result {
        publish(
            app,
            UpdateStatus {
                phase: "error".into(),
                message: error.clone(),
                checked_at: Some(stamp()),
                ..Default::default()
            },
        );
    }
    result
}
#[tauri::command]
async fn download_update(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    {
        let mut p = state.pending.lock().await;
        if let Some(ref pending) = *p {
            if pending.bytes.is_some() {
                return Ok(());
            }
        }
        *p = None;
    }
    let mut prefs = state.settings.lock().unwrap().clone();
    let previous = prefs.auto_download;
    prefs.auto_download = true;
    *state.settings.lock().unwrap() = prefs;
    let result = perform_check(&app, true).await;
    state.settings.lock().unwrap().auto_download = previous;
    result
}
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let _guard = state.operation.lock().await;
    let mut p = state.pending.lock().await;
    let pending = p.as_ref().ok_or("No verified update is staged")?;
    if pending.channel != state.settings.lock().unwrap().channel {
        return Err("Channel changed. Check for updates again.".into());
    }
    let bytes = pending.bytes.as_ref().ok_or("Download the update first")?;
    settings::save(&state.path, &state.settings.lock().unwrap())?;
    let marker = state.path.with_file_name("pending-install.json");
    std::fs::write(&marker,serde_json::to_vec(&serde_json::json!({"from":app.package_info().version.to_string(),"to":pending.update.version,"at":stamp()})).unwrap()).map_err(|_|"Could not save recovery marker")?;
    publish(
        &app,
        UpdateStatus {
            phase: "installing".into(),
            message: "Installing verified update. Corelum will reopen shortly.".into(),
            progress: 100,
            ..Default::default()
        },
    );
    if pending.update.install(bytes).is_err() {
        *p = None;
        publish(&app,UpdateStatus{phase:"error".into(),message:"Installation did not complete. Your settings are preserved. Restart and try again.".into(),..Default::default()});
        return Err("Installation failed".into());
    }
    Ok(())
}
fn credentials() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.corelum.network", "admin-session")
        .map_err(|_| "Windows Credential Manager is unavailable".into())
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Network client unavailable".into())
}
async fn request(
    app: &tauri::AppHandle,
    path: &str,
    method: &str,
    data: Option<String>,
) -> Result<serde_json::Value, String> {
    if SERVICE.is_empty() {
        return Err("Administration service has not been connected to this build.".into());
    }
    if !path.starts_with('/')
        || path.contains("..")
        || path.contains('#')
        || path.contains("://")
        || !["GET", "POST", "PUT"].contains(&method)
    {
        return Err("Invalid service request".into());
    }
    let state = app.state::<AppState>();
    let token = state.token.lock().unwrap().clone();
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid request")?;
    let mut req = client()?.request(verb, format!("{}{}", SERVICE.trim_end_matches('/'), path));
    if let Some(t) = token {
        req = req.bearer_auth(t)
    }
    if let Some(body) = data {
        req = req.header("Content-Type", "application/json").body(body)
    }
    let response = req
        .send()
        .await
        .map_err(|e| if e.is_timeout() { "The AI request timed out. Please retry with a shorter message." } else { "Could not connect to the administration service" })?;
    let status = response.status();
    let value: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "The service returned an invalid response")?;
    if !status.is_success() {
        return Err(value["error"]
            .as_str()
            .unwrap_or("The service request failed")
            .to_string());
    }
    Ok(value)
}
#[tauri::command]
async fn login(app: tauri::AppHandle, email: String, password: String) -> Result<(), String> {
    let value = request(
        &app,
        "/auth/login",
        "POST",
        Some(serde_json::json!({"email":email,"password":password}).to_string()),
    )
    .await?;
    let token = value["token"]
        .as_str()
        .ok_or("Invalid authentication response")?
        .to_owned();
    credentials()?
        .set_password(&token)
        .map_err(|_| "Could not store the session securely")?;
    *app.state::<AppState>().token.lock().unwrap() = Some(token);
    Ok(())
}
#[tauri::command]
async fn register(app: tauri::AppHandle, username: String, password: String) -> Result<(), String> {
    request(
        &app,
        "/auth/register",
        "POST",
        Some(serde_json::json!({"username":username,"password":password}).to_string()),
    )
    .await
    .map(|_| ())
}
#[tauri::command]
async fn logout(app: tauri::AppHandle) -> Result<(), String> {
    let result = request(&app, "/logout", "POST", None).await;
    let _ = credentials()?.delete_credential();
    *app.state::<AppState>().token.lock().unwrap() = None;
    result.map(|_| ())
}
#[tauri::command]
async fn admin_api(
    app: tauri::AppHandle,
    path: String,
    method: String,
    data: Option<String>,
) -> Result<serde_json::Value, String> {
    if method != "GET"
        && (path.ends_with("/publish")
            || (path == "/policy"
                && data
                    .as_ref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                    .and_then(|v| v["autoPublish"].as_bool())
                    == Some(true)))
        && !host::deployment_ready()
    {
        return Err(
            "The operation could not be completed. Please try again or contact the administrator."
                .into(),
        );
    }
    if path.starts_with("/auth/") {
        return Err("Use the sign-in command".into());
    }
    request(&app, &path, &method, data).await
}
fn select_file(app: &tauri::AppHandle, path: PathBuf) -> Result<serde_json::Value, String> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        != Some("zip".into())
    {
        return Err("Choose a ZIP archive".into());
    }
    let meta = std::fs::symlink_metadata(&path).map_err(|_| "Cannot read archive")?;
    if !meta.is_file() || meta.len() > 4194304 {
        return Err("Choose a regular ZIP file no larger than 4 MiB".into());
    }
    let bytes = std::fs::read(&path).map_err(|_| "Cannot read ZIP archive")?;
    let name = path.file_name().unwrap().to_string_lossy().to_string();
    let info = serde_json::json!({"name":name,"size":bytes.len()});
    *app.state::<AppState>().selected.lock().unwrap() = Some((name, bytes));
    Ok(info)
}
#[tauri::command]
async fn choose_zip(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let selected = handle
            .dialog()
            .file()
            .add_filter("Development archive", &["zip"])
            .blocking_pick_file()
            .ok_or("No archive selected")?;
        select_file(
            &handle,
            selected
                .into_path()
                .map_err(|_| "Unsupported archive location")?,
        )
    })
    .await
    .map_err(|_| "Could not open the file picker")?
}
#[tauri::command]
async fn upload_zip(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    if SERVICE.is_empty() {
        return Err("Administration service is not configured".into());
    }
    let state = app.state::<AppState>();
    let (_, bytes) = state
        .selected
        .lock()
        .unwrap()
        .take()
        .ok_or("Select an archive first")?;
    let token = state
        .token
        .lock()
        .unwrap()
        .clone()
        .ok_or("Sign in as an administrator")?;
    let total = bytes.len();
    let handle = app.clone();
    let mut sent = 0usize;
    let chunks: Vec<Vec<u8>> = bytes.chunks(65536).map(|b| b.to_vec()).collect();
    let stream = futures_util::stream::iter(chunks.into_iter().map(move |chunk| {
        sent += chunk.len();
        let _ = handle.emit("upload-progress", (sent * 100 / total.max(1)) as u32);
        Ok::<_, std::io::Error>(chunk)
    }));
    let res = client()?
        .post(format!("{}/deployments", SERVICE.trim_end_matches('/')))
        .bearer_auth(token)
        .header("Content-Type", "application/zip")
        .header("Content-Length", total)
        .body(reqwest::Body::wrap_stream(stream))
        .send()
        .await
        .map_err(|_| "Upload interrupted. Select the archive and try again.")?;
    let status = res.status();
    let value: serde_json::Value = res.json().await.map_err(|_| "Invalid upload response")?;
    if !status.is_success() {
        return Err(value["error"].as_str().unwrap_or("Upload failed").into());
    }
    Ok(value)
}
#[tauri::command]
fn update_history(state: State<AppState>) -> serde_json::Value {
    std::fs::read(state.path.with_file_name("history.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(serde_json::json!([]))
}
pub fn run() {
    tauri::Builder::default()
 .plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}))
 .plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_autostart::Builder::new().args(["--autostart"]).build()).plugin(tauri_plugin_updater::Builder::new().build())
 .setup(|app|{
  let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;let path=dir.join("settings.json");let loaded=settings::load(&path);let error=loaded.as_ref().err().cloned();let prefs=loaded.unwrap_or_default();let start_minimized=prefs.start_minimized;
  let token=credentials().ok().and_then(|e|e.get_password().ok());let marker=dir.join("pending-install.json");let mut initial=UpdateStatus{phase:"idle".into(),message:"Ready to check for updates".into(),..Default::default()};
  if let Ok(bytes)=std::fs::read(&marker){if let Ok(pending)=serde_json::from_slice::<serde_json::Value>(&bytes){let success=pending["to"].as_str()==Some(&app.package_info().version.to_string());initial.message=if success{"Update installed successfully. Your settings are preserved."}else{"The previous update did not complete. A new download will be attempted."}.into();let history_path=dir.join("history.json");let mut history:Vec<serde_json::Value>=std::fs::read(&history_path).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default();history.insert(0,serde_json::json!({"version":pending["to"],"from":pending["from"],"success":success,"at":stamp()}));history.truncate(50);let _=std::fs::write(history_path,serde_json::to_vec_pretty(&history).unwrap());}let _=std::fs::remove_file(marker);}
  app.manage(AppState{settings:Mutex::new(prefs),settings_error:Mutex::new(error),status:Mutex::new(initial),pending:tokio::sync::Mutex::new(None),operation:tokio::sync::Mutex::new(()),token:Mutex::new(token),selected:Mutex::new(None),path});
  let show=tauri::menu::MenuItem::with_id(app,"show","Open Corelum",true,None::<&str>)?;let quit=tauri::menu::MenuItem::with_id(app,"quit","Quit Corelum",true,None::<&str>)?;let menu=tauri::menu::Menu::with_items(app,&[&show,&quit])?;
  tauri::tray::TrayIconBuilder::new().icon(app.default_window_icon().unwrap().clone()).tooltip("Corelum").menu(&menu).on_menu_event(|app,event|{if event.id.as_ref()=="show"{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}else if event.id.as_ref()=="quit"{let handle=app.clone();tauri::async_runtime::spawn(async move{let should=handle.state::<AppState>().settings.lock().unwrap().installation=="onExit";if should {if install_update(handle.clone()).await.is_ok(){return}}handle.exit(0);});}}).build(app)?;
  if let Some(w)=app.get_webview_window("main"){
    if start_minimized&&std::env::args().any(|a|a=="--autostart"){let _=w.hide();}
    let handle=app.handle().clone();
    w.on_window_event(move|event|{match event{
      tauri::WindowEvent::CloseRequested{api,..}=>{
        let s=handle.state::<AppState>();let prefs=s.settings.lock().unwrap().clone();
        if prefs.minimize_to_tray{api.prevent_close();if let Some(w)=handle.get_webview_window("main"){let _=w.hide();}}
        else if prefs.installation=="onExit"{api.prevent_close();let h=handle.clone();tauri::async_runtime::spawn(async move{if install_update(h.clone()).await.is_err(){h.exit(0)}});}
      },
      tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop{paths,..})=>{
        if paths.len()==1{match select_file(&handle,paths[0].clone()){
          Ok(v)=>{let _=handle.emit("zip-selected",v);},
          Err(e)=>{let _=handle.emit("zip-error",e);}
        }}
      },_=>{}
    }});
  }
  let handle=app.handle().clone();tauri::async_runtime::spawn(async move{tokio::time::sleep(Duration::from_secs(2)).await;loop{let _=perform_check(&handle,false).await;tokio::time::sleep(Duration::from_secs(30 * 60)).await;}});Ok(())
 })
 .invoke_handler(tauri::generate_handler![app_info,get_settings,save_settings,update_status,check_updates,download_update,install_update,login,register,logout,admin_api,choose_zip,upload_zip,update_history])
 .run(tauri::generate_context!()).expect("Corelum could not start");
}

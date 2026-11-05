use serde::{Deserialize, Serialize};
use std::path::Path;
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub schema: u32,
    pub appearance: String,
    pub accent: String,
    pub startup_page: String,
    pub start_minimized: bool,
    pub minimize_to_tray: bool,
    pub channel: String,
    pub auto_check: bool,
    pub auto_download: bool,
    pub installation: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            schema: 1,
            appearance: "dark".into(),
            accent: "#a5a0ff".into(),
            startup_page: "home".into(),
            start_minimized: false,
            minimize_to_tray: true,
            channel: "stable".into(),
            auto_check: true,
            auto_download: true,
            installation: "automatic".into(),
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != 1
            || !["dark", "light", "system"].contains(&self.appearance.as_str())
            || !["home", "workspace"].contains(&self.startup_page.as_str())
            || !["stable", "beta"].contains(&self.channel.as_str())
            || !["automatic", "prompt", "onExit"].contains(&self.installation.as_str())
            || self.accent.len() != 7
            || !self.accent.starts_with('#')
            || !self.accent[1..].bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("Invalid settings".into());
        }
        Ok(())
    }
}
pub fn load(path: &Path) -> Result<Settings, String> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = std::fs::read(path).map_err(|_| "Could not read settings")?;
    let settings: Settings = serde_json::from_slice(&bytes).map_err(|_| {
        "Settings are damaged. Restore settings.json.bak from your app data folder."
    })?;
    settings.validate()?;
    Ok(settings)
}
pub fn save(path: &Path, value: &Settings) -> Result<(), String> {
    value.validate()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|_| "Could not create app data folder")?;
    }
    if path.exists() {
        std::fs::copy(path, path.with_extension("json.bak"))
            .map_err(|_| "Could not back up settings")?;
    }
    let tmp = path.with_extension("json.tmp");
    use std::io::Write;
    let mut f = std::fs::File::create(&tmp).map_err(|_| "Could not stage settings")?;
    f.write_all(&serde_json::to_vec_pretty(value).map_err(|_| "Could not encode settings")?)
        .map_err(|_| "Could not write settings")?;
    f.sync_all().map_err(|_| "Could not flush settings")?;
    std::fs::rename(tmp, path).map_err(|_| "Could not save settings")?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_validation() {
        let mut s = Settings::default();
        assert!(s.validate().is_ok());
        s.channel = "untrusted".into();
        assert!(s.validate().is_err());
    }
    #[test]
    fn migration_defaults() {
        let s: Settings = serde_json::from_str("{\"schema\":1,\"appearance\":\"light\"}").unwrap();
        assert!(s.auto_check);
        assert_eq!(s.appearance, "light");
    }
    #[test]
    fn settings_survive_write() {
        let path =
            std::env::temp_dir().join(format!("nimbus-settings-{}.json", std::process::id()));
        let mut s = Settings::default();
        s.accent = "#112233".into();
        save(&path, &s).unwrap();
        assert_eq!(load(&path).unwrap().accent, s.accent);
        s.appearance = "light".into();
        save(&path, &s).unwrap();
        assert!(path.with_extension("json.bak").exists());
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("json.bak"));
    }
}

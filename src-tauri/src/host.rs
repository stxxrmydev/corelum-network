pub fn deployment_ready() -> bool {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let root = RegKey::predef(HKEY_LOCAL_MACHINE);
    let Ok(video) = root.open_subkey("SYSTEM\\CurrentControlSet\\Control\\Video") else {
        return false;
    };
    for name in video.enum_keys().flatten() {
        if let Ok(device) = video.open_subkey(format!("{}\\0000", name)) {
            if let Ok(id) = device.get_value::<String, _>("MatchingDeviceId") {
                if id.to_ascii_lowercase().contains("ven_10de") {
                    return true;
                }
            }
        }
    }
    false
}

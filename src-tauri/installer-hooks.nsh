!macro NSIS_HOOK_POSTINSTALL
  ; Remove only the previous application label after an in-place branding update.
  ${If} ${FileExists} "$INSTDIR\corelum-network.exe"
    Delete "$DESKTOP\Corelum Network.lnk"
    Delete "$SMPROGRAMS\Corelum Network\Corelum Network.lnk"
    RMDir "$SMPROGRAMS\Corelum Network"
    DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Corelum Network"
  ${EndIf}
!macroend

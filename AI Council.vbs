' AI Council — Silent Launcher
' Runs the Electron app without showing a CMD window.

Dim fso, shell, appDir, electronExe, distIndex

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

appDir    = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = appDir & "\node_modules\electron\dist\electron.exe"
distIndex   = appDir & "\dist\index.html"

' Check electron exists
If Not fso.FileExists(electronExe) Then
  MsgBox "Electron을 찾을 수 없습니다." & vbCrLf & vbCrLf & electronExe, vbCritical, "AI Council"
  WScript.Quit
End If

' Auto-build if dist/index.html is missing
If Not fso.FileExists(distIndex) Then
  Dim answer
  answer = MsgBox("앱이 아직 빌드되지 않았습니다. 지금 빌드하시겠습니까?" & vbCrLf & "(약 5~10초 소요)", vbYesNo + vbQuestion, "AI Council")
  If answer = vbNo Then WScript.Quit

  shell.Run "cmd /c cd /d """ & appDir & """ && npm run build", 1, True

  If Not fso.FileExists(distIndex) Then
    MsgBox "빌드에 실패했습니다. CMD 창에서 'npm run build'를 직접 실행해 주세요.", vbCritical, "AI Council"
    WScript.Quit
  End If
End If

' Launch Electron silently (window 0 = hidden CMD)
shell.Run """" & electronExe & """ """ & appDir & """", 0, False

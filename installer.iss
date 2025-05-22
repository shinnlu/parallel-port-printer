#define MyAppName "Parallel Port Printer"
#define MyAppVersion "1.0.9"
#define MyAppPublisher "ParallelPort Printer"
#define MyAppExeName "start-server.bat"

[Setup]
AppId={{b2cbe8c3-a12e-4089-81bf-462bb71fa371}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=build/
OutputBaseFilename=ParallelPortPrinter-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "tchineseb"; MessagesFile: "compiler:Languages\ChineseTraditional.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "開機時自動啟動"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "check-update.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-server.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "server-dev.js"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service-x64.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service-x86.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "nssm\*"; DestDir: "{app}\nssm"; Flags: ignoreversion recursesubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\tmp"; Permissions: users-full

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{commonstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\tmp"

[Code]
var
  ResultCode: Integer;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    // 關閉正在運行的 node.exe 進程
    Exec('taskkill', '/F /IM node.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
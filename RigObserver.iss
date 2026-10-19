
#define MyAppName "RigObserver"
#define MyAppVersion "0.3.0"
#define MyAppPublisher "Konstantinos Nikolakopoulos"
#define MyAppExeName "RigObserver.exe"

[Setup]
AppId={{3A1BFC10-01DC-45BB-8A6B-0EAF662D14E5}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/KostasNikP/RigObserver
AppSupportURL=https://github.com/KostasNikP/RigObserver/issues

DefaultDirName={userpf}\RigObserver
DefaultGroupName=RigObserver

PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

OutputDir=installer
OutputBaseFilename=RigObserver_Setup_v0.3.0

SetupIconFile=assets\RigObserver.ico
UninstallDisplayIcon={app}\RigObserver.exe

Compression=lzma2
SolidCompression=yes
WizardStyle=modern

CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "dist\RigObserver\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\RigObserver"; Filename: "{app}\RigObserver.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\RigObserver"; Filename: "{app}\RigObserver.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\RigObserver.exe"; Description: "Launch RigObserver"; Flags: nowait postinstall skipifsilent


#define MyAppName "PulseWatch"
#define MyAppVersion "0.2.0"
#define MyAppPublisher "Konstantinos Nikolakopoulos"
#define MyAppExeName "PulseWatch.exe"

[Setup]
AppId={{3A1BFC10-01DC-45BB-8A6B-0EAF662D14E5}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/KostasNikP/PulseWatch
AppSupportURL=https://github.com/KostasNikP/PulseWatch/issues

DefaultDirName={userpf}\PulseWatch
DefaultGroupName=PulseWatch

PrivilegesRequired=lowest
SetupArchitecture=x64

OutputDir=installer
OutputBaseFilename=PulseWatch_Setup_v0.2.0

SetupIconFile=assets\PulseWatch.ico
UninstallDisplayIcon={app}\PulseWatch.exe

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
Source: "dist\desktop-v0.2.0-rc\PulseWatch\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\PulseWatch"; Filename: "{app}\PulseWatch.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\PulseWatch"; Filename: "{app}\PulseWatch.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\PulseWatch.exe"; Description: "Launch PulseWatch"; Flags: nowait postinstall skipifsilent

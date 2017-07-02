@ECHO OFF
SETLOCAL EnableDelayedExpansion
:START
COLOR 0F
ECHO.
SET /P MODE=EXIT(3) - ShowUp(2) - Chaturbate(1) - MyFreeCams(0)(ENTER): 
ECHO.
IF "%MODE%"=="" GOTO MFC
IF "%MODE%"=="0" GOTO MFC
IF "%MODE%"=="1" GOTO CB
IF "%MODE%"=="2" GOTO SU
IF "%MODE%"=="3" GOTO EXIT
:MFC
CLS && ECHO ########################################
ECHO ###  MFC Node Recorder by horacio9a  ###
ECHO ########################################
cd/
cd -nm-mfc
start node main.js
ECHO.
GOTO START
:CB
CLS && ECHO #######################################
ECHO ###  CB Node Recorder by horacio9a  ###
ECHO #######################################
cd/
cd -nm-cb
start node main.js
ECHO.
GOTO START
:SU
CLS && ECHO #######################################
ECHO ###  SU Node Recorder by horacio9a  ###
ECHO #######################################
cd/
cd -nm-su
start node main.js
ECHO.
GOTO START
:EXIT
GOTO :EOF
ENDLOCAL

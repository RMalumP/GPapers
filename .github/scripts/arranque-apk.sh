#!/bin/bash
# Primer y segundo arranque de la APK en el emulador, mirando cada 0,3 s qué actividad está en pantalla.
# Si en medio aparece la pantalla de inicio (NexusLauncher), es el fallo de «se va a la pantalla principal mientras carga».
# Uso: arranque-apk.sh etiqueta1 apk1 [etiqueta2 apk2 ...]
PKG=io.github.rmalump.gpapers
adb root >/dev/null 2>&1; sleep 3
# Chrome como en un móvil de verdad: sin su pantalla de bienvenida (en el emulador nunca se ha abierto) y dando por buena la firma de prueba (la APK de depuración no es la de assetlinks.json)
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run --disable-digital-asset-link-verification-for-url=https://rmalump.github.io" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome
adb shell am start -W -a android.intent.action.VIEW -d about:blank com.android.chrome >/dev/null; sleep 8; adb shell input keyevent HOME; sleep 2
mirar() {   # $1: etiqueta
  local t0=$(date +%s%N) prev=''
  adb logcat -c
  adb shell am start -n $PKG/com.google.androidbrowserhelper.trusted.LauncherActivity >/dev/null
  for i in $(seq 1 30); do   # qué actividad está delante y qué colores se ven (cada ~0,5 s)
    local top=$(adb shell dumpsys activity activities | grep -m1 -E 'topResumedActivity' | grep -oE '[a-z0-9.]+/[A-Za-z0-9.$_]+' | head -1 | sed 's/.*\.//')
    echo "[$1] $(( ($(date +%s%N) - t0) / 1000000 )) ms: ${top:-(nada)} · $(adb exec-out screencap | python3 "$(dirname "$0")/pantalla.py")"
  done
  adb logcat -d | grep -E "SplashScreenStrategy|doesn't support splash" | head -3
  echo "[$1] tareas al final:"; adb shell dumpsys activity activities | grep -E '^\s+\* Task\{|Hist #' | head -12
  echo "[$1] registro:"; adb logcat -d | grep -E "START u0|m=(OPEN|CLOSE|TO_FRONT|TO_BACK)|Displayed|TwaLauncher|TWALauncher|LauncherActivity.*finish" | cut -c1-240 | head -30
}
while [ $# -ge 2 ]; do
  adb uninstall $PKG >/dev/null 2>&1; adb install -r "$2" >/dev/null
  adb shell am force-stop com.android.chrome; sleep 1
  mirar "$1 · primer arranque (Chrome cerrado)"
  adb shell input keyevent HOME; adb shell am force-stop $PKG; sleep 2
  mirar "$1 · segundo arranque (Chrome abierto)"
  adb shell input keyevent HOME; adb shell am force-stop $PKG; adb shell am force-stop com.android.chrome; sleep 2
  mirar "$1 · tercer arranque (Chrome cerrado)"
  adb shell input keyevent HOME; sleep 2
  shift 2
done

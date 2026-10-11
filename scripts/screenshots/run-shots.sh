#!/bin/zsh
# Takes the field app screenshots in one language on one simulator, from a
# freshly erased device, then shuts it down. See README.md.
#   SHOTS_PASSWORD=… run-shots.sh <simulator udid> <es|en|pt> <PadiushCompanion.app>
set -euo pipefail
U=$1; L=$2; APP=$3
BASE=${0:A:h}
OUT=$BASE/out/$L
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" MAESTRO_CLI_NO_ANALYTICS=1

case $L in
  es) LANGS=es-419; LOCALE=es_SV; PLANT="flor de muerto";   PART=Flor;   PREP="Infusión"
      AGE_LABEL=Edad;  PLANT_LABEL="Nombre local de la planta"; NUMBER_LABEL="Número de colecta"; NAME_LABEL="Nombre local";;
  en) LANGS=en;     LOCALE=en_US; PLANT="marigold";         PART=Flower; PREP="Infusion"
      AGE_LABEL=Age;   PLANT_LABEL="Local name of the plant";   NUMBER_LABEL="Collection number"; NAME_LABEL="Local name";;
  pt) LANGS=pt-BR;  LOCALE=pt_BR; PLANT="cravo-de-defunto"; PART=Flor;   PREP="Infusão"
      AGE_LABEL=Idade; PLANT_LABEL="Nome local da planta";      NUMBER_LABEL="Número de coleta"; NAME_LABEL="Nome local";;
esac

xcrun simctl shutdown $U 2>/dev/null || true
xcrun simctl erase $U
xcrun simctl boot $U
xcrun simctl bootstatus $U -b >/dev/null
xcrun simctl spawn $U defaults write -g AppleLanguages -array $LANGS
xcrun simctl spawn $U defaults write -g AppleLocale -string $LOCALE
# The language takes effect on the next boot.
xcrun simctl shutdown $U
xcrun simctl boot $U
xcrun simctl bootstatus $U -b >/dev/null
xcrun simctl addmedia $U $BASE/photos/tagetes-erecta.jpg $BASE/photos/moringa-oleifera.jpg
xcrun simctl install $U $APP
for s in photos location microphone camera; do
  xcrun simctl privacy $U grant $s com.padiushbio.companion 2>/dev/null || true
done
xcrun simctl location $U set 13.6929,-89.2182
xcrun simctl status_bar $U override --time 9:41 --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100

# A freshly erased simulator's accessibility layer can crash the first app it
# is attached to; let it settle on a throwaway launch first.
xcrun simctl launch $U com.padiushbio.companion >/dev/null
sleep 8
xcrun simctl terminate $U com.padiushbio.companion || true

run() {
  rm -rf $OUT && mkdir -p $OUT
  cd $BASE
  ~/.maestro/maestro/bin/maestro --device $U test --test-output-dir $OUT \
    -e EMAIL=screenshots-$L@padiush.test -e PASSWORD="$SHOTS_PASSWORD" \
    -e PLANT="$PLANT" -e CATEGORY=Medicinal -e PART="$PART" -e PREP="$PREP" \
    -e AGE_LABEL="$AGE_LABEL" -e PLANT_LABEL="$PLANT_LABEL" -e NUMBER_LABEL="$NUMBER_LABEL" -e NAME_LABEL="$NAME_LABEL" \
    shots.yaml
}
run || { echo "retrying once"; run; } || STATUS=$?
xcrun simctl shutdown $U
exit ${STATUS:-0}

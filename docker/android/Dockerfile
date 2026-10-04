# A local Android build environment: everything `expo prebuild` and Gradle
# need to turn this app into an APK, without Android Studio on the host.
#
# Release builds still go through EAS (see the README); this is for building a
# development copy to put on a phone with adb. Versions follow what the
# project's own toolchain asks for — React Native's version catalog
# (node_modules/react-native/gradle/libs.versions.toml) and the Gradle wrapper
# that prebuild generates — so a dependency upgrade that moves them means
# moving them here too.

FROM node:22-bookworm-slim AS node

FROM eclipse-temurin:17-jdk-jammy@sha256:51d32af96fb8a13ffbc96c719d7b05447a04ca69f314627d64050a64ecd13057

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
    && rm -rf /var/lib/apt/lists/*

# Gradle runs Node itself (autolinking, codegen and the JS bundle), so the
# build needs both in one place.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/home/android/.gradle
ENV PATH="${ANDROID_HOME}/cmdline-tools/19.0/bin:${PATH}"

RUN curl --fail --location --retry 3 \
      https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip -o /tmp/tools.zip \
    && echo '7ec965280a073311c339e571cd5de778b9975026cfcbe79f2b1cdcb1e15317ee  /tmp/tools.zip' | sha256sum -c - \
    && mkdir -p "${ANDROID_HOME}/cmdline-tools" \
    && unzip -q /tmp/tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
    && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/19.0" \
    && rm /tmp/tools.zip \
    && yes | sdkmanager --licenses >/dev/null

# The SDK components the build would otherwise try to download on its own,
# into a directory it cannot write to. Two of some, because not every module
# asks for the same one: React Native's catalog names NDK 27.1 and Build-Tools
# 36, and a module that names neither (expo-sqlite, which compiles SQLCipher;
# the date picker) gets the Android Gradle plugin's own defaults, NDK 27.0 and
# Build-Tools 35. This list is exactly what a build against a writable SDK
# installed for itself.
RUN sdkmanager \
      'platform-tools' \
      'platforms;android-36' \
      'build-tools;36.0.0' \
      'build-tools;35.0.0' \
      'ndk;27.1.12297006' \
      'ndk;27.0.12077973' \
      'cmake;3.22.1' \
    && chmod -R a+rX "${ANDROID_HOME}" \
    && useradd --create-home --uid 1000 android \
    && mkdir -p /home/android/.gradle /home/android/.android /home/android/.npm \
    && chown -R android:android /home/android

USER android
WORKDIR /workspace

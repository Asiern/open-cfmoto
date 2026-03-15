{
  description = "open-cfmoto dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; config.allowUnfree = true; config.android_sdk.accept_license = true; };

        # Python env for decode-btsnoop.py
        python = pkgs.python3.withPackages (ps: [
          ps.scapy
        ]);

        # Android SDK — matches React Native 0.76 requirements
        # compileSdk/targetSdk 34, NDK 27.1.12297006, build-tools 35.0.0
        androidSdk = (pkgs.androidenv.composeAndroidPackages {
          buildToolsVersions = [ "34.0.0" "35.0.0" "36.0.0" ];
          platformVersions   = [ "34" "35" "36" ];
          abiVersions        = [ "x86_64" ];      # x86_64 only — emulator + build
          includeNDK         = true;
          ndkVersions        = [ "27.1.12297006" ];
          includeCmake       = true;
          cmakeVersions      = [ "3.22.1" ];
          includeEmulator    = true;
          includeSystemImages = true;
          systemImageTypes   = [ "google_apis_playstore" ];
          extraLicenses      = [
            "android-googletv-license"
            "android-sdk-arm-dbt-license"
            "android-sdk-license"
            "android-sdk-preview-license"
            "google-gdk-license"
            "intel-android-extra-license"
            "intel-android-sysimage-license"
            "mips-android-sysimage-license"
          ];
        }).androidsdk;
      in
      {
        devShells.default = pkgs.mkShell {
          name = "open-cfmoto";

          packages = with pkgs; [
            # JS toolchain
            nodejs_20
            nodePackages.pnpm
            nodePackages.typescript

            # Java (required by jadx, Gradle, and local Android builds)
            jdk17

            # Android SDK (local builds: compileSdk 34, NDK 26.1.10909125)
            androidSdk

            # APK reverse engineering
            jadx

            # Android debug bridge (adb, sideload APK, pull btsnoop)
            android-tools

            # Python for decode-btsnoop.py
            python

            # Protobuf compiler (for ts-proto codegen: pnpm proto:gen)
            protobuf

            # GitHub CLI
            gh

            # Useful RE extras
            wireshark-cli   # tshark — filter btsnoop without GUI
          ];

          shellHook = ''
            export ANDROID_HOME="${androidSdk}/libexec/android-sdk"
            export ANDROID_SDK_ROOT="$ANDROID_HOME"
            # nixpkgs places the NDK at ndk-bundle, not ndk/VERSION
            export ANDROID_NDK_HOME="$ANDROID_HOME/ndk-bundle"
            export ANDROID_NDK_ROOT="$ANDROID_NDK_HOME"
            export JAVA_HOME="${pkgs.jdk17}"

            echo "open-cfmoto dev shell"
            echo "  node         $(node --version)"
            echo "  pnpm         $(pnpm --version)"
            echo "  java         $(java -version 2>&1 | head -1)"
            echo "  jadx         $(jadx --version 2>/dev/null || echo 'ok')"
            echo "  adb          $(adb --version 2>/dev/null | head -1)"
            echo "  ANDROID_HOME $ANDROID_HOME"
            echo ""
            echo "Quick start:"
            echo "  pnpm install"
            echo "  pnpm --filter @open-cfmoto/ble-protocol test"
            echo "  cd apps/mobile && npx expo run:android   # local build"
          '';
        };
      }
    );
}

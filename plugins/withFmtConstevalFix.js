// Config plugin — fixes the Xcode 26 build error:
//   "call to consteval function fmt::basic_format_string ... is not a constant expression"
// Xcode 26's stricter Clang rejects the compile-time format-string checking in the
// `fmt` library. fmt is header-only, so the failing call sites are spread across many
// React Native pods (React-Core, RCT-Folly, etc.) — not just the `fmt` target. So we
// define FMT_USE_CONSTEVAL=0 for EVERY pod target, which makes fmt fall back to runtime
// format checking wherever it's included. We do NOT change the C++ standard (RN needs C++20).
// Remove once React Native ships a newer fmt that builds on Xcode 26.
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const HOOK = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        defs = bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] if defs.is_a?(String)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes("FMT_USE_CONSTEVAL=0")) {
        if (contents.match(/post_install do \|installer\|/)) {
          contents = contents.replace(
            /post_install do \|installer\|/,
            (m) => m + HOOK,
          );
        } else {
          contents += `\npost_install do |installer|${HOOK}\nend\n`;
        }
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};

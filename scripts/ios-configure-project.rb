# Edits ios/App/App.xcodeproj without Xcode: adds the Widgets extension
# (Home Screen widget, workout Live Activity, Control Center button) and the
# Apple Watch app, registers the app's own Swift files, and sets
# entitlements and the minimum OS versions.
#
# Safe to re-run: it only adds what's missing. Needs the xcodeproj gem
# (`gem install xcodeproj`), the library CocoaPods uses to edit projects.
#
#   ruby scripts/ios-configure-project.rb
require "xcodeproj"

ROOT = File.expand_path("../ios/App", __dir__)
DEPLOYMENT = "17.0"
# watchOS 10 is as far as the first Apple Watch SE goes.
WATCH_DEPLOYMENT = "10.0"
APP_ID = "com.kkrwhofrags.hellblazer"
WIDGETS_ID = "#{APP_ID}.widgets"
WATCH_ID = "#{APP_ID}.watchkitapp"
WATCH_WIDGETS_ID = "#{WATCH_ID}.widgets"

project = Xcodeproj::Project.open(File.join(ROOT, "App.xcodeproj"))
app = project.targets.find { |t| t.name == "App" } or abort("No App target")

def group(project, path)
  project.main_group.children.find { |g| g.is_a?(Xcodeproj::Project::Object::PBXGroup) && g.path == path } ||
    project.main_group.new_group(path, path)
end

def file(group, name)
  group.files.find { |f| f.path == name } || group.new_reference(name)
end

def compile(target, ref)
  target.source_build_phase.add_file_reference(ref, true)
end

def bundle(target, ref)
  target.resources_build_phase.add_file_reference(ref, true)
end

# --- The app target ---------------------------------------------------------
app_group = group(project, "App")
%w[
  HellBlazerViewController.swift HellBlazerNativePlugin.swift AppShortcuts.swift
  WatchBridge.swift RestNotificationDelegate.swift SpotlightIndex.swift WidgetRefresher.swift
].each do |name|
  compile(app, file(app_group, name))
end
file(app_group, "App.entitlements")
bundle(app, file(app_group, "PrivacyInfo.xcprivacy"))

app.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements"
  config.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT
end
project.build_configurations.each do |config|
  config.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT
end

# --- The widget extension ---------------------------------------------------
widgets = project.targets.find { |t| t.name == "Widgets" } ||
  project.new_target(:app_extension, "Widgets", :ios, DEPLOYMENT, nil, :swift)

widgets_group = group(project, "Widgets")
%w[
  HellBlazerWidgets.swift Brand.swift WorkoutLiveActivity.swift NextBoutWidget.swift StartWorkoutControl.swift
  MuscleSetsWidget.swift LiftTrendWidget.swift
].each do |name|
  compile(widgets, file(widgets_group, name))
end
file(widgets_group, "Info.plist")
file(widgets_group, "Widgets.entitlements")
bundle(widgets, file(widgets_group, "PrivacyInfo.xcprivacy"))

widgets.build_configurations.each do |config|
  s = config.build_settings
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = WIDGETS_ID
  s["INFOPLIST_FILE"] = "Widgets/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["CODE_SIGN_ENTITLEMENTS"] = "Widgets/Widgets.entitlements"
  s["CODE_SIGN_STYLE"] = "Automatic"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT
  s["TARGETED_DEVICE_FAMILY"] = "1"
  s["SWIFT_VERSION"] = "5.0"
  # An extension's versions must match the app's: copy the app's version
  # (bump MARKETING_VERSION on both targets together). CI overrides the build
  # number for every target at once.
  s["MARKETING_VERSION"] = app.build_configurations.first.build_settings["MARKETING_VERSION"] || "1.0"
  s["CURRENT_PROJECT_VERSION"] = "1"
  s["SKIP_INSTALL"] = "YES"
  s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
end

# --- Shared by the app and the extension -----------------------------------
shared_group = group(project, "Shared")
%w[
  WorkoutActivityAttributes.swift WidgetSnapshot.swift RestControl.swift OpenAppIntents.swift SiriEntities.swift
].each do |name|
  ref = file(shared_group, name)
  compile(app, ref)
  compile(widgets, ref)
end

# --- The Apple Watch app -----------------------------------------------------
# A single-target watchOS app (no WatchKit extension), embedded in the iPhone
# app. It needs watchOS 10, the newest the first Apple Watch SE runs.
watch = project.targets.find { |t| t.name == "Watch" } ||
  project.new_target(:application, "Watch", :watchos, WATCH_DEPLOYMENT, nil, :swift)

watch_group = group(project, "Watch")
%w[
  FattyWatchApp.swift RootView.swift WorkoutView.swift WatchModel.swift
  WatchAPI.swift PhoneLink.swift WorkoutRecorder.swift
].each do |name|
  compile(watch, file(watch_group, name))
end
file(watch_group, "Info.plist")
file(watch_group, "Watch.entitlements")
bundle(watch, file(watch_group, "Assets.xcassets"))
bundle(watch, file(watch_group, "PrivacyInfo.xcprivacy"))
compile(watch, file(widgets_group, "Brand.swift"))

# The keychain helper: the app keeps the watch's token, the watch uses it.
keychain = file(shared_group, "Keychain.swift")
compile(app, keychain)
compile(watch, keychain)

watch.build_configurations.each do |config|
  s = config.build_settings
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = WATCH_ID
  s["INFOPLIST_FILE"] = "Watch/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["CODE_SIGN_ENTITLEMENTS"] = "Watch/Watch.entitlements"
  s["CODE_SIGN_STYLE"] = "Automatic"
  s["SDKROOT"] = "watchos"
  s["WATCHOS_DEPLOYMENT_TARGET"] = WATCH_DEPLOYMENT
  s["TARGETED_DEVICE_FAMILY"] = "4"
  s["SWIFT_VERSION"] = "5.0"
  s["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
  s["MARKETING_VERSION"] = app.build_configurations.first.build_settings["MARKETING_VERSION"] || "1.0"
  s["CURRENT_PROJECT_VERSION"] = "1"
  s["SKIP_INSTALL"] = "YES"
  s["ENABLE_PREVIEWS"] = "NO"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks"]
end

# --- The watch face complications (a watchOS widget extension) -------------
# Inside the watch app. It reads what the watch app writes to the team's
# shared keychain group (WatchShared/ComplicationData.swift).
watch_widgets = project.targets.find { |t| t.name == "WatchWidgets" } ||
  project.new_target(:app_extension, "WatchWidgets", :watchos, WATCH_DEPLOYMENT, nil, :swift)

watch_widgets_group = group(project, "WatchWidgets")
compile(watch_widgets, file(watch_widgets_group, "FattyComplication.swift"))
file(watch_widgets_group, "Info.plist")
file(watch_widgets_group, "WatchWidgets.entitlements")
bundle(watch_widgets, file(watch_widgets_group, "PrivacyInfo.xcprivacy"))
compile(watch_widgets, file(widgets_group, "Brand.swift"))

watch_shared_group = group(project, "WatchShared")
complication_data = file(watch_shared_group, "ComplicationData.swift")
compile(watch, complication_data)
compile(watch_widgets, complication_data)

watch_widgets.build_configurations.each do |config|
  s = config.build_settings
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = WATCH_WIDGETS_ID
  s["INFOPLIST_FILE"] = "WatchWidgets/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["CODE_SIGN_ENTITLEMENTS"] = "WatchWidgets/WatchWidgets.entitlements"
  s["CODE_SIGN_STYLE"] = "Automatic"
  s["SDKROOT"] = "watchos"
  s["WATCHOS_DEPLOYMENT_TARGET"] = WATCH_DEPLOYMENT
  s["TARGETED_DEVICE_FAMILY"] = "4"
  s["SWIFT_VERSION"] = "5.0"
  s["MARKETING_VERSION"] = app.build_configurations.first.build_settings["MARKETING_VERSION"] || "1.0"
  s["CURRENT_PROJECT_VERSION"] = "1"
  s["SKIP_INSTALL"] = "YES"
  s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
end

watch.add_dependency(watch_widgets) unless watch.dependencies.any? { |d| d.target == watch_widgets }
embed_complications = watch.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" } ||
  watch.new_copy_files_build_phase("Embed Foundation Extensions")
embed_complications.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
embed_complications.dst_path = ""
unless embed_complications.files_references.include?(watch_widgets.product_reference)
  embed_complications.add_file_reference(watch_widgets.product_reference, true).settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

app.add_dependency(watch) unless app.dependencies.any? { |d| d.target == watch }
embed_watch = app.copy_files_build_phases.find { |p| p.name == "Embed Watch Content" } ||
  app.new_copy_files_build_phase("Embed Watch Content")
embed_watch.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:products_directory]
embed_watch.dst_path = "$(CONTENTS_FOLDER_PATH)/Watch"
unless embed_watch.files_references.include?(watch.product_reference)
  embed_watch.add_file_reference(watch.product_reference, true).settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

# --- Build the extension with the app and embed it --------------------------
app.add_dependency(widgets) unless app.dependencies.any? { |d| d.target == widgets }
embed = app.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" } ||
  app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
embed.dst_path = ""
unless embed.files_references.include?(widgets.product_reference)
  embed.add_file_reference(widgets.product_reference, true).settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

project.save
puts "Configured #{project.path}: targets #{project.targets.map(&:name).join(', ')}"

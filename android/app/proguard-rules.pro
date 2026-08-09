# Keep WebView classes
-keep class android.webkit.** { *; }

# Keep JavaScript interfaces
-keepattributes *JavascriptInterface*

# Keep your app's classes
-keep class com.chatapp.android.** { *; }

# Keep Android components
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application

# Keep all AndroidX classes
-keep class androidx.** { *; }
-dontwarn androidx.**
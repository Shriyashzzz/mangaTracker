/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package xyz.mangatracker.app;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        // which release opened the site: it offers only what this app can do
        // (AppLinkActivity), and nothing at all to an older one
        try {
            long version = Build.VERSION.SDK_INT >= 28
                    ? getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode()
                    : getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            uri = uri.buildUpon().appendQueryParameter("appVersion", String.valueOf(version)).build();
        } catch (Exception ignored) {
            // the site treats it as the first release
        }
        // whether Android lets the app notify right now: the site can't see a
        // change made in Android's settings, so it's told on every opening
        android.app.NotificationManager manager =
                getSystemService(android.app.NotificationManager.class);
        boolean on = manager != null && manager.areNotificationsEnabled();
        uri = uri.buildUpon().appendQueryParameter("notifications", on ? "on" : "off").build();
        return uri;
    }
}

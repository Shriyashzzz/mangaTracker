package xyz.mangatracker.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * What the site asks of the phone that a web page can't do itself, opened
 * with a mangatracker:// link (client lib/playApp.ts). Nothing of its own to
 * draw: it does the one thing and closes, and the site checks again when it's
 * back on screen. Each new release says what it can do in the appVersion the
 * launcher adds to the first page (LauncherActivity), so the site only offers
 * what the installed app has.
 *
 *   mangatracker://notifications  Android's "Allow notifications?", or the
 *                                 app's notification settings when Android
 *                                 won't ask again (said no twice)
 *   mangatracker://app-settings   the app's page in Android's settings
 *                                 (permissions, storage, notifications)
 *   mangatracker://review         Google Play's own rating sheet; Play
 *                                 decides whether it shows (a few a year)
 */
public class AppLinkActivity extends Activity {
    private static final int ASK = 1;
    // an answer this fast means Android never showed its question
    private static final long NO_QUESTION_MS = 400;
    private long askedAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri link = getIntent().getData();
        String action = link == null ? "" : String.valueOf(link.getHost());
        switch (action) {
            case "notifications":
                notifications();
                break;
            case "app-settings":
                openSettings(false);
                break;
            case "review":
                review();
                break;
            default:
                finish();
        }
    }

    private void notifications() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            askedAt = SystemClock.elapsedRealtime();
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, ASK);
            return;
        }
        // allowed, or before Android 13: only a switch turned off by hand is left
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null && manager.areNotificationsEnabled()) finish();
        else openSettings(true);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        boolean allowed = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        boolean noQuestion = SystemClock.elapsedRealtime() - askedAt < NO_QUESTION_MS;
        if (!allowed && noQuestion) openSettings(true);
        else finish();
    }

    private void openSettings(boolean notifications) {
        Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(Uri.fromParts("package", getPackageName(), null));
        Intent intent = details;
        if (notifications && Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        }
        try {
            startActivity(intent);
        } catch (Exception e) {
            try {
                startActivity(details);
            } catch (Exception ignored) {
                // no settings screen to open
            }
        }
        finish();
    }

    private void review() {
        ReviewManager manager = ReviewManagerFactory.create(this);
        manager.requestReviewFlow().addOnCompleteListener(asked -> {
            if (!asked.isSuccessful()) {
                finish();
                return;
            }
            ReviewInfo info = asked.getResult();
            manager.launchReviewFlow(this, info).addOnCompleteListener(done -> finish());
        });
    }
}

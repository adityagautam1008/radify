# ADIFY Android Wrapper

This Android Studio project installs ADIFY as an Android WebView app.

ADIFY is still served by the Next.js app, so keep the web server running while testing on your phone:

```sh
PORT=3004 HOST=0.0.0.0 npm start
```

The app URL is configured in:

```text
app/src/main/res/values/strings.xml
```

If your laptop IP changes, update `adify_server_url` to the new phone-accessible URL before pressing Run in Android Studio.

## Install On Phone

1. Open this `android` folder in Android Studio.
2. On your Android phone, enable Developer options and USB debugging.
3. Connect the phone with USB and approve the debugging prompt.
4. Confirm your phone and laptop are on the same Wi-Fi.
5. Press Run in Android Studio and choose your phone.

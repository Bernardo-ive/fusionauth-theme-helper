# email-preview (FreeMarker)

This is the "real" FreeMarker engine used for local preview.

It runs a tiny HTTP server with:

* `GET /api/health`
* `POST /api/render` with `{ html, text, context }`

## Build/Run

Build:

```sh
pnpm email:preview:freemarker:build
```

Run:

```sh
pnpm email:preview:freemarker
```

Default port: `4561` (override with `EMAIL_PREVIEW_FM_PORT`).

## Proxy + Certificates

On macOS, adding a root CA to Keychain does not automatically make Java trust it.
Maven uses the JDK truststore (`cacerts`) from the JDK shown in `mvn -v`.

1) Configure proxy for Maven (repo-local settings):

```sh
export MAVEN_HTTPS_PROXY_HOST=proxy.company.com
export MAVEN_HTTPS_PROXY_PORT=8080
export MAVEN_PROXY_USER=yourUser   # optional
export MAVEN_PROXY_PASS=yourPass   # optional

# optional
export MAVEN_MIRROR_URL=https://your.corp.mirror/repository/maven-public/
```

2) Import your proxy root CA into the JDK truststore used by Maven.

First, confirm which JDK Maven uses:

```sh
mvn -v
```

Export the cert from Keychain (example uses System keychain and a cert name):

```sh
security find-certificate -a -p -c "YOUR PROXY ROOT CA NAME" /Library/Keychains/System.keychain > /tmp/proxy-root-ca.pem
```

Import into the JDK used by Maven:

```sh
JHOME="$(/usr/libexec/java_home -v 25)"  # change version to match mvn -v
sudo keytool -importcert -trustcacerts -noprompt \
  -alias corp-proxy-root \
  -file /tmp/proxy-root-ca.pem \
  -keystore "$JHOME/lib/security/cacerts" \
  -storepass changeit
```

Then re-run the build.

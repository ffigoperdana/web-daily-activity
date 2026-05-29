# Tutorial Setup: Mengisi .env dan Konfigurasi

## Apakah Perlu Firebase?

**TIDAK.** Aplikasi ini tidak menggunakan Firebase sama sekali:

- Auth → Google Identity Services (GIS) langsung, bukan Firebase Auth
- Push Notifications → Web Push API + VAPID keys sendiri, bukan Firebase Cloud Messaging (FCM)
- Database → Google Calendar API sebagai storage, bukan Firestore
- Hosting → Coolify/Docker, bukan Firebase Hosting

Yang kamu butuhkan hanya:

1. **Google Cloud Console** — untuk OAuth Client ID (gratis)
2. **Terminal** — untuk generate VAPID keys (gratis)
3. **Cloudflare** — untuk Push_Service Workers (gratis)

---

## Step 1: Buat Google OAuth Client ID

Ini untuk login Google di app kamu.

### 1.1 Buka Google Cloud Console

1. Buka https://console.cloud.google.com/
2. Login dengan akun Google kamu

### 1.2 Buat Project Baru (atau pakai existing)

1. Klik dropdown project di atas (sebelah logo "Google Cloud")
2. Klik **"New Project"**
3. Nama: `Daily Activity Tracker` (atau terserah)
4. Klik **"Create"**
5. Pastikan project baru ini yang aktif (selected di dropdown)

### 1.3 Enable Google Calendar API

1. Buka menu hamburger (☰) → **APIs & Services** → **Library**
2. Search: `Google Calendar API`
3. Klik hasilnya → klik **"Enable"**
4. Tunggu sampai enabled

### 1.4 Konfigurasi OAuth Consent Screen

1. Buka **APIs & Services** → **OAuth consent screen**
2. Pilih **External** → klik **Create**
3. Isi form:
   - App name: `Daily Activity Tracker`
   - User support email: email kamu
   - Developer contact: email kamu
4. Klik **Save and Continue**
5. Di halaman **Scopes**, klik **Add or Remove Scopes**
   - Search dan centang: `https://www.googleapis.com/auth/calendar.events`
   - Klik **Update** → **Save and Continue**
6. Di halaman **Test users**, klik **Add Users**
   - Tambahkan email kamu (yang akan dipakai login di app)
   - Klik **Save and Continue**
7. Klik **Back to Dashboard**

> **Note:** Selama app masih "Testing", hanya test users yang bisa login.
> Kalau mau publish untuk umum (tapi app ini single-user jadi tidak perlu), klik "Publish App".

### 1.5 Buat OAuth Client ID

1. Buka **APIs & Services** → **Credentials**
2. Klik **"+ Create Credentials"** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Daily Activity Tracker Web`
5. **Authorized JavaScript origins** — tambahkan:
   - `http://localhost:5173` (untuk development)
   - `https://daily.fgdev.tech` (untuk production)
6. **Authorized redirect URIs** — kosongkan (GIS tidak pakai redirect)
7. Klik **Create**
8. **Salin Client ID** — formatnya seperti: `123456789-abcdef.apps.googleusercontent.com`

### 1.6 Isi ke .env

```env
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

---

## Step 2: Tentukan Owner Email

Ini email Google yang boleh login ke app. Hanya 1 email (single-user app).

### Isi ke .env

```env
VITE_OWNER_EMAIL=emailkamu@gmail.com
```

Pakai email yang sama dengan yang kamu tambahkan sebagai test user di Step 1.4.

---

## Step 3: Generate VAPID Keys

VAPID keys dipakai untuk Web Push notifications (tanpa Firebase).

### 3.1 Jalankan Script

Di terminal, dari root project:

```bash
pnpm vapid:generate
```

Atau kalau belum install dependencies:

```bash
npx web-push generate-vapid-keys --json
```

### 3.2 Output

Kamu akan dapat output seperti:

```json
{
  "publicKey": "BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "privateKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### 3.3 Isi ke .env (Public Key saja)

```env
VITE_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.4 Simpan Private Key (untuk Push_Service nanti)

Private key **JANGAN** masuk ke `.env` atau repo. Simpan dulu di tempat aman (notepad/password manager). Nanti dipakai di Step 5.

---

## Step 4: Tentukan Push Service URL

Ini URL dari Cloudflare Worker yang akan kamu deploy.

### Isi ke .env

```env
VITE_PUSH_SERVICE_URL=https://dat-push-service.<your-subdomain>.workers.dev
```

> Subdomain workers.dev kamu bisa dilihat di Cloudflare Dashboard → Workers & Pages → Overview.
> Biasanya formatnya: `https://dat-push-service.username.workers.dev`
>
> Kalau belum tahu, isi dulu dengan placeholder dan update setelah deploy pertama kali.

---

## Step 5: Setup Cloudflare Workers (Push_Service)

### 5.1 Buat Akun Cloudflare (kalau belum)

1. Buka https://dash.cloudflare.com/sign-up
2. Daftar (gratis)

### 5.2 Install Wrangler & Login

```bash
cd push-service
npx wrangler login
```

Browser akan terbuka untuk authorize. Klik **Allow**.

### 5.3 Buat KV Namespace

```bash
npx wrangler kv:namespace create KV
```

Output:

```
⛅️ Created namespace "dat-push-service-KV" with id "abc123..."
```

### 5.4 Update wrangler.toml

Buka `push-service/wrangler.toml`, ganti placeholder:

```toml
[[kv_namespaces]]
binding = "KV"
id = "abc123..."   # ← paste ID dari step 5.3
```

### 5.5 Isi [vars] di wrangler.toml

```toml
[vars]
GOOGLE_CLIENT_ID = "123456789-abcdef.apps.googleusercontent.com"  # sama dengan VITE_GOOGLE_CLIENT_ID
OWNER_EMAIL = "emailkamu@gmail.com"                                # sama dengan VITE_OWNER_EMAIL
VAPID_PUBLIC_KEY = "BLxxx..."                                      # sama dengan VITE_VAPID_PUBLIC_KEY
VAPID_SUBJECT = "mailto:emailkamu@gmail.com"
```

### 5.6 Set Secrets

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
# Paste private key dari Step 3.4, tekan Enter

npx wrangler secret put DISPATCH_SECRET
# Ketik random string yang kuat (misal: generate di https://randomkeygen.com/)
# Simpan juga string ini untuk nanti dipakai di cron trigger
```

### 5.7 Deploy Pertama Kali

```bash
npx wrangler deploy
```

Output akan menunjukkan URL worker kamu. Update `.env` kalau URL-nya berbeda dari yang kamu tulis di Step 4.

---

## Hasil Akhir: File .env

```env
# Tracker (build-time)
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
VITE_OWNER_EMAIL=emailkamu@gmail.com
VITE_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_PUSH_SERVICE_URL=https://dat-push-service.username.workers.dev

# Push_Service (runtime — JANGAN isi di sini, sudah di wrangler.toml + secrets)
GOOGLE_CLIENT_ID=
OWNER_EMAIL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
DISPATCH_SECRET=
```

> Bagian bawah (Push_Service vars) biarkan kosong di `.env` — mereka sudah dikonfigurasi di `wrangler.toml` dan Cloudflare secrets.

---

## Ringkasan: Di Mana Apa

| Apa                     | Di mana                | Commit ke repo?             |
| ----------------------- | ---------------------- | --------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | `.env`                 | ✅ Ya (public, baked ke JS) |
| `VITE_OWNER_EMAIL`      | `.env`                 | ✅ Ya                       |
| `VITE_VAPID_PUBLIC_KEY` | `.env`                 | ✅ Ya (public key, aman)    |
| `VITE_PUSH_SERVICE_URL` | `.env`                 | ✅ Ya                       |
| `GOOGLE_CLIENT_ID`      | `wrangler.toml` [vars] | ✅ Ya                       |
| `OWNER_EMAIL`           | `wrangler.toml` [vars] | ✅ Ya                       |
| `VAPID_PUBLIC_KEY`      | `wrangler.toml` [vars] | ✅ Ya                       |
| `VAPID_SUBJECT`         | `wrangler.toml` [vars] | ✅ Ya                       |
| `VAPID_PRIVATE_KEY`     | `wrangler secret put`  | ❌ Tidak                    |
| `DISPATCH_SECRET`       | `wrangler secret put`  | ❌ Tidak                    |
| `COOLIFY_TOKEN`         | Jenkins Credentials    | ❌ Tidak                    |
| `CLOUDFLARE_API_TOKEN`  | Jenkins Credentials    | ❌ Tidak                    |

---

## FAQ

**Q: Kenapa VITE\_\* aman di-commit?**
A: Karena Vite bakes mereka ke dalam JavaScript bundle. Siapapun yang buka app kamu di browser bisa lihat nilai-nilai ini di source code. Mereka memang public by design (client ID, public key).

**Q: Kalau aku ganti email owner, apa yang perlu diupdate?**
A: Update di 3 tempat: `.env` (VITE_OWNER_EMAIL), `wrangler.toml` (OWNER_EMAIL + VAPID_SUBJECT), dan Google Cloud Console (test users).

**Q: Kalau aku mau test lokal tanpa deploy?**
A: Cukup isi `.env`, lalu `pnpm install && pnpm --filter tracker dev`. App akan jalan di `http://localhost:5173`.

**Q: OAuth consent screen masih "Testing" — apa masalah?**
A: Tidak masalah untuk single-user app. Selama email kamu ada di test users list, kamu bisa login. Tidak perlu publish.

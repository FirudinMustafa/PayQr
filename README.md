# PayQR — Dijital Cüzdan & QR Kod ile Ödeme

> **Finans Teknolojileri** dersi ödevi · QR tabanlı ödeme sistemleri demosu

PayQR, modern fintech ödeme sistemlerinin (QR ile ödeme, dijital cüzdan)
mantığını gösteren küçük bir web uygulamasıdır. Gerçek para hareketi **yoktur**;
tamamen eğitim amaçlıdır.

## 🎯 Ne yapıyor?

Uygulama bir ödemenin **iki tarafını** da canlandırır:

1. **İşyeri (QR Oluştur):** Tutarı girer → uygulama bir **QR kod** üretir.
   QR'ın içinde ödeme bilgileri (işyeri, tutar, işlem no, para birimi) JSON
   olarak şifrelenir.
2. **Müşteri (Öde):** QR okutulduğunda ödeme bilgileri ekrana gelir → müşteri
   onaylar → tutar **dijital cüzdandan** düşülür.
3. **Cüzdan:** Bakiye, para yükleme ve tüm işlem geçmişi tek ekranda.

Veriler tarayıcının `localStorage`'ında tutulur — sunucuya/veritabanına gerek
yoktur, bu yüzden Vercel'de bedava ve anında yayınlanır.

## 🧰 Kullanılan teknolojiler

- **Next.js 15** (App Router) + **React 19**
- **TypeScript**
- **qrcode** — QR kod üretimi
- **Vercel** — yayınlama (hosting)

## 💻 Yerelde çalıştırma

```bash
npm install
npm run dev
# tarayıcıda http://localhost:3000
```

Üretim derlemesi:

```bash
npm run build
npm run start
```

## ▲ Vercel'e yayınlama (2 yol)

### Yol 1 — GitHub üzerinden (en kolay)
1. Bu klasörü bir GitHub deposuna yükle.
2. [vercel.com/new](https://vercel.com/new) → repoyu seç → **Deploy**.
3. Vercel Next.js'i otomatik tanır; ayar gerekmez. Birkaç saniyede canlı URL.

### Yol 2 — Vercel CLI
```bash
npm i -g vercel
vercel          # önizleme dağıtımı
vercel --prod   # production
```

## 📂 Proje yapısı

```
app/
  layout.tsx     # Sayfa iskeleti
  page.tsx       # Tüm uygulama mantığı (cüzdan, QR üret, öde)
  globals.css    # Tasarım/stiller
sunum.html       # Ders sunumu (tarayıcıda aç, ok tuşları ile geç)
```

## 🎓 Sunum

`sunum.html` dosyasını çift tıklayıp tarayıcıda açın; **ok tuşları** veya
ekrandaki butonlarla slaytlar arasında gezin. (F11 ile tam ekran.)

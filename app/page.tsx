"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Tx = {
  id: string;
  type: "in" | "out";
  title: string;
  amount: number;
  date: string;
};

type PaymentRequest = {
  id: string;
  merchant: string;
  amount: number;
  createdAt: string;
};

type Brand = "visa" | "mastercard" | "card";

type Card = {
  id: string;
  holder: string;
  number: string; // 16 hane, boşluksuz
  expiry: string; // AA/YY
  balance: number;
  brand: Brand;
};

const STORE = {
  balance: "payqr_balance",
  txs: "payqr_txs",
  request: "payqr_request",
  cards: "payqr_cards",
};

const TL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(n);

function nowStr() {
  return new Date().toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Her ortamda çalışan benzersiz kimlik (crypto.randomUUID bazı tarayıcılarda yok)
let _uidCounter = 0;
function uid() {
  _uidCounter += 1;
  return `${Date.now().toString(36)}-${_uidCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function detectBrand(num: string): Brand {
  if (num.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "mastercard";
  return "card";
}

function brandName(b: Brand) {
  return b === "visa" ? "VISA" : b === "mastercard" ? "Mastercard" : "KART";
}

// "1234567812345678" -> "1234 5678 1234 5678"
function groupNumber(num: string) {
  return num.replace(/(.{4})/g, "$1 ").trim();
}

function maskNumber(num: string) {
  const last4 = num.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export default function Home() {
  const [tab, setTab] = useState<"wallet" | "cards" | "create" | "pay">(
    "wallet"
  );
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(
    null
  );

  // Kart ekleme formu
  const [fHolder, setFHolder] = useState("");
  const [fNumber, setFNumber] = useState("");
  const [fExpiry, setFExpiry] = useState("");
  const [fCvv, setFCvv] = useState("");
  const [fBalance, setFBalance] = useState("");

  // Her kart için yükleme tutarı ve inline sonuç mesajı
  const [topUpAmt, setTopUpAmt] = useState<Record<string, string>>({});
  const [topUpNote, setTopUpNote] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});

  // İşyeri formu
  const [merchant, setMerchant] = useState("Kahve Dünyası");
  const [amount, setAmount] = useState("75");
  const [qrUrl, setQrUrl] = useState<string>("");

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const b = localStorage.getItem(STORE.balance);
      const t = localStorage.getItem(STORE.txs);
      const r = localStorage.getItem(STORE.request);
      const c = localStorage.getItem(STORE.cards);
      if (b !== null) setBalance(parseFloat(b));
      if (t) setTxs(JSON.parse(t));
      if (r) setRequest(JSON.parse(r));
      if (c) setCards(JSON.parse(c));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORE.balance, String(balance));
    localStorage.setItem(STORE.txs, JSON.stringify(txs));
    localStorage.setItem(STORE.cards, JSON.stringify(cards));
  }, [balance, txs, cards, loaded]);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2400);
  }

  function addTx(tx: Omit<Tx, "id" | "date">) {
    setTxs((t) => [{ ...tx, id: uid(), date: nowStr() }, ...t]);
  }

  // KART EKLE
  function addCard() {
    const num = fNumber.replace(/\s/g, "");
    const bal = parseFloat(fBalance.replace(",", "."));
    if (!fHolder.trim()) return showToast("Kart sahibini girin", true);
    if (!/^\d{16}$/.test(num))
      return showToast("Kart numarası 16 haneli olmalı", true);
    if (!/^\d{2}\/\d{2}$/.test(fExpiry))
      return showToast("Son kullanma AA/YY formatında olmalı", true);
    if (!/^\d{3}$/.test(fCvv)) return showToast("CVV 3 haneli olmalı", true);
    if (isNaN(bal) || bal < 0)
      return showToast("Geçerli bir kart bakiyesi girin", true);

    const card: Card = {
      id: uid(),
      holder: fHolder.trim().toUpperCase(),
      number: num,
      expiry: fExpiry,
      balance: bal,
      brand: detectBrand(num),
    };
    setCards((c) => [card, ...c]);
    setFHolder("");
    setFNumber("");
    setFExpiry("");
    setFCvv("");
    setFBalance("");
    showToast("Kart eklendi ✓");
  }

  function removeCard(id: string) {
    setCards((c) => c.filter((x) => x.id !== id));
    showToast("Kart silindi");
  }

  // KARTTAN CÜZDANA YÜKLE
  function topUpFromCard(card: Card) {
    const setNote = (ok: boolean, msg: string) =>
      setTopUpNote((m) => ({ ...m, [card.id]: { ok, msg } }));

    const raw = topUpAmt[card.id] ?? "";
    const amt = parseFloat(raw.replace(",", "."));
    if (!amt || amt <= 0) {
      setNote(false, "Lütfen 0'dan büyük bir tutar girin.");
      return showToast("Geçerli bir tutar girin", true);
    }
    if (amt > card.balance) {
      setNote(
        false,
        `Kart bakiyesi yetersiz. Bu kartta en fazla ${TL(card.balance)} yükleyebilirsin.`
      );
      return showToast("Kart bakiyesi yetersiz!", true);
    }

    setCards((cs) =>
      cs.map((c) =>
        c.id === card.id ? { ...c, balance: c.balance - amt } : c
      )
    );
    setBalance((b) => b + amt);
    addTx({
      type: "in",
      title: `${brandName(card.brand)} ${maskNumber(card.number)} → yükleme`,
      amount: amt,
    });
    setTopUpAmt((m) => ({ ...m, [card.id]: "" }));
    setNote(true, `${TL(amt)} cüzdana yüklendi ✓`);
    showToast(`${TL(amt)} cüzdana yüklendi`);
  }

  // İŞYERİ: QR üret
  async function createRequest() {
    const amt = parseFloat(amount.replace(",", "."));
    if (!merchant.trim()) return showToast("İşyeri adı girin", true);
    if (!amt || amt <= 0) return showToast("Geçerli bir tutar girin", true);

    const req: PaymentRequest = {
      id: uid().slice(0, 8).toUpperCase(),
      merchant: merchant.trim(),
      amount: amt,
      createdAt: nowStr(),
    };
    const payload = JSON.stringify({
      v: 1,
      scheme: "PAYQR",
      id: req.id,
      merchant: req.merchant,
      amount: req.amount,
      currency: "TRY",
    });
    const url = await QRCode.toDataURL(payload, {
      width: 440,
      margin: 1,
      color: { dark: "#0b1020", light: "#ffffff" },
    });
    setQrUrl(url);
    setRequest(req);
    localStorage.setItem(STORE.request, JSON.stringify(req));
    showToast("QR ödeme talebi oluşturuldu");
  }

  // MÜŞTERİ: öde
  function pay() {
    if (!request) return;
    if (request.amount > balance) return showToast("Yetersiz bakiye!", true);
    setBalance((b) => b - request.amount);
    addTx({
      type: "out",
      title: `${request.merchant} — QR ödeme`,
      amount: request.amount,
    });
    setRequest(null);
    setQrUrl("");
    localStorage.removeItem(STORE.request);
    showToast(`${TL(request.amount)} ödendi ✓`);
    setTab("wallet");
  }

  const totalSpent = useMemo(
    () => txs.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0),
    [txs]
  );

  return (
    <div className="wrap">
      <div className="header">
        <div className="logo">P</div>
        <div>
          <h1>PayQR</h1>
          <p>Dijital Cüzdan & QR Kod ile Ödeme — Finans Teknolojileri</p>
        </div>
      </div>

      {/* Cüzdan kartı */}
      <div className="balance-card">
        <div className="label">Cüzdan Bakiyesi</div>
        <div className="amount">{TL(balance)}</div>
        <div className="row">
          <span className="chip">👛 {cards.length} kayıtlı kart</span>
          <span className="chip">Toplam harcama: {TL(totalSpent)}</span>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="tabs">
        <button
          className={`tab ${tab === "wallet" ? "active" : ""}`}
          onClick={() => setTab("wallet")}
        >
          Cüzdan
        </button>
        <button
          className={`tab ${tab === "cards" ? "active" : ""}`}
          onClick={() => setTab("cards")}
        >
          Kartlarım
        </button>
        <button
          className={`tab ${tab === "create" ? "active" : ""}`}
          onClick={() => setTab("create")}
        >
          QR Oluştur
        </button>
        <button
          className={`tab ${tab === "pay" ? "active" : ""}`}
          onClick={() => setTab("pay")}
        >
          Öde
        </button>
      </div>

      {/* CÜZDAN */}
      {tab === "wallet" && (
        <div className="panel">
          <h2>İşlem Geçmişi</h2>
          <p className="hint">
            Cüzdanına para yüklemek için <b>Kartlarım</b> sekmesinden bir kart
            ekle ve o karttan yükleme yap.
          </p>
          {cards.length === 0 && (
            <button className="btn" onClick={() => setTab("cards")}>
              + Kart Ekle ve Para Yükle
            </button>
          )}

          <div style={{ marginTop: cards.length === 0 ? 18 : 0 }}>
            {txs.length === 0 ? (
              <div className="empty">Henüz işlem yok.</div>
            ) : (
              txs.map((t) => (
                <div className="tx" key={t.id}>
                  <div className={`tx-ico ${t.type}`}>
                    {t.type === "out" ? "↑" : "↓"}
                  </div>
                  <div className="tx-body">
                    <div className="t">{t.title}</div>
                    <div className="d">{t.date}</div>
                  </div>
                  <div className={`tx-amount ${t.type}`}>
                    {t.type === "out" ? "-" : "+"}
                    {TL(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* KARTLARIM */}
      {tab === "cards" && (
        <div className="panel">
          <h2>Kartlarım</h2>
          <p className="hint">
            Kart bilgilerini ekle (cihazında saklanır, sunucuya gitmez). Her
            karttan cüzdanına para yükleyebilirsin.
          </p>

          {cards.length > 0 && (
            <div className="cards-list">
              {cards.map((c) => (
                <div key={c.id}>
                  <div className={`bankcard ${c.brand}`}>
                    <div className="bc-top">
                      <span className="brand">{brandName(c.brand)}</span>
                      <div className="bc-bal">
                        <div className="l">Kart Bakiyesi</div>
                        <div className="v">{TL(c.balance)}</div>
                      </div>
                    </div>
                    <div className="number">{groupNumber(c.number)}</div>
                    <div className="bc-bottom">
                      <div>
                        <div className="cap">Kart Sahibi</div>
                        <div>{c.holder}</div>
                      </div>
                      <div>
                        <div className="cap">Son Kul.</div>
                        <div>{c.expiry}</div>
                      </div>
                    </div>
                  </div>
                  <div className="bc-actions">
                    <input
                      inputMode="decimal"
                      placeholder="Yüklenecek tutar (₺)"
                      value={topUpAmt[c.id] ?? ""}
                      onChange={(e) =>
                        setTopUpAmt((m) => ({ ...m, [c.id]: e.target.value }))
                      }
                    />
                    <button
                      className="btn"
                      onClick={() => topUpFromCard(c)}
                    >
                      Cüzdana Yükle
                    </button>
                  </div>
                  <div className="note">
                    Bu karttan en fazla <b>{TL(c.balance)}</b> yüklenebilir.
                    {topUpNote[c.id] && (
                      <span
                        className={topUpNote[c.id].ok ? "ok" : "bad"}
                        style={{ display: "block", marginTop: 4 }}
                      >
                        {topUpNote[c.id].msg}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <button
                      className="btn tiny danger"
                      onClick={() => removeCard(c.id)}
                    >
                      Kartı Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="divider" />

          <h2 style={{ fontSize: 15 }}>Yeni Kart Ekle</h2>
          <p className="hint">Demo amaçlıdır — gerçek kart bilgisi girmeyin.</p>

          <div className="form-grid">
            <div className="field full">
              <label>Kart Sahibi</label>
              <input
                value={fHolder}
                onChange={(e) => setFHolder(e.target.value)}
                placeholder="AD SOYAD"
              />
            </div>
            <div className="field full">
              <label>Kart Numarası (16 hane)</label>
              <input
                inputMode="numeric"
                value={fNumber}
                maxLength={19}
                onChange={(e) =>
                  setFNumber(
                    e.target.value.replace(/[^\d]/g, "").replace(/(.{4})/g, "$1 ").trim()
                  )
                }
                placeholder="4242 4242 4242 4242"
              />
            </div>
            <div className="field">
              <label>Son Kullanma (AA/YY)</label>
              <input
                value={fExpiry}
                maxLength={5}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d]/g, "");
                  if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                  setFExpiry(v);
                }}
                placeholder="12/28"
              />
            </div>
            <div className="field">
              <label>CVV</label>
              <input
                inputMode="numeric"
                maxLength={3}
                value={fCvv}
                onChange={(e) => setFCvv(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="123"
              />
            </div>
            <div className="field full">
              <label>Karttaki Bakiye (₺)</label>
              <input
                inputMode="decimal"
                value={fBalance}
                onChange={(e) => setFBalance(e.target.value)}
                placeholder="Örn. 1000"
              />
            </div>
          </div>
          <button className="btn" onClick={addCard}>
            Kartı Kaydet
          </button>
        </div>
      )}

      {/* QR OLUŞTUR */}
      {tab === "create" && (
        <div className="panel">
          <h2>Ödeme Talebi Oluştur</h2>
          <p className="hint">
            İşyeri tarafı: tutarı gir, QR kod üret. Müşteri bu QR&apos;ı
            okutarak öder.
          </p>
          <div className="field">
            <label>İşyeri Adı</label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Örn. Kahve Dünyası"
            />
          </div>
          <div className="field">
            <label>Tutar (₺)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <button className="btn" onClick={createRequest}>
            QR Kod Üret
          </button>

          {qrUrl && request && (
            <div className="qr-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Ödeme QR kodu" />
              <div className="qr-meta">
                <div className="big">{TL(request.amount)}</div>
                <div className="small">
                  {request.merchant} · İşlem No: {request.id}
                </div>
              </div>
            </div>
          )}
          {qrUrl && (
            <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
              ✅ Talep hazır. Şimdi <b>&quot;Öde&quot;</b> sekmesine geçerek
              QR&apos;ın okutulduğu müşteri ekranını gör.
            </p>
          )}
        </div>
      )}

      {/* ÖDE */}
      {tab === "pay" && (
        <div className="panel">
          <h2>QR ile Öde</h2>
          <p className="hint">
            Müşteri tarafı: kamera QR&apos;ı okuttuğunda ödeme bilgileri
            otomatik gelir.
          </p>
          {!request ? (
            <div className="empty">
              Bekleyen ödeme talebi yok.
              <br />
              Önce <b>&quot;QR Oluştur&quot;</b> sekmesinden bir talep
              oluşturun.
            </div>
          ) : (
            <>
              <div className="req-card">
                <div className="merchant">📷 QR okundu — Ödenecek işyeri</div>
                <div className="amt">{TL(request.amount)}</div>
                <div className="merchant">
                  {request.merchant} · İşlem No: {request.id}
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                <button
                  className="btn"
                  onClick={pay}
                  disabled={request.amount > balance}
                >
                  {request.amount > balance
                    ? "Yetersiz Bakiye"
                    : `${TL(request.amount)} Öde`}
                </button>
              </div>
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                Ödeme cüzdan bakiyenden ({TL(balance)}) düşülecek.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

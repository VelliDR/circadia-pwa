#☕ Circadia // Biyoritim & Kafein Simülatörü

**Circadia**, bireysel kafein eliminasyon kinetiğini, karaciğer enzimatik indüksiyonunu (CYP1A2) ve biyoritim dengesini matematiksel modellerle simüle eden açık kaynaklı bir Progressive Web App (PWA) uygulamasıdır.

Sıradan sayaçların aksine; sigara kullanımı, sigara bırakma süreci, oral kontraseptif kullanımı ve mide emilim sürelerini hesaba katarak kişiselleştirilmiş bir eliminasyon eğrisi çizer.

---

## 🔬 Temel Özellikler & Klinik Model

- **CYP1A2 Enzim Dinamikleri:** Sigara kullanımına bağlı karaciğer enzim indüksiyonunu ve değişen yarılanma ömürlerini ($t_{1/2}$) anlık simüle eder.
- **Sigara Bırakma (De-indüksiyon) Eğrisi:** Sigara bırakıldıktan sonraki 14 günlük süreçte enzim aktivitesinin normale dönme hızını doğrusal olarak hesaplar.
- **Oral Kontraseptif (OCP) İnhibisyonu:** Östrojen/progestin kullanımına bağlı enzim inhibisyonunu hesaba katar ($t_{1/2} \times 2$).
- **$t_{\max}$ Emilim Rampası:** Tüketimden sonraki ilk 30 dakikalık gastrointestinal emilim evresini ve ardından başlayan 1. derece eliminasyon kinetiğini çizer.
- **FDA / EFSA Toksisite Uyarıları:** Kandaki aktif kafein $400\text{ mg}$, $600\text{ mg}$ ve $1000\text{ mg}$ kritik eşiklerini aştığında kademeli klinik uyarı pankartları çıkarır.
- **OLED Red-Shift (Nöbet Modu):** Gece vardiyaları ve nöbetler için melatonin salgılanmasını baskılamayan saf kırmızı/siyah tema.
- **Veri Güvenliği & Çevrimdışı Çalışma:** `Persistent Storage API` ile önbellek silinme koruması ve `.json` formatında yerel yedekleme/içe aktarma.

---

## 🧮 Matematiksel & Farmakokinetik Model

### 1. Emilim & Eliminasyon Kinetiği (Bateman Fonksiyonu)
$$C(t) = D \cdot \frac{k_a}{k_a - k_e} \cdot \left( e^{-k_e \cdot t} - e^{-k_a \cdot t} \right)$$

Burada:
- $D$: Tüketilen kafein dozu ($mg$)
- $k_a$: Gastrointestinal emilim hız sabiti (Aç karnına: $5.0\text{ sa}^{-1}$, Tok karnına: $2.0\text{ sa}^{-1}$)
- $k_e$: Eliminasyon hız sabiti:
$$k_e = \frac{\ln(2)}{t_{1/2\_etkin}}$$

### 2. Sigara Bırakma De-indüksiyonu ($0 - 14\text{ Gün}$)
$$t_{1/2}(d) = t_{1/2\_sigara} + \left( (t_{1/2\_baz} - t_{1/2\_sigara}) \cdot \frac{d}{14} \right)$$

---

## 🛠️ Teknolojik Mimari

- **Frontend:** TypeScript + Modern Web Components / Glassmorphism UI
- **Grafik Motoru:** Chart.js 4 + chartjs-plugin-annotation (Reaktif Update Döngüsü)
- **Depolama:** IndexedDB (`idb`) + Persistent Storage API
- **PWA & Offline:** Vite + `vite-plugin-pwa` + Workbox Service Worker

---
⚠️ Yasal Uyarı

Circadia bir farmakokinetik simülasyon aracıdır. Sunulan veriler popülasyon ortalamalarına dayalı matematiksel tahminlerdir; tıbbi teşhis, tedavi veya klinik karar tavsiyesi niteliği taşımaz.
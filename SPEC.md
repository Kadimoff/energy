# Tapşırıq: Smart Industry Energy — AI dəstəkli sənaye enerji və karbon idarəetmə dashboard-u

> Bu sənəd Claude Code üçün tam texniki tapşırıqdır. Əvvəlcə hamısını oxu, sonra "13. İş qaydası" bölməsinə uyğun olaraq **plan təqdim et və təsdiq gözlə**. Kod yazmağa təsdiqdən sonra başla.

---

## 1. Rolun

Sən sənaye enerji idarəetmə sistemləri (EMS), ISO 50001 və karbon uçotu sahəsində təcrübəsi olan senior frontend mühəndisi və məhsul dizaynerisən.

Məqsəd: zavod rəhbərliyinə, enerji menecerinə və investora göstəriləcək, **production keyfiyyətində, tam interaktiv, mock məlumatla işləyən dashboard prototipi** qurmaq. Prototip elə qurulmalıdır ki, sonradan mock məlumat mənbəyi real API ilə əvəz olunsun və UI-da heç nə dəyişməsin.

---

## 2. Məhsul konteksti

**Smart Industry Energy** Azərbaycanda zavod və istehsal müəssisələri üçün proqram platformasıdır.

Problem: zavodlar enerjini real vaxtda izləmir. Kompressorlar, soyutma və havalandırma istehsal dayananda da işləyir, sızmalar aylarla aşkarlanmır, aylıq enerji büdcəsi aşılır. Rəhbərlik bunu yalnız ay sonu hesab gələndə görür. Eyni zamanda Avropaya ixrac edən müəssisələr üçün məhsulun karbon izini hesablamaq zərurətə çevrilir.

Platformanın funksiyası:
1. Elektrik və təbii qaz sərfiyyatını zavod, sex, xətt və avadanlıq səviyyəsində izləyir.
2. AI ilə istehsalın real ehtiyacına uyğun **"lazım olan" (optimal) sərfiyyatı** hesablayır.
3. Faktiki sərfiyyatı optimalla müqayisə edir, fərqi (israfı) səbəbləri ilə izah edir.
4. Anomaliyaları aşkarlayır, büdcə aşımını əvvəlcədən proqnozlaşdırır.
5. Enerji və CO₂ azaltmaq üçün **ağıllı qərarlar** təklif edir. Qərarı insan təsdiqləyir (human-in-the-loop). Sistem avadanlığı avtomatik idarə ETMİR.
6. Tətbiq olunmuş qərarların real nəticəsini ölçür və sübut edir (Ölçmə və Yoxlama, M&V).
7. Rəhbərlik, enerji meneceri və karbon hesabatları yaradır.

---

## 3. Əsas konsepsiya: "Yetən qədər enerji"

Məqsəd enerjini kor-koranə azaltmaq deyil, **istehsalın real ehtiyacına endirməkdir**. Keyfiyyət və istehsal həcmi qorunmalıdır.

Hər ekran bu üç suala cavab verməlidir:
- **Nə qədər lazım idi?** — Optimal sərfiyyat (AI baza modeli, istehsal və hava şəraitinə görə normallaşdırılmış).
- **Nə qədər sərf etdik?** — Faktiki sərfiyyat.
- **Fərq nəyə getdi?** — İsraf: hansı avadanlıq, hansı saat, hansı səbəb, neçə manat, neçə ton CO₂.

Bu konsepsiyanın vizual imzası **"Optimal zolaq"**dır: qrafiklərdə faktiki xəttin arxasında AI-ın hesabladığı optimal diapazon (yumşaq bənövşəyi zolaq) göstərilir. Xətt zolaqdan yuxarı çıxanda həmin sahə israf kimi rənglənir. Bu element bütün məhsulda ardıcıl istifadə olunmalıdır.

---

## 4. İstifadəçilər və onların əsas sualları

| Rol | Əsas suallar | Üstünlük verdiyi görünüş |
|---|---|---|
| Zavod direktoru / CFO | Bu ay büdcəyə sığacağıqmı? Nə qədər qənaət etdik? Karbon hədəfinə çatırıqmı? | Ümumi baxış, rəhbərlik hesabatı, qısa xülasələr |
| Enerji meneceri / baş mühəndis | Harada israf var? Niyə? Nə etməliyəm? Tətbiq etdiyim tədbir işlədimi? | Avadanlıq detalları, anomaliyalar, AI Qərar Mərkəzi, M&V |
| Növbə rəisi / operator | İndi nə baş verir? Hansı avadanlıq normadan kənardadır? | Canlı monitorinq, xəbərdarlıqlar |
| Davamlılıq (ESG) məsulu | Scope 1 və 2 emissiyalarımız nə qədərdir? Məhsul vahidinə karbon izi? CBAM-a hazırıqmı? | Karbon modulu |

Prototipdə yuxarı paneldə **rol seçici** olsun (Direktor / Enerji meneceri / Operator). Rol dəyişəndə Ümumi baxış ekranında göstərilən kartların sırası və detallılıq səviyyəsi dəyişsin.

---

## 5. Domen qaydaları və hesablamalar

Bütün hesablamalar `src/domain/` qovluğunda **saf funksiyalar** (pure functions) kimi yazılmalı və Vitest ilə test edilməlidir. UI komponentləri heç vaxt öz daxilində hesablama aparmamalıdır.

### 5.1 Terminlər (ISO 50001 / ISO 50006 əsasında)
- **EnB (Energy Baseline, enerji baza xətti):** müqayisə üçün istinad dövrünün sərfiyyatı. Default: son 12 ay.
- **EnPI (Energy Performance Indicator):** enerji səmərəliliyi göstəricisi. Əsas EnPI: **kVt·saat / ton məhsul**. Əlavə: kq CO₂ / ton məhsul, sex üzrə kVt·saat / iş saatı.
- **Relevant variables (təsir edən dəyişənlər):** istehsal həcmi (ton), xarici hava temperaturu (°C, soyutma/istilik dərəcə-günləri), iş günü/növbə sayı.
- **Static factors:** zavodun sahəsi, avadanlıq parkı. Dəyişərsə baza xətti yenidən hesablanır (UI-da xəbərdarlıq).

### 5.2 Optimal (lazım olan) sərfiyyat modeli
- Hər avadanlıq qrupu üçün çoxdəyişənli xətti reqressiya:
  `E_optimal = a + b × istehsal_ton + c × CDD + d × HDD + e × iş_saatı`
- Model istinad dövrünün "yaxşı" günləri üzrə qurulur (anomaliya günləri çıxarılır).
- Hər nəticə ilə birlikdə **etibar intervalı** (məsələn, ±1.5σ) hesablanır; bu interval UI-da "Optimal zolaq" kimi çəkilir.
- Modelin keyfiyyəti göstərilir: R², CV(RMSE). CV(RMSE) > 20% olarsa UI "Model etibarlılığı aşağıdır, daha çox məlumat lazımdır" xəbərdarlığı versin.
- İstehsalsız saatlar üçün ayrıca **istehsalsız baza yükü** (idle baseload) hesablanır. Bu, gecə və həftəsonu israfını aşkarlamağın əsasıdır.

### 5.3 İsraf və anomaliya
- `israf = max(0, E_faktiki − E_optimal_yuxarı_sərhəd)`
- Anomaliya növləri (hər birinin ayrıca qaydası və nümunə hadisəsi olsun):
  1. İstehsalsız saatlarda yüksək yük (boş işləmə).
  2. Baza yükünün tədricən artması (sızma, aşınma əlaməti) — 7 günlük trend.
  3. Ani sıçrayış (spike) — z-score > 3.
  4. Pik saatlarda eyni anda çoxlu avadanlığın işə salınması (pik güc).
  5. Hava ilə uyğunsuzluq (soyuq gündə soyutmanın tam gücdə işləməsi).
  6. EnPI-nin pisləşməsi (kVt·saat/ton həftəlik ortalamadan 10%+ yuxarı).
- Hər anomaliyanın: ciddilik (kritik / yüksək / orta / aşağı), başlama-bitmə vaxtı, təsirlənən avadanlıq, itki (kVt·saat, AZN, kq CO₂), AI izahı, əlaqəli tövsiyə.

### 5.4 Büdcə proqnozu
- Ay sonu proqnozu = faktiki (bu günə qədər) + qalan günlər üçün model proqnozu (istehsal planı və hava proqnozu ilə).
- Proqnoz intervalı göstərilsin (P10–P90).
- Büdcə aşma ehtimalı faizlə: "Büdcəni aşma ehtimalı 78%".

### 5.5 Xərc hesablaması
- Elektrik xərci = kVt·saat × tarif + aylıq sabit haqq.
- Qaz xərci = m³ × qaz tarifi + aylıq sabit haqq.
- **Default dəyərlər (Parametrlər ekranında dəyişdirilə bilən, yanında "rəsmi mənbədən yoxlayın" qeydi ilə):**
  - Elektrik, qeyri-məişət istehlakçı: **0,11 AZN/kVt·saat** (Tarif Şurasının qərarına əsasən ticarət və xidmət üçün 11 qəpik, digər qeyri-əhali istehlakçıları üçün 10 qəpik; istehlakçı qrupu seçilə bilsin).
  - Üç fazalı qeyri-məişət istehlakçı üçün aylıq sabit haqq: **3 AZN** (2026-cı ilin 1 yanvarından).
  - Qaz tarifi: Parametrlərdə daxil edilsin; mock üçün placeholder istifadə et və "yoxlanılmalı" etiketi qoy.
  - Mənbə: tariff.gov.az. Tariflər dəyişə bilər, ona görə heç bir tarif kodda sabit (hardcode) yazılmamalı, yalnız konfiqurasiya faylında olmalıdır.

### 5.6 Karbon (CO₂) hesablaması — GHG Protocol əsasında
- **Scope 1** (birbaşa): təbii qazın yandırılması.
  - Default əmsal: IPCC default dəyəri 56,1 t CO₂/TJ → təxminən **0,202 kq CO₂/kVt·saat** (aşağı yanma istiliyi ilə).
  - m³-dən kVt·saata çevirmə əmsalı Parametrlərdə olsun (default ~10 kVt·saat/m³, yoxlanılmalı).
- **Scope 2** (alınmış elektrik): location-based metod.
  - Default şəbəkə əmsalı: **0,41 kq CO₂/kVt·saat** (Azərenerji-nin bərpa olunan enerji layihə sənədində 20 448 MVt·saat üçün 8 311 t CO₂e göstərilib, bu da ~0,41 t/MVt·saat edir). Parametrlərdə dəyişdirilə bilsin, mənbə qeyd edilsin.
- Göstəricilər: ümumi t CO₂e, Scope 1/2 bölgüsü, **kq CO₂ / ton məhsul** (karbon intensivliyi), illik hədəfə qarşı irəliləyiş, tövsiyələrdən gözlənilən azalma.
- Hər CO₂ rəqəminin yanında istifadə olunan əmsal və onun mənbəyi tooltip ilə görünsün. Bu, etibarlılıq üçün vacibdir.

### 5.7 CBAM hazırlığı (Karbon modulunun alt bölməsi)
- Aİ-nin CBAM mexanizmi 2026-cı il 1 yanvardan definitiv mərhələyə keçib; 2026-cı il idxalı üçün ilk illik bəyannamə 30 sentyabr 2027-ci ilə qədər təqdim olunmalıdır.
- Əhatə olunan məhsul qrupları: sement, dəmir və polad, alüminium, gübrələr (həmçinin elektrik və hidrogen). İllik 50 tondan az idxal azad edilir.
- UI-da: "Məhsulunuz CBAM-a düşürmü?" yoxlama siyahısı, məhsul vahidinə daxil edilmiş emissiya (embedded emissions) hesablayıcısı, ixrac həcminə görə təxmini CBAM xərc ssenarisi (Aİ ETS qiyməti parametr kimi daxil edilir).
- Mütləq qeyd: "Bu, ilkin qiymətləndirmədir, rəsmi CBAM hesabatı deyil."

### 5.8 Qənaətin ölçülməsi və yoxlanması (M&V)
- IPMVP yanaşması: **qarşısı alınmış enerji (avoided energy) = düzəldilmiş baza xətti − faktiki sərfiyyat**.
  - Düzəldilmiş baza xətti: baza modelinin hesabat dövrünün istehsal və hava şəraiti ilə yenidən hesablanmış dəyəri.
- Option B (avadanlıq səviyyəsində ölçmə) və Option C (bütün obyekt) seçimi.
- Hər tətbiq olunmuş qərar üçün: gözlənilən qənaət vs təsdiqlənmiş qənaət, etibar intervalı, statusu ("Ölçülür", "Təsdiqləndi", "Gözləniləndən az").
- Bu modul satışda əsas arqumentdir: "Qənaət hava soyuduğu üçün deyil, tədbir sayəsində əldə edilib" sualına cavab verir.

### 5.9 Vahidlər və formatlaşdırma
- Rəqəmlər Azərbaycan formatında: minliklər bölünməz boşluqla, onluq kəsr vergüllə (`57 600`, `0,41`).
- Vahidlər: kVt, kVt·saat, MVt·saat, m³, AZN, kq CO₂, t CO₂e, °C.
- Tarix: `25 noyabr 2026`, saat: `14:30`, həftə bazar ertəsindən başlayır.
- Hamısı `src/lib/format.ts` faylında mərkəzləşdirilsin.

---

## 6. Dizayn sistemi

### 6.1 Dizayn konsepsiyası: "Sakit intellekt"
İnterfeys təmiz, havadar, etibarlı və "ağıllı sistem" hissi verməlidir. AI hər yerdə qışqırmamalı, lazım olan yerdə sakitcə görünməlidir. İstinad hissi: premium sənaye analitika məhsulu, Linear/Vercel səviyyəsində səliqə, amma sənaye məlumatına uyğun ciddilik.

**Olmamalı:** kriptovalyuta/oyun estetikası, neon parıltı, hər kartda gradient, qara fonda yaşıl rəqəmlər, ağır glassmorphism, lazımsız 3D, dekorativ animasiyalar.

### 6.2 Rəng tokenləri
CSS dəyişənləri kimi təyin et və Tailwind theme-ə bağla.

**Neytral (ağ əsas):**
- `--bg`: #FFFFFF
- `--bg-subtle`: #FAF9FE
- `--surface`: #FFFFFF
- `--surface-raised`: #FFFFFF (kölgə ilə fərqlənir)
- `--border`: #ECEAF5
- `--border-strong`: #DCD8EC
- `--text`: #1B1830
- `--text-2`: #57536E
- `--text-3`: #8A86A0

**Bənövşəyi (brend və AI):**
- `--violet-50`: #F6F3FF
- `--violet-100`: #EDE8FF
- `--violet-200`: #DDD3FE
- `--violet-300`: #C4B5FD
- `--violet-400`: #A78BFA
- `--violet-500`: #8B5CF6
- `--violet-600`: #7C3AED (primary)
- `--violet-700`: #6D28D9 (primary hover / aktiv)
- `--violet-800`: #5B21B6
- `--indigo-accent`: #6366F1 (gradientdə ikinci ton kimi)

**Semantik (mənalı rənglər, dekorasiya üçün istifadə edilmir):**
- Qənaət / normal: `--success` #0E9F8E, səth #E8F7F5
- Xəbərdarlıq / israf: `--warning` #D98E04, səth #FDF4E3
- Kritik / büdcə aşımı: `--danger` #D64545, səth #FCECEC
- Məlumat: `--info` #4F7CF0, səth #EEF3FE

**Qrafik palitrası:**
- Faktiki sərfiyyat: `--text` (tünd xətt)
- Optimal zolaq: `--violet-200` 50% şəffaflıq, kənarları `--violet-400`
- İsraf sahəsi: `--warning` 35% şəffaflıq
- Proqnoz: kəsik xətt, `--violet-600`
- Tövsiyə ssenarisi: `--success`
- Kateqoriyalar (avadanlıq qrupları) üçün 6 tonluq ardıcıl palitra: #7C3AED, #6366F1, #0EA5E9, #14B8A6, #F59E0B, #94A3B8
- Rəng heç vaxt mənanı təkbaşına daşımamalı: etiket, ikon və ya naxış (pattern) da olsun.

### 6.3 Gradient qaydaları (vacib)
Gradient dekorasiya deyil, **AI-ın imzasıdır**. Yalnız bu yerlərdə istifadə et:
1. **Səhifə fonu:** yuxarı sağ küncdə çox yumşaq radial işıq: `radial-gradient(1200px 600px at 85% -10%, rgba(196,181,253,0.35), transparent 60%)`, sol aşağıda daha zəif ikinci işıq `rgba(99,102,241,0.08)`. Qalan hissə təmiz ağ.
2. **AI elementləri:** AI Copilot paneli başlığı, AI tövsiyə kartlarının sol kənarındakı 3px zolaq, "AI" nişanı, etimad göstəricisi.
   - AI gradient: `linear-gradient(135deg, #7C3AED 0%, #6366F1 55%, #A78BFA 100%)`
3. **Əsas CTA düyməsi** (səhifədə yalnız bir dənə).
4. **Optimal zolaq** qrafiklərdə (şaquli yumşaq gradient).

Adi kartlarda, cədvəllərdə, sidebar-da gradient **olmasın**. Kartlar ağ, 1px `--border`, çox yüngül kölgə.

### 6.4 AI vizual dili
- **AI nişanı:** kiçik ulduz/qığılcım ikonu + "AI" sözü, gradient fon, 11–12px. AI tərəfindən yaradılan hər məzmunun yanında.
- **Etimad göstəricisi:** 0–100% arası, 5 seqmentli bar və ya halqa. 80%+ "Yüksək", 60–79% "Orta", 60% altı "Aşağı — yoxlama tövsiyə olunur".
- **"Niyə?" düyməsi:** hər AI qərarı və anomaliyası açılan izahat panelinə malikdir: hansı məlumata əsaslanıb, hansı qayda işləyib, müqayisə qrafiki.
- **Düşünmə animasiyası:** AI cavab hazırlayanda 3 nöqtəli yumşaq pulsasiya və ya gradient shimmer. 1.5 saniyədən çox olmasın.
- **Mətn tonu:** AI özünü "mən" adlandırmır, qısa, faktlara əsaslanan dil işlədir: "K-2 kompressoru 18 noyabr gecəsi 5,5 saat yüksüz işləyib. Təxmini itki: 149 AZN."

### 6.5 Tipografiya
- Şrift: **Azərbaycan hərflərini (Əə, Ğğ, Iı, İi, Öö, Şş, Üü, Çç) tam dəstəkləyən** şrift seç. Seçimdən əvvəl bu hərflərlə test səhifəsi render et və yoxla. Namizədlər: "Plus Jakarta Sans", "Manrope", "Inter". Ə hərfi fallback şriftə düşürsə, həmin şrifti rədd et.
- Rəqəmlər üçün `font-variant-numeric: tabular-nums` hər yerdə.
- Tip miqyası (px): 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48.
  - Səhifə başlığı: 24–30, weight 600, letter-spacing -0.01em.
  - Kart başlığı: 14–15, weight 600.
  - KPI rəqəmi: 30–36, weight 600.
  - Əsas mətn: 14–15, line-height 1.55.
  - Köməkçi mətn: 12–13, `--text-3`.
- Böyük hərflərlə (ALL CAPS) etiketlər işlətmə. Sentence case.

### 6.6 Məkan, forma, kölgə
- Baza vahidi 4px. Kart daxili padding 20–24px, kartlar arası 16–24px.
- Radius iyerarxiyası: kiçik elementlər (badge, input) 8px, kartlar 14px, modal və böyük panellər 20px. Hər şeyə eyni radius verilməsin.
- Kölgələr bənövşəyi çalarlı və çox yüngül:
  - `--shadow-sm`: `0 1px 2px rgba(27,24,48,0.04)`
  - `--shadow-md`: `0 4px 16px -4px rgba(76,29,149,0.08), 0 1px 3px rgba(27,24,48,0.04)`
  - `--shadow-lg`: `0 16px 40px -12px rgba(76,29,149,0.16)`

### 6.7 Hərəkət (motion)
- Default keçid: 180ms, `cubic-bezier(0.2, 0, 0, 1)`.
- Səhifə yüklənəndə yalnız bir orkestrləşdirilmiş an: KPI rəqəmlərinin sayılması (count-up, 600ms) və əsas qrafikin soldan sağa çəkilməsi. Hər kartın ayrıca fade-in olması qadağandır.
- İstifadəçi hərəkətinə cavab verən animasiyalar (panel açılması, tövsiyənin təsdiqlənməsi, qrafikin yenilənməsi) xoşdur.
- `prefers-reduced-motion` mütləq nəzərə alınsın.

### 6.8 İkonlar
- `lucide-react`, 1.75px stroke, 16/18/20px ölçülər. Emoji istifadə etmə.

### 6.9 Vəziyyətlər (states)
Hər komponent və səhifə üçün dizayn et:
- **Yüklənir:** skeleton (layout-u saxlayan), spinner yox.
- **Boş:** nə etmək lazım olduğunu deyən mətn + əməliyyat düyməsi ("Hələ heç bir tövsiyə təsdiqlənməyib. AI Qərar Mərkəzinə keçin").
- **Xəta:** nə baş verdiyini və necə düzəltməyi deyən mətn, üzrxahlıqsız.
- **Köhnə məlumat:** "Son yenilənmə 12 dəqiqə əvvəl" xəbərdarlığı (sensor bağlantısı kəsildikdə).

### 6.10 Əlçatanlıq və responsivlik
- WCAG 2.2 AA: mətn kontrastı ≥ 4.5:1, UI elementləri ≥ 3:1.
- Bütün funksiyalar klaviatura ilə işləsin, görünən focus halqası (`--violet-600`, 2px, offset 2px).
- Qrafiklər üçün `aria-label` və alternativ cədvəl görünüşü ("Cədvəl kimi bax" düyməsi).
- Breakpoint-lər: 640 / 768 / 1024 / 1280 / 1536. Əsas hədəf 1440px desktop, amma 1024 planşet və 390 mobil düzgün işləsin. Mobil versiyada sidebar alt naviqasiyaya çevrilsin.
- Dark mode: tokenlər elə qurulsun ki, sonradan əlavə etmək asan olsun (`[data-theme="dark"]`), amma ilk versiyada yalnız light tema tələb olunur.

---

## 7. İnformasiya arxitekturası və səhifələr

### 7.1 Ümumi layout
- **Sol sidebar** (240px, yığılanda 72px): loqo, naviqasiya, aşağıda zavod seçici və istifadəçi.
- **Yuxarı panel:** səhifə başlığı, tarix diapazonu seçici (Bu gün / 7 gün / Bu ay / Rüb / İl / Xüsusi), rol seçici, bildirişlər, "AI Copilot" düyməsi (gradient), canlı məlumat indikatoru (yaşıl nöqtə + "Canlı").
- **Sağ tərəfdən açılan AI Copilot paneli** (420px), bütün səhifələrdən əlçatan, `⌘K` / `Ctrl+K` ilə.
- Qlobal axtarış / komanda palitrası (`⌘K`): səhifələr, avadanlıqlar, anomaliyalar.

### 7.2 Naviqasiya
1. Ümumi baxış
2. Canlı monitorinq
3. Avadanlıqlar
4. AI Qərar Mərkəzi (nişanda gözləyən qərar sayı)
5. Anomaliyalar
6. Proqnoz və ssenarilər
7. Karbon
8. Qənaət və yoxlama (M&V)
9. Hesabatlar
10. Parametrlər

### 7.3 Səhifə 1 — Ümumi baxış
Məqsəd: rəhbər 10 saniyəyə vəziyyəti anlasın.

- **Hero bölməsi (yumşaq gradient fon işığı burada):**
  - Böyük cümlə şəklində vəziyyət: "Bu ay büdcəni 7 600 AZN aşmaq ehtimalı 78%-dir" və ya "Ay büdcə daxilində bağlanır, 1 520 AZN ehtiyatla". Rəng vəziyyətə görə.
  - Yanında AI xülasəsi (2–3 cümlə, AI nişanı ilə) və "3 tövsiyəyə bax" CTA.
- **KPI sırası (5 kart):** Bu ay sərfiyyat (MVt·saat), Bu ay xərc (AZN) vs büdcə, EnPI (kVt·saat/ton) + trend, CO₂ (t) + hədəfə qarşı, Bu ay israf (AZN, faiz). Hər kartda mini sparkline və əvvəlki dövrlə müqayisə. Kartlar klikləndikdə müvafiq səhifəyə keçir.
- **Əsas qrafik:** "Faktiki vs Optimal" — seçilmiş dövr üzrə günlük sərfiyyat, optimal zolaq, israf sahələri, proqnoz hissəsi, büdcə xətti (toplanan rejimə keçid düyməsi ilə).
- **İsrafın bölgüsü:** avadanlıq qrupları üzrə üfüqi bar: istehsala sərf / israf / tövsiyə ilə qənaət edilə bilən.
- **Gözləyən AI qərarları** (top 3), hər biri təsdiq/rədd düyməsi ilə.
- **Son anomaliyalar** (top 5).
- **Karbon kiçik paneli:** Scope 1/2 halqa diaqramı + illik hədəf irəliləyişi.

### 7.4 Səhifə 2 — Canlı monitorinq
- Zavodun sxematik planı (SVG): sexlər və əsas avadanlıqlar bloklar kimi, hər birinin cari gücü (kVt) və vəziyyəti (normal / israf / dayanıb / əlaqə yoxdur) rənglə və ikonla.
- Hər 5 saniyədə mock məlumat yenilənməsi (simulyasiya edilmiş axın).
- Son 60 dəqiqənin real vaxt güc qrafiki (kVt), pik güc həddi xətti.
- Canlı hadisə lenti (sağda): "14:32 Çiller-2 işə düşdü", "14:35 K-1 yükü 15% artdı".
- Növbə göstəricisi: hazırkı növbə, istehsal planı vs faktiki.

### 7.5 Səhifə 3 — Avadanlıqlar
- **Siyahı görünüşü:** cədvəl (axtarış, filtr, sıralama): ad, qrup, sex, nominal güc, bu ay kVt·saat, israf %, sağlamlıq balı, son anomaliya, status.
- **Detal səhifəsi** (məsələn, `/equipment/comp-2`):
  - Başlıq: ad, növ, sex, nominal güc, iş saatı.
  - Faktiki vs Optimal qrafiki (saatlıq/günlük keçid).
  - **Həftəlik saatlıq istilik xəritəsi (heatmap 7×24):** istehsalsız saatlarda artıq yük sarı rənglə, istehsalsız saatlar çərçivəli.
  - Yük profili paylanması (histoqram): yüksüz / qismən / tam yük faizləri.
  - Bu avadanlığa aid anomaliyalar və AI tövsiyələri.
  - Avadanlığın sağlamlıq balı və proqnozlaşdırıcı texniki xidmət işarəsi ("Baza yükü 9 gündür artır, sızma ehtimalı").

### 7.6 Səhifə 4 — AI Qərar Mərkəzi (məhsulun ürəyi)
Bu səhifə "ağıllı qərarlar" konsepsiyasını göstərir. Ən diqqətli dizayn burada olmalıdır.

- **Yuxarıda xülasə:** gözləyən qərarlar sayı, ümumi potensial qənaət (AZN/ay, MVt·saat/ay, t CO₂/il), bu ay təsdiqlənənlər.
- **Qərar kartları** (siyahı, filtr: status, kateqoriya, təsir, səy):
  - AI nişanı və sol kənarda gradient zolaq.
  - Başlıq (fel ilə): "K-2 kompressorunu növbə bitəndə avtomatik dayandırın".
  - Gözlənilən təsir: kVt·saat/ay, AZN/ay, t CO₂/il.
  - Səy səviyyəsi: "Sıfır xərc / Aşağı / İnvestisiya tələb edir" + təxmini geri qaytarma müddəti.
  - Risk: istehsala və keyfiyyətə təsir (məsələn, "Keyfiyyətə təsir yoxdur", "Səhər işə salınma 4 dəqiqə uzanır").
  - Etimad göstəricisi.
  - "Niyə?" açılan paneli: əsaslandığı məlumat, qrafik, işləyən qayda.
  - Əməliyyatlar: **Təsdiqlə**, **Planla** (tarix seçimi), **Rədd et** (səbəb seçimi məcburi: "Texniki mümkün deyil", "İstehsal riski", "Artıq edilib", "Digər"). Rədd səbəbi AI-ın gələcək tövsiyələrini yaxşılaşdırmaq üçün saxlanılır (UI-da bu barədə qeyd).
- **Status axını:** Təklif edildi → Təsdiqləndi → Tətbiq olunur → Ölçülür → Təsdiqlənmiş qənaət. Kanban və ya siyahı görünüşü arasında keçid.
- **Prioritet matrisi:** təsir (y) vs səy (x) səpələnmə qrafiki; "tez qazanclar" kvadrantı vurğulanır.
- Qərarların ən azı 8 nümunəsi mock məlumatda olsun (bölmə 9-a bax).

### 7.7 Səhifə 5 — Anomaliyalar
- Zaman xətti (timeline) görünüşü + cədvəl görünüşü.
- Filtrlər: ciddilik, növ, avadanlıq, status (Açıq / Araşdırılır / Həll edildi / Yanlış xəbərdarlıq).
- Detal paneli: anomaliya qrafiki (həmin dövr optimal zolaqla), AI izahı, itki, əlaqəli tövsiyə, şərh yazma və məsul təyin etmə.
- "Yanlış xəbərdarlıq" kimi işarələmə AI modelinə rəy kimi göstərilsin.

### 7.8 Səhifə 6 — Proqnoz və ssenarilər
- **Ay sonu / rüb sonu proqnozu:** P10–P90 intervalı ilə qrafik, büdcə xətti, aşma ehtimalı.
- **"Nə olar əgər" simulyatoru (əsas interaktiv element):**
  - Slayder və keçidlər: istehsal həcmi (±%), xarici temperatur, növbə sayı, tətbiq olunan tövsiyələr (checkbox siyahısı), tarif dəyişikliyi, şəbəkə emissiya əmsalı.
  - Nəticə dərhal yenilənir: ay sonu xərci, büdcəyə qarşı, MVt·saat, t CO₂, EnPI.
  - "Əvvəl / Sonra" müqayisə qrafiki.
  - Ssenarini adla saxlamaq və iki ssenarini yan-yana müqayisə etmək.
- **Pik yük planlayıcısı:** gün ərzində yük profili, xətlərin işə salınma ardıcıllığını dəyişməklə pik gücün azaldılması vizualı.

### 7.9 Səhifə 7 — Karbon
- KPI: ümumi t CO₂e (il üzrə), Scope 1, Scope 2, kq CO₂/ton məhsul, illik hədəf irəliləyişi.
- Aylıq emissiya qrafiki (Scope 1/2 yığılmış sütunlar) + intensivlik xətti (ikinci ox).
- Mənbələr üzrə bölgü (elektrik avadanlıq qrupları, qaz istifadəçiləri).
- **Azalma yol xəritəsi (waterfall qrafiki):** cari emissiya → hər tövsiyənin azaltması → hədəf.
- Əmsallar cədvəli: istifadə olunan bütün emissiya əmsalları, mənbəyi, tarixi, redaktə linki (Parametrlərə).
- **CBAM hazırlığı alt bölməsi** (5.7-yə bax).

### 7.10 Səhifə 8 — Qənaət və yoxlama (M&V)
- Kumulyativ təsdiqlənmiş qənaət qrafiki (AZN və MVt·saat).
- Hər tətbiq olunmuş tədbir üzrə cədvəl: gözlənilən vs təsdiqlənmiş, etibar intervalı, metod (Option B/C), status.
- Tədbir detalı: baza dövrü vs hesabat dövrü, düzəldilmiş baza xətti vs faktiki qrafiki, düzəlişlərin izahı (istehsal +8%, hava -3°C).
- Model keyfiyyəti göstəriciləri (R², CV(RMSE)) şəffaf göstərilsin.

### 7.11 Səhifə 9 — Hesabatlar
- Hesabat şablonları: Aylıq rəhbərlik hesabatı, Enerji meneceri hesabatı, Karbon hesabatı, ISO 50001 enerji performans icmalı.
- Hesabat önizləməsi (A4 formatında, çap üçün optimallaşdırılmış CSS), "PDF kimi yüklə" (brauzer çapı ilə), "CSV ixrac".
- Avtomatik göndərmə planı (UI simulyasiyası): həftəlik/aylıq, alıcılar.
- Aylıq rəhbərlik hesabatının məzmunu: 1 səhifəlik xülasə, əsas rəqəmlər, büdcə vəziyyəti, top 3 israf, təsdiqlənmiş qənaət, CO₂, növbəti ay üçün tövsiyələr.

### 7.12 Səhifə 10 — Parametrlər
- Zavod profili: ad, sektor, sahə, iş qrafiki, növbələr, bayram günləri.
- Büdcə: aylıq enerji büdcəsi (elektrik/qaz ayrıca).
- Tariflər: istehlakçı qrupu, kVt·saat tarifi, sabit haqq, qaz tarifi. Hər birinin yanında mənbə linki və "son yoxlama tarixi".
- Emissiya əmsalları: Scope 1 və 2, mənbə, tarix.
- Hədəflər: illik enerji və CO₂ azalma hədəfləri, EnPI hədəfi.
- Xəbərdarlıq qaydaları: hədlər, kanallar (e-poçt, Telegram — UI simulyasiyası).
- Məlumat mənbələri: qoşulmuş sayğaclar, SCADA, Excel yükləmə (sürüklə-burax zonası, CSV şablonu yükləmə). Əlaqə statusları.
- İstifadəçilər və rollar.

### 7.13 AI Copilot paneli
- Sağdan açılan panel, söhbət interfeysi.
- Hazır sual düymələri: "Bu ay niyə büdcəni aşırıq?", "Ən çox israf edən avadanlıq hansıdır?", "Gələn ay üçün 3 əsas tövsiyə", "CO₂ hədəfinə çatmaq üçün nə etməliyik?", "Dünən gecə nə baş verib?"
- **Cavablar mock məlumatdan hesablanan şablon əsaslı olmalıdır** (yəni rəqəmlər real olaraq dashboard məlumatından gəlir, uydurulmur). Hər cavabda istinad kartları: əlaqəli qrafik mini-görünüşü, avadanlıq linki, "Qərar Mərkəzində aç" düyməsi.
- Sərbəst mətn sualı üçün açar söz əsaslı niyyət uyğunlaşdırması; tanınmayan sualda: "Bu sualı hələ cavablandıra bilmirəm. Bunları soruşa bilərsiniz: ..." 
- Arxitektura elə qurulsun ki, sonradan real LLM API (məsələn, Claude API) `CopilotService` interfeysinə qoşulsun. İlk versiyada xarici API çağırışı olmasın.

---

## 8. Texniki tələblər

### 8.1 Stack
- **React 18 + TypeScript (strict) + Vite**
- **Tailwind CSS** (tokenlər CSS dəyişənləri üzərindən) + **shadcn/ui** (Radix əsaslı komponentlər)
- **Recharts** standart qrafiklər üçün; heatmap, zavod sxemi və optimal zolaq kimi xüsusi vizuallar üçün öz SVG komponentlərin (və ya ehtiyac olarsa `@visx`)
- **React Router** (URL əsaslı naviqasiya, hər səhifənin öz URL-i)
- **TanStack Query** (məlumat qatı, mock servislə də)
- **Zustand** (qlobal UI vəziyyəti: rol, tarix diapazonu, seçilmiş zavod, ssenarilər)
- **date-fns** (az lokalı ilə)
- **Framer Motion** (yalnız 6.7-də icazə verilən hallarda)
- **lucide-react**
- **Vitest + Testing Library** (domen funksiyaları və əsas komponentlər)
- **ESLint + Prettier**
- Bütün paket versiyaları dəqiq bərkidilsin (pinned), yeni buraxılmış (son 2 həftə) versiyalardan qaçın.

### 8.2 Qovluq strukturu
```
src/
  app/                # router, layout, providers
  pages/              # hər səhifə ayrıca qovluqda
  components/
    ui/               # shadcn əsas komponentləri
    charts/           # ActualVsOptimalChart, HeatmapWeek, WaterfallChart, Sparkline ...
    ai/               # AiBadge, ConfidenceMeter, WhyPanel, DecisionCard, CopilotPanel
    layout/           # Sidebar, Topbar, PageHeader
    kpi/              # KpiCard, KpiRow
  domain/             # saf hesablama funksiyaları + testlər
    baseline.ts       # reqressiya, optimal zolaq
    anomalies.ts      # anomaliya aşkarlama qaydaları
    forecast.ts       # ay sonu proqnozu, P10–P90
    cost.ts           # xərc hesablaması
    carbon.ts         # Scope 1/2, intensivlik, CBAM təxmini
    mv.ts             # IPMVP qənaət hesablaması
    recommendations.ts# tövsiyə mühərriki qaydaları
  data/
    sources/          # EnergyDataSource interfeysi, MockDataSource
    mock/             # deterministik generator (seed ilə)
    config/           # tariflər, əmsallar, zavod profili (JSON)
  services/           # CopilotService, ReportService
  stores/             # zustand
  lib/                # format.ts, i18n, utils
  styles/             # tokens.css, globals.css
  i18n/               # az.json (default), en.json (struktur hazır, sonra doldurulacaq)
```

### 8.3 Məlumat qatı
- `EnergyDataSource` interfeysi: `getReadings`, `getEquipment`, `getProduction`, `getWeather`, `getAnomalies`, `getRecommendations`, `updateRecommendationStatus`, `getLiveStream` və s.
- `MockDataSource` bu interfeysi tətbiq edir. Gələcəkdə `ApiDataSource` əlavə ediləcək; UI yalnız interfeysi tanıyır.
- Mock məlumat **deterministik** olmalıdır (sabit seed): hər yükləmədə eyni rəqəmlər, beləliklə təqdimatda sürpriz olmur.
- Qərar statusu dəyişiklikləri sessiya ərzində yaddaşda saxlanılır (və istəyə görə localStorage-də, try/catch ilə).

### 8.4 i18n
- Bütün UI mətnləri `i18n/az.json` faylında. Kodda sabit mətn olmasın.
- Default dil: Azərbaycan dili. İngilis dili üçün struktur hazır olsun.

---

## 9. Mock məlumat spesifikasiyası

### 9.1 Zavod profili (fiktiv)
- Ad: "Nümunə Polimer Zavodu" (fiktiv müəssisə; real şirkət adı istifadə etmə).
- Sektor: plastik məmulatlar istehsalı (ekstruziya və injeksiya).
- Yer: Sumqayıt (iqlim üçün; temperatur məlumatı bu bölgəyə uyğun mövsümi olsun).
- İş qrafiki: iş günləri 2 növbə (08:00–00:00), şənbə 1 növbə (08:00–16:00), bazar istirahət.
- Aylıq istehsal: ~1 150–1 350 ton (mövsümi dəyişkənliklə).
- Aylıq elektrik: ~460–520 MVt·saat. Aylıq qaz: ~38 000–55 000 m³ (qışda yüksək).
- Aylıq enerji büdcəsi: 50 000 AZN (elektrik) + qaz büdcəsi ayrıca.

### 9.2 Avadanlıqlar (ən azı 14 vahid, 6 qrupda)
- Hava kompressorları: K-1 (90 kVt), K-2 (90 kVt), K-3 (55 kVt)
- Soyutma: Çiller-1 (180 kVt), Çiller-2 (180 kVt), soyutma qülləsi nasosları
- Ekstruziya xətləri: E-1 … E-4 (hər biri 120–160 kVt)
- İnjeksiya maşınları: İM-1 … İM-3
- Havalandırma: sex və anbar AHU-ları
- İşıqlandırma: sex, anbar, ərazi
- Qazanxana (qaz): istilik və proses buxarı
- Ofis və köməkçi

### 9.3 Zaman sırası
- Son **13 ay** üzrə saatlıq məlumat, avadanlıq səviyyəsində (performans üçün aqreqatlar əvvəlcədən hesablansın və ya memoizasiya edilsin).
- Bu günün tarixi kimi sistem saatını istifadə et; məlumat bu günə qədər "faktiki", ay sonuna qədər "proqnoz" olsun.
- Gündəlik istehsal (ton), saatlıq xarici temperatur.

### 9.4 Daxil edilmiş israf ssenariləri (AI-ın "tapması" üçün)
Generatorda bu nümunələr qəsdən yaradılmalıdır ki, anomaliya aşkarlama real işləsin:
1. K-2 kompressoru iş günləri gecə 01:00–06:30 yüksüz işləyir.
2. Sıxılmış hava sızması: son 9 gündə gecə baza yükü tədricən 22% artır.
3. Çiller-1 bazar günləri tam gücdə işləyir.
4. Havalandırma növbə bitəndən sonra 3 saat işləyir.
5. Anbarda işıqlar gecə boş zonada yanılı qalır.
6. Səhər 08:00-da 4 ekstruziya xətti eyni anda işə salınır (pik güc sıçrayışı).
7. Soyuq günlərdə Çiller-2-nin temperatur təyini dəyişmir (hava ilə uyğunsuzluq).
8. Qazanxanada həftəsonu lazımsız istilik.

### 9.5 Tövsiyələr (ən azı 8, yuxarıdakı ssenarilərə bağlı)
Hər biri: başlıq, təsvir, kateqoriya, kVt·saat/ay, m³/ay (qaz üçün), AZN/ay, t CO₂/il, səy, investisiya (AZN), geri qaytarma müddəti, risk, etimad, status. Nümunələr:
- Kompressorları istehsal qrafikinə bağlamaq (sıfır xərc)
- Sıxılmış hava sızmalarının aradan qaldırılması (aşağı xərc)
- Çiller rejimini xarici havaya görə tənzimləmək (sıfır xərc)
- Havalandırmanı növbələrə uyğunlaşdırmaq (sıfır xərc)
- İşıqlandırmanı zona və növbə üzrə idarə etmək (aşağı xərc)
- Ekstruziya xətlərinin ardıcıl işə salınması (sıfır xərc, pik gücü azaldır)
- Ekstruziya xətlərində gözləmə rejimi (aşağı xərc)
- Kompressora tezlik çeviricisi (VSD) quraşdırmaq (investisiya, geri qaytarma ~18–30 ay)
- Qazanxanada həftəsonu istilik rejimi (sıfır xərc)

Bütün tövsiyələr birlikdə tətbiq edildikdə ümumi elektrik sərfiyyatı təxminən 14–18% azalmalı, ay büdcə daxilində bağlanmalıdır. Rəqəmlər bir-biri ilə uyğun olmalıdır (tövsiyənin qənaəti heç vaxt həmin avadanlığın israfından çox ola bilməz).

### 9.6 Tətbiq olunmuş keçmiş tədbirlər (M&V üçün)
- 3–4 tədbir son 6 ayda tətbiq olunmuş kimi göstərilsin, onlardan biri "gözləniləndən az" nəticə ilə (realizm üçün).

---

## 10. Keyfiyyət tələbləri

- TypeScript strict, `any` istifadə etmə.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` xətasız keçməlidir.
- Domen funksiyaları üçün test əhatəsi ≥ 80%.
- Lighthouse (desktop): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- İlkin yükləmə: route əsaslı kod bölgüsü (lazy loading).
- 13 aylıq saatlıq məlumatla qrafiklər donmamalıdır: aqreqasiya, memoizasiya, lazım olarsa Web Worker.
- Konsolda xəta və xəbərdarlıq olmasın.

---

## 11. Etik və dürüstlük qaydaları

- Heç bir rəqəm uydurulmamalıdır: UI-da göstərilən hər rəqəm mock məlumatdan və domen funksiyalarından hesablanmalıdır.
- AI tövsiyələri "qərar" deyil, "təklif"dir; son söz həmişə istifadəçidədir.
- Etibar səviyyəsi aşağı olan proqnozlarda bu açıq göstərilməlidir.
- Tarif və emissiya əmsallarının mənbəyi və tarixi həmişə görünən olmalıdır.
- Footer-də: "Demo versiya. Məlumatlar nümunə üçün yaradılıb."

---

## 12. Etmə (qadağalar)

- Hər karta gradient, neon, glow effekti vermə.
- Eyni ölçülü, eyni radiuslu kart şəbəkəsi ilə bütün məzmunu doldurma; iyerarxiya yarat.
- ALL CAPS etiketlər, hər başlığın üstündə "eyebrow" etiketi, mənasız 01/02/03 nömrələmə işlətmə.
- Tarifləri və əmsalları kodda sabit yazma.
- Avadanlığı avtomatik idarə edən funksiya əlavə etmə.
- Xarici API (LLM, hava, tarif) çağırışı əlavə etmə; yalnız interfeys hazırla.
- Lorem ipsum işlətmə; bütün mətnlər real kontekstdə Azərbaycan dilində olsun.

---

## 13. İş qaydası

**Mərhələ 0 — Plan (kod yazmadan):**
1. Bu sənədi oxu və anlamadığın və ya ziddiyyətli gördüyün məqamları sual kimi yaz.
2. Texniki plan təqdim et: komponent ağacı, məlumat modeli (TypeScript tipləri), domen funksiyalarının siyahısı, mərhələlər üzrə iş bölgüsü.
3. Dizayn planı: seçdiyin şrift (Azərbaycan hərfləri testinin nəticəsi ilə), Ümumi baxış və AI Qərar Mərkəzi üçün ASCII wireframe.
4. **Təsdiq gözlə.**

**Mərhələ 1 — Təməl:** layihə qurulması, tokenlər, layout (sidebar, topbar), router, i18n, format funksiyaları, mock generator, domen funksiyaları + testlər.

**Mərhələ 2 — Əsas ekranlar:** Ümumi baxış, Avadanlıqlar (siyahı + detal), AI Qərar Mərkəzi.

**Mərhələ 3 — Analitika:** Anomaliyalar, Proqnoz və ssenarilər, Karbon (CBAM ilə), M&V.

**Mərhələ 4 — Tamamlama:** Canlı monitorinq, Hesabatlar, Parametrlər, AI Copilot, komanda palitrası.

**Mərhələ 5 — Cilalama:** bütün vəziyyətlər (loading/empty/error), responsivlik, əlçatanlıq yoxlaması, performans, son vizual baxış.

Hər mərhələdən sonra:
- lint, typecheck, test və build işlət, nəticəni bildir;
- mümkünsə əsas ekranların skrinşotunu çək və öz işinə dizayn baxımından tənqidi bax (iyerarxiya, boşluqlar, rəng intizamı, gradientin yalnız icazə verilən yerlərdə olması);
- nə edildiyini, nə qaldığını və qəbul etdiyin fərziyyələri qısa yaz;
- növbəti mərhələyə keçmək üçün təsdiq gözlə.

---

## 14. Qəbul meyarları

Layihə aşağıdakıların hamısı ödəndikdə tamamlanmış sayılır:

- [ ] Bütün 10 səhifə və AI Copilot paneli işləyir, hər birinin öz URL-i var.
- [ ] Ümumi baxışda büdcə vəziyyəti, faktiki vs optimal qrafiki (optimal zolaqla) və gözləyən qərarlar görünür.
- [ ] AI Qərar Mərkəzində qərar təsdiqləmək, planlamaq, rədd etmək (səbəblə) mümkündür; status dəyişikliyi bütün səhifələrdəki rəqəmlərə (proqnoz, qənaət, CO₂) dərhal təsir edir.
- [ ] Ssenari simulyatorunda dəyişikliklər nəticələri real vaxtda yeniləyir; ssenarilər saxlanıla və müqayisə edilə bilir.
- [ ] Anomaliya aşkarlama 9.4-dəki 8 ssenarinin hamısını tapır.
- [ ] Karbon modulu Scope 1/2-ni ayrıca göstərir, əmsalların mənbəyi görünür, CBAM yoxlama siyahısı işləyir.
- [ ] M&V səhifəsi düzəldilmiş baza xəttini və təsdiqlənmiş qənaəti göstərir.
- [ ] Parametrlərdə tarif, büdcə və ya emissiya əmsalını dəyişdikdə bütün hesablamalar yenilənir.
- [ ] Rol seçici Ümumi baxışın məzmununu dəyişir.
- [ ] Gradient yalnız 6.3-də göstərilən yerlərdə istifadə olunub.
- [ ] Azərbaycan hərfləri hər yerdə düzgün render olunur, rəqəmlər az formatındadır.
- [ ] 1440px, 1024px və 390px enlərdə düzgün görünür.
- [ ] Klaviatura ilə tam naviqasiya, görünən focus, qrafiklər üçün cədvəl alternativi.
- [ ] lint, typecheck, test, build xətasız; Lighthouse hədəfləri ödənilib.
- [ ] README: quraşdırma, işə salma, arxitektura, mock məlumatı real API ilə necə əvəz etmək, parametrlərin mənbələri.

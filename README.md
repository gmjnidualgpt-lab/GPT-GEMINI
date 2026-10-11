# TriadBridge Worker MVP

Minimalny szkielet integracji Cloudflare Workers, OpenAI API, Google Gemini API i opcjonalnego testu dostępności Supabase.

## Co jest zaimplementowane

- `GET /health`: status usługi i obecności konfiguracji. Nie wykonuje testowych wywołań dostawców.
- `POST /api/chat`: rzeczywiste wywołanie OpenAI Responses API lub Gemini `generateContent`.
- `POST /api/supabase-check`: test dostępności endpointu Supabase Auth.
- Wspólny sekret Bearer dla tras POST.
- Walidacja wejścia, limit rozmiaru żądania, timeouty i odpowiedzi błędów bez ujawniania treści odpowiedzi upstream.
- Podstawowe testy lokalne.

## Ważne ograniczenia

- To MVP, nie gotowa konfiguracja produkcyjna.
- Nie ma jeszcze integracji AI Gateway, trwałego rate limitingu ani testu end-to-end po wdrożeniu.
- `GET /health` sprawdza tylko konfigurację. Udane połączenie z GPT/Gemini potwierdza dopiero poprawna odpowiedź z `POST /api/chat`.
- Test Supabase sprawdza osiągalność Auth API, nie tabele, uprawnienia RLS ani dostęp do danych.
- Endpoint wymaga sekretu serwer-serwer. Nie umieszczaj `INTEGRATION_SHARED_SECRET` w kodzie przeglądarkowym.
- Domyślne nazwy modeli są konfigurowalne. Jeśli API nie obsługuje danego modelu, ustaw właściwą wartość w zmiennych Worker.

## Lokalne uruchomienie

Wymagany Node.js i konto Cloudflare.

```bash
npm install
cp .dev.vars.example .dev.vars
# Uzupełnij lokalne sekrety w .dev.vars
npm test
npm run dev
```

Nie dodawaj `.dev.vars` do Git.

## Sekrety Cloudflare

Ustaw je poleceniami, które zapytają o wartości interaktywnie:

```bash
npx wrangler secret put INTEGRATION_SHARED_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_URL
```

`SUPABASE_URL` nie jest typowym sekretem, ale może być ustawiony jako zmienna. W razie użycia `wrangler secret put`, kod odczyta go tak samo jak pozostałe zmienne. Używaj wyłącznie klucza Supabase `anon`/publishable po stronie tej integracji i zabezpiecz tabele przez RLS. Nie ustawiaj `service_role` w tej aplikacji MVP.

## Wdrożenie i test

```bash
npx wrangler deploy
```

Po wdrożeniu:

```bash
curl https://YOUR-WORKER.workers.dev/health
curl -X POST https://YOUR-WORKER.workers.dev/api/chat \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_SHARED_SECRET' \
  -d '{"provider":"openai","message":"Odpowiedz jednym słowem: OK"}'
```

Dla Gemini ustaw `provider` na `gemini`. Nie umieszczaj prawdziwego sekretu w historii powłoki, publicznych logach ani w kodzie klienta.

## Kolejne kroki przed produkcją

1. Skonfigurować sekrety w Cloudflare.
2. Dodać regułę rate limiting w Cloudflare dla `/api/chat` i `/api/supabase-check`.
3. Ograniczyć `CORS_ORIGIN` do rzeczywistej domeny klienta albo pozostawić pusty, jeśli nie jest potrzebny browser CORS.
4. Uruchomić testy lokalne.
5. Wdrożyć Worker i wykonać osobne testy OpenAI, Gemini oraz Supabase.
6. Dodać testy RLS na podstawie rzeczywistego schematu Supabase.
7. Dopiero po otrzymaniu rzeczywistych odpowiedzi oznaczyć integrację jako PASS.

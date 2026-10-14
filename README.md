# cojemy

Mobilne MVP dla dwóch osób, po polsku. Bez kont, zakupów i kalorii.

## Uruchomienie

Wymagany Node.js 20 lub nowszy. Bez instalowania pakietów. W folderze aplikacji:

```sh
npm start
```

Otwórz http://localhost:3000. Zatrzymanie: Ctrl+C. Inny port: `PORT=3001 npm start`.

## Wspólny wybór

1. W zwykłym oknie wpisz imię i utwórz parę.
2. W oknie prywatnym lub innej przeglądarce otwórz ten sam adres i dołącz kodem jako druga osoba.
3. Osobno zaznaczcie chipsy: bazę posiłku (np. makaron, ryż, warzywa, coś białkowego), smaki i sposób jedzenia. W jednym polu wpiszcie wykluczenia: składniki, dania lub kuchnie. Wykluczenia zapamiętują się na kolejne posiłki.
4. Aplikacja pokazuje maksymalnie 3 propozycje. Wykluczenia są twardymi ograniczeniami; pozytywne zachcianki zwiększają wynik. Przy małej kolekcji może pokazać alternatywę do zaznaczonej zachcianki. Jedna chętna osoba może gotować dla obojga. Zamówienie lub wyjście musi pasować obojgu.
5. Każde wybiera danie. Zgodny pierwszy wybór zapisuje decyzję. Różne wybory otwierają dwie karty do finalnego potwierdzenia. Imiona i aktualne finalne wybory są widoczne, a komunikat wyjaśnia, na kogo czekamy.
6. Przy dwóch różnych finalnych wyborach są dwie opcje: „Poddaję się — wybór drugiej osoby jest OK” albo „Rozstrzygnijmy grą”. Poddanie się akceptuje FINALNY wybór drugiej osoby, również jeśli zmieniła swoją pierwszą propozycję.
7. Nowy posiłek resetuje głosy i grę, zachowując wykluczenia i własne linki.

„Nic nie pasuje?” przed finalnym rozstrzygnięciem oferuje inne przepisy, własny link, zamówienie i wyjście. Odrzucenie karty, zmiana kategorii lub preferencji czy dodanie linku rozpoczyna wybieranie od nowa dla obu osób. Potwierdzonej decyzji nie zmieniają przyciski z poprzedniego etapu.

## Jedno pole wykluczeń

Formularz i serwer używają tego samego słownika w `public/preferences.js`. Działa bez połączenia z usługą AI. Przykłady: `humus` → `hummus`, `pomidoryy` → `pomidor`, `kuchnia srodziemnomorska` → `kuchnia śródziemnomorska`. Ignoruje wielkość liter i polskie znaki, obsługuje wybrane odmiany słów, synonimy i drobne literówki. Rozpoznane wpisy pokazują się pod polem i można je usunąć. Mniej pewne poprawki wymagają kliknięcia sugestii. Nierozpoznane wpisy są oznaczone i filtrują tylko dosłowny zapis; aplikacja nie rozumie dowolnych zdań ani każdego składnika. Oddziel wpisy przecinkami, średnikami lub nowymi liniami.

Przepisy mają oznaczenia rodzaju dania i kuchni. Szersze kategorie, np. śródziemnomorska, obejmują oznaczone przepisy włoskie i greckie. Własny przepis możesz oznaczyć chipsami rodzaju dania i kuchni. Jakość filtrowania zależy od zapisanych składników i oznaczeń — to nie zweryfikowana baza alergenów. Przy alergiach sprawdzaj pełny przepis i etykiety.

## Kamień, papier, nożyce

Gra jest opcjonalna. Osoba proponująca ją akceptuje oba dania, a druga osoba musi osobno się zgodzić. Gracie o swoje FINALNE wybory. Gesty są zapisywane przez serwer i nie można ich zmienić. Każda osoba widzi tylko własny gest, dopóki obie nie wybiorą. Dopiero wtedy serwer odsłania ruchy i oblicza wynik. Remis nie wybiera dania — można rozegrać kolejną rundę. Zwycięstwo zapisuje danie przypisane do zwycięzcy. Poddanie się jest możliwe również podczas oczekiwania na gest. Restart serwera zachowuje trwającą grę oraz wynik. Żądania z poprzedniej rundy gry są odrzucane; spóźnione kliknięcie nie zmienia rozstrzygniętej decyzji.

## Przepisy i własne linki

Kolekcja startowa: 8 przepisów z Kwestii Smaku i Serious Eats, nasz burger roślinny, zupa z soczewicą i kuskus z ciecierzycą oraz 6 pomysłów na zamówienie lub posiłek na mieście. Karty zawierają źródło, składniki, link i naszą ocenę nakładu pracy. Czasy z „ok.” są szacunkami. Pełne przepisy otwierają się u autorów; nie kopiujemy zdjęć ani instrukcji. Własne adaptacje są oznaczone. Mięso i ryby są wykluczone; roślinne zamienniki są dopuszczone. W przepisach z wariantami wybieramy oliwę zamiast tłuszczu zwierzęcego i bulion warzywny. Sery należy wybierać bez podpuszczki zwierzęcej.

Kolekcja jest dobrana ręcznie — bez automatycznego przeszukiwania internetu. Dla własnego linku podaj HTTPS URL, nazwę, wszystkie składniki, czas, nakład pracy i oznaczenia. Serwer nie pobiera dowolnych stron; dopasowuje dane wpisane w formularzu. Maksymalnie 50 linków na parę; identycznego URL nie dodasz drugi raz. Kolekcja jest wspólna i zostaje po restarcie oraz nowym posiłku. Własne przepisy również podlegają wykluczeniom. Pomysły „Zamówienie” i „Na mieście” nie wyszukują restauracji — lokal wybieracie sami.

## Dwa telefony i dane

Na dwóch telefonach w tej samej sieci Wi-Fi co komputer otwórz `http://ADRES_IP_KOMPUTERA:3000`. IP znajdziesz w ustawieniach sieci komputera. Zezwól Node.js na połączenia przychodzące, jeśli system o to poprosi. Serwer musi pozostawać włączony. Każda osoba potrzebuje osobnej przeglądarki lub urządzenia. Kod działa tylko na tym samym serwerze.

To lokalne MVP, bez publicznego hostingu. Logika gry obsługuje oddzielne urządzenia i asynchroniczne wybory; dostęp z różnych sieci wymaga udostępnienia wspólnego serwera w internecie. Przed publicznym udostępnieniem potrzebne są HTTPS, ograniczanie prób, odzyskiwanie dostępu i usuwanie par.

Node.js + HTML/CSS/JavaScript, bez zależności i z jednym procesem. Synchronizacja co 2 sekundy. Każda osoba ma osobny zapis: preferencje, pierwszy wybór i finalny wybór. Wspólne zostają kod pary, runda, gra i własne przepisy. Przy `SUPABASE_URL` i `SUPABASE_SECRET_KEY` serwer zapisuje to w Supabase. Bez nich zapis jest atomowy w `data/pairs.json`. Testy ustawiają `DATA_DIR` i zawsze używają pliku. Przeglądarka przechowuje token uczestnika i nie łączy się z bazą — gesty zostają na serwerze, dopóki obie osoby nie wybiorą. Wracaj w tej samej przeglądarce; wyczyszczenie jej danych traci dostęp. „Wyjdź” odłącza urządzenie i nie zwalnia miejsca w parze. Nie udostępniaj pliku danych ani klucza service role. Fonty Google są opcjonalne; są lokalne zamienniki.

Plik `.env` w folderze aplikacji (nie commituj go):

```sh
SUPABASE_URL=https://PROJEKT.supabase.co
SUPABASE_SECRET_KEY=klucz_service_role
```

`SUPABASE_SECRET_KEY` to secret key z ustawień API projektu, nie klucz publishable. W SQL Editorze uruchom `supabase/migrations/20261014153000_pair_choices.sql`, potem `npm start`.

## Testy

```sh
npm test
```

16 testów obejmuje ograniczenia i literówki, kuchnie, chipsy, wyjście na jedzenie, własne linki, zmianę propozycji, dwie niezależne sesje, trwałość danych, finalną rozbieżność, poddanie się, obustronną zgodę na grę, wszystkie kombinacje gestów, ochronę pierwszego gestu, remis i ponowną rundę, zwycięstwo, odrzucenie gry oraz spóźnione żądania.

## Stały adres internetowy — kolejny etap

Baza to Supabase. Serwer Node nadal musi działać — aplikacja nie jest jeszcze funkcją Vercel. Dwa telefony z różnych sieci potrzebują wspólnego, publicznego adresu tego serwera.

1. Uruchom migrację i uzupełnij `.env`, jak wyżej. Nie dodawaj `data/`, tokenów ani `.env` do repozytorium.
2. Przed publicznym adresem: ogranicz próby dołączenia, ogranicz odpytywanie nieaktywnej karty i trzymaj jeden proces albo przenieś stan wyłącznie do bazy bez pamięci procesu.
3. Sprawdź tworzenie pary i wspólną decyzję na dwóch telefonach. Po restarcie serwera wybory obu osób mają zostać w Supabase.

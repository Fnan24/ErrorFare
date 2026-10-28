# Foutprijs Radar: installeren op je telefoon

Een webapp zonder advertenties die elke 3 uur deals ophaalt uit meerdere bronnen, alle prijzen in euro toont en error fares bovenaan zet. Het draait gratis op GitHub (Actions + Pages). Je hebt een gratis GitHub-account nodig.

## Eenmalig opzetten (ongeveer 10 minuten, kan op je telefoon of laptop)
1. Maak op github.com een nieuwe, publieke repository, bijvoorbeeld `foutprijs-radar`.
2. Upload alle bestanden uit deze map, inclusief de verborgen map `.github`. Op de laptop kan dat met "Add file > Upload files" door de hele map te slepen.
3. Ga naar Settings > Pages. Kies onder "Build and deployment" de bron "Deploy from a branch", branch `main`, map `/ (root)`. Sla op.
4. Ga naar Actions, kies "Deals bijwerken" en klik "Run workflow". Na ongeveer een minuut staat er een `deals.json` in je repository. Daarna draait de workflow zelf elke 3 uur.
5. Je site staat op `https://JOUWNAAM.github.io/foutprijs-radar/`.

## Op je telefoon zetten
Open die link in Chrome, tik op het menu (drie puntjes) en kies "App installeren" of "Toevoegen aan startscherm". Het icoon verschijnt tussen je apps en opent schermvullend.

## Bronnen aanpassen
Bewerk `sources.json`. Elke bron is een RSS- of Atom-feed. Onderaan de app zie je per bron of het ophalen gelukt is. Een bron die faalt (bijvoorbeeld door een andere feed-URL) blokkeert de rest niet.

## Beperkingen
- GitHub start geplande taken soms met enkele minuten tot een uur vertraging. Voor een echte error fare, die vaak 8 tot 20 minuten leeft, is dit dus niet snel genoeg. Gebruik daarnaast de pushmeldingen van de apps van Going of Jack's Flight Club.
- Prijzen worden uit de titel van een bericht gehaald. Staat daar geen prijs in, dan toont de app een streepje.
- X en Telegram hebben geen vrije feeds. Daarvoor is een eigen bot of een betaalde API nodig, dat zit hier niet in.

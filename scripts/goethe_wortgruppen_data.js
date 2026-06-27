// Goethe / Start Deutsch Wortgruppenliste data — manually curated from
// each level's PDF. Each level has thematic groups; each group has the
// member nouns/verbs/adjectives drawn from the PDF.
//
// Used by add_goethe_wortgruppen.js (to add missing entries to the bank
// and emit per-group deck files for goethe-a1/, goethe-a2/, goethe-b1/).

// Helper: noun entry shape is [article, plural, english, optional modifiers].
// modifiers: ["nur Sg."] / ["nur Pl."]

const FAMILY_BASE = {
  "Bruder": ["der", "Brüder", "brother"],
  "Schwester": ["die", "Schwestern", "sister"],
  "Mutter": ["die", "Mütter", "mother"],
  "Vater": ["der", "Väter", "father"],
  "Sohn": ["der", "Söhne", "son"],
  "Tochter": ["die", "Töchter", "daughter"],
  "Kind": ["das", "Kinder", "child"],
  "Eltern": ["die", "Eltern", "parents", ["nur Pl."]],
  "Großmutter": ["die", "Großmütter", "grandmother"],
  "Großvater": ["der", "Großväter", "grandfather"],
  "Oma": ["die", "Omas", "grandma"],
  "Opa": ["der", "Opas", "grandpa"],
  "Mama": ["die", "Mamas", "mum/mom"],
  "Papa": ["der", "Papas", "dad"],
  "Onkel": ["der", "Onkel", "uncle"],
  "Tante": ["die", "Tanten", "aunt"],
  "Cousin": ["der", "Cousins", "cousin (male)"],
  "Cousine": ["die", "Cousinen", "cousin (female)"],
  "Enkel": ["der", "Enkel", "grandchild/grandson"],
  "Enkelin": ["die", "Enkelinnen", "granddaughter"],
  "Geschwister": ["die", "Geschwister", "siblings", ["nur Pl."]],
  "Verwandte": ["der", "Verwandten", "relative"],
};

const TIME_OF_DAY_BASE = {
  "Tag": ["der", "Tage", "day"],
  "Morgen": ["der", "Morgen", "morning"],
  "Vormittag": ["der", "Vormittage", "late morning/forenoon"],
  "Mittag": ["der", "Mittage", "midday/noon"],
  "Nachmittag": ["der", "Nachmittage", "afternoon"],
  "Abend": ["der", "Abende", "evening"],
  "Nacht": ["die", "Nächte", "night"],
  "Mitternacht": ["die", "—", "midnight", ["nur Sg."]],
};

const WEEKDAYS_BASE = {
  "Wochentag": ["der", "Wochentage", "weekday"],
  "Wochenende": ["das", "Wochenenden", "weekend"],
  "Montag": ["der", "Montage", "Monday"],
  "Dienstag": ["der", "Dienstage", "Tuesday"],
  "Mittwoch": ["der", "Mittwoche", "Wednesday"],
  "Donnerstag": ["der", "Donnerstage", "Thursday"],
  "Freitag": ["der", "Freitage", "Friday"],
  "Samstag": ["der", "Samstage", "Saturday"],
  "Sonnabend": ["der", "Sonnabende", "Saturday (northern German)"],
  "Sonntag": ["der", "Sonntage", "Sunday"],
  "Werktag": ["der", "Werktage", "working day/weekday"],
  "Arbeitstag": ["der", "Arbeitstage", "working day"],
  "Feiertag": ["der", "Feiertage", "public holiday"],
};

const MONTHS_BASE = {
  "Januar": ["der", "—", "January", ["nur Sg."]],
  "Februar": ["der", "—", "February", ["nur Sg."]],
  "März": ["der", "—", "March", ["nur Sg."]],
  "April": ["der", "—", "April", ["nur Sg."]],
  "Mai": ["der", "—", "May", ["nur Sg."]],
  "Juni": ["der", "—", "June", ["nur Sg."]],
  "Juli": ["der", "—", "July", ["nur Sg."]],
  "August": ["der", "—", "August", ["nur Sg."]],
  "September": ["der", "—", "September", ["nur Sg."]],
  "Oktober": ["der", "—", "October", ["nur Sg."]],
  "November": ["der", "—", "November", ["nur Sg."]],
  "Dezember": ["der", "—", "December", ["nur Sg."]],
  "Jänner": ["der", "—", "January (Austrian)", ["nur Sg."]],
  "Feber": ["der", "—", "February (Austrian)", ["nur Sg."]],
};

const SEASONS_BASE = {
  "Frühling": ["der", "Frühlinge", "spring"],
  "Frühjahr": ["das", "Frühjahre", "spring (the season)"],
  "Sommer": ["der", "Sommer", "summer"],
  "Herbst": ["der", "Herbste", "autumn/fall"],
  "Winter": ["der", "Winter", "winter"],
};

const TIME_UNITS_BASE = {
  "Sekunde": ["die", "Sekunden", "second"],
  "Minute": ["die", "Minuten", "minute"],
  "Stunde": ["die", "Stunden", "hour"],
  "Woche": ["die", "Wochen", "week"],
  "Monat": ["der", "Monate", "month"],
  "Jahr": ["das", "Jahre", "year"],
  "Jahrzehnt": ["das", "Jahrzehnte", "decade"],
  "Jahrhundert": ["das", "Jahrhunderte", "century"],
  "Jahrtausend": ["das", "Jahrtausende", "millennium"],
};

const HOLIDAYS_BASE = {
  "Karneval": ["der", "—", "carnival", ["nur Sg."]],
  "Ostern": ["das", "—", "Easter", ["nur Sg."]],
  "Weihnachten": ["das", "—", "Christmas", ["nur Sg."]],
  "Neujahr": ["das", "—", "New Year", ["nur Sg."]],
  "Silvester": ["das", "—", "New Year's Eve", ["nur Sg."]],
  "Pfingsten": ["das", "—", "Pentecost/Whitsun", ["nur Sg."]],
  "Nationalfeiertag": ["der", "Nationalfeiertage", "national holiday"],
};

const CURRENCY_BASE = {
  "Euro": ["der", "Euro", "euro"],
  "Cent": ["der", "Cent", "cent"],
  "Franken": ["der", "Franken", "Swiss franc"],
  "Rappen": ["der", "Rappen", "Rappen (Swiss centime)"],
};

const MEASURES_BASE = {
  "Meter": ["der", "Meter", "metre"],
  "Zentimeter": ["der", "Zentimeter", "centimetre"],
  "Kilometer": ["der", "Kilometer", "kilometre"],
  "Quadratmeter": ["der", "Quadratmeter", "square metre"],
  "Grad": ["der", "Grad", "degree"],
  "Prozent": ["das", "Prozent", "per cent"],
  "Liter": ["der", "Liter", "litre"],
  "Gramm": ["das", "Gramm", "gram"],
  "Pfund": ["das", "Pfund", "pound (500 g)"],
  "Kilo": ["das", "Kilos", "kilo"],
  "Kilogramm": ["das", "Kilogramm", "kilogram"],
  "Dekagramm": ["das", "Dekagramm", "decagram (10 g, Austrian)"],
};

const DIRECTIONS_BASE = {
  "Norden": ["der", "—", "north", ["nur Sg."]],
  "Süden": ["der", "—", "south", ["nur Sg."]],
  "Osten": ["der", "—", "east", ["nur Sg."]],
  "Westen": ["der", "—", "west", ["nur Sg."]],
};

const COUNTRIES_BASE = {
  "Deutschland": ["das", "—", "Germany", ["nur Sg."]],
  "Österreich": ["das", "—", "Austria", ["nur Sg."]],
  "Luxemburg": ["das", "—", "Luxembourg", ["nur Sg."]],
  "Europa": ["das", "—", "Europe", ["nur Sg."]],
  "Türkei": ["die", "—", "Turkey", ["nur Sg."]],
  "Griechenland": ["das", "—", "Greece", ["nur Sg."]],
  "Ukraine": ["die", "—", "Ukraine", ["nur Sg."]],
  "Finnland": ["das", "—", "Finland", ["nur Sg."]],
  "Mexiko": ["das", "—", "Mexico", ["nur Sg."]],
};

const NATIONALITIES_BASE = {
  "Deutsche": ["der", "Deutschen", "German person"],
  "Österreicher": ["der", "Österreicher", "Austrian person"],
  "Österreicherin": ["die", "Österreicherinnen", "Austrian (female)"],
  "Schweizer": ["der", "Schweizer", "Swiss person"],
  "Schweizerin": ["die", "Schweizerinnen", "Swiss (female)"],
  "Luxemburger": ["der", "Luxemburger", "Luxembourger"],
  "Luxemburgerin": ["die", "Luxemburgerinnen", "Luxembourger (female)"],
  "Europäer": ["der", "Europäer", "European"],
  "Europäerin": ["die", "Europäerinnen", "European (female)"],
  "Türke": ["der", "Türken", "Turk"],
  "Türkin": ["die", "Türkinnen", "Turkish woman"],
  "Grieche": ["der", "Griechen", "Greek"],
  "Griechin": ["die", "Griechinnen", "Greek woman"],
  "Ukrainer": ["der", "Ukrainer", "Ukrainian"],
  "Ukrainerin": ["die", "Ukrainerinnen", "Ukrainian (female)"],
  "Finne": ["der", "Finnen", "Finn"],
  "Finnin": ["die", "Finninnen", "Finnish woman"],
  "Mexikaner": ["der", "Mexikaner", "Mexican"],
  "Mexikanerin": ["die", "Mexikanerinnen", "Mexican (female)"],
};

const PROFESSIONS_A2_BASE = {
  "Angestellter": ["der", "Angestellten", "employee"],
  "Angestellte": ["die", "Angestellten", "employee (female)"],
  "Arzt": ["der", "Ärzte", "doctor"],
  "Ärztin": ["die", "Ärztinnen", "doctor (female)"],
  "Auszubildender": ["der", "Auszubildenden", "trainee/apprentice"],
  "Auszubildende": ["die", "Auszubildenden", "trainee (female)"],
  "Autor": ["der", "Autoren", "author"],
  "Autorin": ["die", "Autorinnen", "author (female)"],
  "Babysitter": ["der", "Babysitter", "babysitter"],
  "Bäcker": ["der", "Bäcker", "baker"],
  "Bäckerin": ["die", "Bäckerinnen", "baker (female)"],
  "Doktor": ["der", "Doktoren", "doctor (academic)"],
  "Fahrer": ["der", "Fahrer", "driver"],
  "Fahrerin": ["die", "Fahrerinnen", "driver (female)"],
  "Friseur": ["der", "Friseure", "hairdresser"],
  "Friseurin": ["die", "Friseurinnen", "hairdresser (female)"],
  "Handwerker": ["der", "Handwerker", "craftsperson"],
  "Handwerkerin": ["die", "Handwerkerinnen", "craftsperson (female)"],
  "Hausfrau": ["die", "Hausfrauen", "housewife"],
  "Journalist": ["der", "Journalisten", "journalist"],
  "Kaufmann": ["der", "Kaufleute", "merchant/businessman"],
  "Kauffrau": ["die", "Kauffrauen", "businesswoman"],
  "Kellner": ["der", "Kellner", "waiter"],
  "Kellnerin": ["die", "Kellnerinnen", "waitress"],
  "Koch": ["der", "Köche", "cook"],
  "Köchin": ["die", "Köchinnen", "cook (female)"],
  "Krankenpfleger": ["der", "Krankenpfleger", "male nurse"],
  "Krankenschwester": ["die", "Krankenschwestern", "nurse (female)"],
  "Künstler": ["der", "Künstler", "artist"],
  "Künstlerin": ["die", "Künstlerinnen", "artist (female)"],
  "Lehrer": ["der", "Lehrer", "teacher"],
  "Lehrerin": ["die", "Lehrerinnen", "teacher (female)"],
  "Mechaniker": ["der", "Mechaniker", "mechanic"],
  "Model": ["das", "Models", "model"],
  "Musiker": ["der", "Musiker", "musician"],
  "Musikerin": ["die", "Musikerinnen", "musician (female)"],
  "Polizist": ["der", "Polizisten", "police officer"],
  "Polizistin": ["die", "Polizistinnen", "police officer (female)"],
  "Rentner": ["der", "Rentner", "pensioner"],
  "Rentnerin": ["die", "Rentnerinnen", "pensioner (female)"],
  "Sänger": ["der", "Sänger", "singer"],
  "Sängerin": ["die", "Sängerinnen", "singer (female)"],
  "Schauspieler": ["der", "Schauspieler", "actor"],
  "Schauspielerin": ["die", "Schauspielerinnen", "actress"],
  "Techniker": ["der", "Techniker", "technician"],
  "Technikerin": ["die", "Technikerinnen", "technician (female)"],
  "Verkäufer": ["der", "Verkäufer", "sales clerk"],
  "Verkäuferin": ["die", "Verkäuferinnen", "sales clerk (female)"],
};

const SCHOOL_A2_BASE = {
  "Abitur": ["das", "Abiture", "secondary-school leaving exam (German)", ["nur Sg."]],
  "Direktor": ["der", "Direktoren", "director/principal"],
  "Direktorin": ["die", "Direktorinnen", "director/principal (female)"],
  "Hausaufgabe": ["die", "Hausaufgaben", "homework assignment"],
  "Klasse": ["die", "Klassen", "class/grade"],
  "Klassenfahrt": ["die", "Klassenfahrten", "school trip"],
  "Sekretariat": ["das", "Sekretariate", "school office/secretariat"],
  "Stundenplan": ["der", "Stundenpläne", "timetable"],
  "Biologie": ["die", "—", "biology", ["nur Sg."]],
  "Chemie": ["die", "—", "chemistry", ["nur Sg."]],
  "Englisch": ["das", "—", "English (school subject)", ["nur Sg."]],
  "Französisch": ["das", "—", "French (school subject)", ["nur Sg."]],
  "Geografie": ["die", "—", "geography", ["nur Sg."]],
  "Geschichte": ["die", "Geschichten", "history; story"],
  "Latein": ["das", "—", "Latin", ["nur Sg."]],
  "Mathematik": ["die", "—", "mathematics", ["nur Sg."]],
  "Physik": ["die", "—", "physics", ["nur Sg."]],
  "Religion": ["die", "Religionen", "religion"],
  "Sozialkunde": ["die", "—", "social studies", ["nur Sg."]],
  "Sport": ["der", "—", "physical education; sport", ["nur Sg."]],
  "Musik": ["die", "—", "music", ["nur Sg."]],
  "Kunst": ["die", "Künste", "art"],
};

const POLITICS_B1_BASE = {
  "Bund": ["der", "Bünde", "federation/league"],
  "Bundeskanzler": ["der", "Bundeskanzler", "chancellor (federal)"],
  "Bundeskanzlerin": ["die", "Bundeskanzlerinnen", "chancellor (federal, female)"],
  "Bundespräsident": ["der", "Bundespräsidenten", "federal president"],
  "Bürgermeister": ["der", "Bürgermeister", "mayor"],
  "Bürgermeisterin": ["die", "Bürgermeisterinnen", "mayor (female)"],
  "Demokratie": ["die", "Demokratien", "democracy"],
  "Gemeinde": ["die", "Gemeinden", "municipality/community"],
  "Minister": ["der", "Minister", "minister (government)"],
  "Ministerin": ["die", "Ministerinnen", "minister (female)"],
  "Parlament": ["das", "Parlamente", "parliament"],
  "Partei": ["die", "Parteien", "(political) party"],
  "Regierung": ["die", "Regierungen", "government"],
  "Staat": ["der", "Staaten", "state/nation"],
  "Bundesland": ["das", "Bundesländer", "federal state"],
  "Bundestag": ["der", "Bundestage", "Bundestag (German parliament)"],
  "Nationalrat": ["der", "Nationalräte", "National Council (Austria/Switzerland)"],
  "Bundesrat": ["der", "Bundesräte", "Federal Council (Switzerland) / Bundesrat"],
  "Bundesrätin": ["die", "Bundesrätinnen", "Federal Councillor (female, Switzerland)"],
  "Kanton": ["der", "Kantone", "canton (Switzerland)"],
  "Regierungsrat": ["der", "Regierungsräte", "cantonal government councillor (Switzerland)"],
  "Stadtpräsident": ["der", "Stadtpräsidenten", "city president (Switzerland)"],
  "Ständerat": ["der", "Ständeräte", "Council of States (Switzerland)"],
  "Ammann": ["der", "Ammänner", "Ammann (Swiss official)"],
  "EU": ["die", "—", "EU", ["nur Sg."]],
  "Bundesrepublik": ["die", "Bundesrepubliken", "federal republic"],
};

const ANIMALS_B1_BASE = {
  "Affe": ["der", "Affen", "monkey"],
  "Bär": ["der", "Bären", "bear"],
  "Biene": ["die", "Bienen", "bee"],
  "Elefant": ["der", "Elefanten", "elephant"],
  "Ente": ["die", "Enten", "duck"],
  "Fisch": ["der", "Fische", "fish"],
  "Fliege": ["die", "Fliegen", "fly (insect)"],
  "Giraffe": ["die", "Giraffen", "giraffe"],
  "Hase": ["der", "Hasen", "hare"],
  "Hund": ["der", "Hunde", "dog"],
  "Insekt": ["das", "Insekten", "insect"],
  "Katze": ["die", "Katzen", "cat"],
  "Krokodil": ["das", "Krokodile", "crocodile"],
  "Kuh": ["die", "Kühe", "cow"],
  "Löwe": ["der", "Löwen", "lion"],
  "Maus": ["die", "Mäuse", "mouse"],
  "Mücke": ["die", "Mücken", "mosquito/midge"],
  "Pferd": ["das", "Pferde", "horse"],
  "Pinguin": ["der", "Pinguine", "penguin"],
  "Schaf": ["das", "Schafe", "sheep"],
  "Schildkröte": ["die", "Schildkröten", "tortoise/turtle"],
  "Schlange": ["die", "Schlangen", "snake; queue"],
  "Schwein": ["das", "Schweine", "pig"],
  "Vogel": ["der", "Vögel", "bird"],
};

const ANGLICISMS_B1_NOUNS = {
  "Abo": ["das", "Abos", "subscription (Abonnement)"],
  "Abonnement": ["das", "Abonnements", "subscription"],
  "Akku": ["der", "Akkus", "battery (rechargeable)"],
  "Azubi": ["der", "Azubis", "trainee (Auszubildende)"],
  "DVD": ["die", "DVDs", "DVD"],
  "Baby": ["das", "Babys", "baby"],
  "Babysitter": ["der", "Babysitter", "babysitter"],
  "Babysitterin": ["die", "Babysitterinnen", "babysitter (female)"],
  "Band": ["die", "Bands", "band (music)"],
  "Bar": ["die", "Bars", "bar (drinking)"],
  "Bikini": ["der", "Bikinis", "bikini"],
  "Blog": ["der", "Blogs", "blog"],
  "Camp": ["das", "Camps", "camp"],
  "Castingshow": ["die", "Castingshows", "casting show"],
  "CD-Player": ["der", "CD-Player", "CD player"],
  "Chat": ["der", "Chats", "chat"],
  "Chatroom": ["der", "Chatrooms", "chat room"],
  "Chip": ["der", "Chips", "chip"],
  "City": ["die", "Citys", "city centre"],
  "Comic": ["der", "Comics", "comic"],
  "Computer": ["der", "Computer", "computer"],
  "E-Bike": ["das", "E-Bikes", "e-bike"],
  "Fan": ["der", "Fans", "fan/supporter"],
  "Fax": ["das", "Faxe", "fax"],
  "Festival": ["das", "Festivals", "festival"],
  "Fitness": ["die", "—", "fitness", ["nur Sg."]],
  "Hamburger": ["der", "Hamburger", "hamburger"],
  "Hit": ["der", "Hits", "hit (song/success)"],
  "Homepage": ["die", "Homepages", "homepage"],
  "Internet": ["das", "—", "internet", ["nur Sg."]],
  "Jazz": ["der", "—", "jazz", ["nur Sg."]],
  "Job": ["der", "Jobs", "job"],
  "Killer": ["der", "Killer", "killer"],
  "Killerin": ["die", "Killerinnen", "killer (female)"],
  "Laptop": ["der", "Laptops", "laptop"],
  "Link": ["der", "Links", "link"],
  "Mail": ["die", "Mails", "email"],
  "Mailbox": ["die", "Mailboxen", "mailbox/voicemail"],
  "Manager": ["der", "Manager", "manager"],
  "Managerin": ["die", "Managerinnen", "manager (female)"],
  "Mountainbike": ["das", "Mountainbikes", "mountain bike"],
  "Plattform": ["die", "Plattformen", "platform"],
  "Poster": ["das", "Poster", "poster"],
  "Puzzle": ["das", "Puzzles", "puzzle"],
  "Sandwich": ["das", "Sandwiches", "sandwich"],
  "Show": ["die", "Shows", "show"],
  "Smartphone": ["das", "Smartphones", "smartphone"],
  "Snack": ["der", "Snacks", "snack"],
  "Song": ["der", "Songs", "song"],
  "Spot": ["der", "Spots", "(commercial) spot"],
  "Steak": ["das", "Steaks", "steak"],
  "Swimmingpool": ["der", "Swimmingpools", "swimming pool"],
  "Taxi": ["das", "Taxis", "taxi"],
  "Team": ["das", "Teams", "team"],
  "Terminal": ["der", "Terminals", "terminal"],
  "Tour": ["die", "Touren", "tour"],
  "Trend": ["der", "Trends", "trend"],
  "User": ["der", "User", "user"],
  "Userin": ["die", "Userinnen", "user (female)"],
  "Pkw": ["der", "Pkws", "car (Personenkraftwagen)"],
  "ICE": ["der", "ICEs", "ICE high-speed train"],
  "Kfz": ["das", "Kfzs", "motor vehicle (Kraftfahrzeug)"],
  "TV": ["das", "—", "TV", ["nur Sg."]],
  "WG": ["die", "WGs", "shared flat (Wohngemeinschaft)"],
  "WC": ["das", "WCs", "WC/toilet"],
  "Wohngemeinschaft": ["die", "Wohngemeinschaften", "shared flat"],
  "Erdgeschoss": ["das", "Erdgeschosse", "ground floor"],
  "Obergeschoss": ["das", "Obergeschosse", "upper floor"],
  "Untergeschoss": ["das", "Untergeschosse", "basement floor"],
};

const ANGLICISMS_B1_VERBS = {
  "googeln": ["google (look up online)", null],
  "bloggen": ["blog", null],
  "campen": ["camp", null],
  "chatten": ["chat (online)", null],
  "checken": ["check", null],
  "faxen": ["fax", null],
  "jobben": ["work casually/have a job", null],
  "joggen": ["jog", null],
  "mailen": ["email/send a mail", null],
  "surfen": ["surf (web/waves)", null],
  "twittern": ["tweet/post on Twitter", null],
};

const ANGLICISMS_B1_ADJ = {
  "cool": "cool",
  "fit": "fit",
  "global": "global",
  "live": "live (broadcast)",
  "online": "online",
  "okay": "okay",
};

const COLOURS_BASE_ADJ = {
  "schwarz": "black",
  "weiß": "white",
  "grau": "grey",
  "rot": "red",
  "blau": "blue",
  "gelb": "yellow",
  "grün": "green",
  "braun": "brown",
  "lila": "purple/lilac",
  "orange": "orange",
  "rosa": "pink",
  "violett": "violet",
};

const DIRECTIONS_ADJ = {
  "nördlich": "northern/north",
  "südlich": "southern/south",
  "östlich": "eastern/east",
  "westlich": "western/west",
};

const TIME_ADV_BASE = {
  "täglich": "daily",
  "tagsüber": "during the daytime",
  "morgens": "in the morning(s)",
  "vormittags": "before noon",
  "mittags": "at midday",
  "nachmittags": "in the afternoon(s)",
  "abends": "in the evening(s)",
  "nachts": "at night/nightly",
  "monatlich": "monthly",
  "jährlich": "annually",
  "wöchentlich": "weekly",
  "stündlich": "hourly",
  "montags": "on Mondays",
  "dienstags": "on Tuesdays",
  "mittwochs": "on Wednesdays",
  "donnerstags": "on Thursdays",
  "freitags": "on Fridays",
  "samstags": "on Saturdays",
  "sonntags": "on Sundays",
  "sonnabends": "on Saturdays (northern German)",
  "wochentags": "on weekdays",
  "werktags": "on working days",
};

const FAMILY_STATUS_ADJ = {
  "ledig": "single (unmarried)",
  "verheiratet": "married",
  "geschieden": "divorced",
};

const ORDINALS_ADJ = {
  "erste": "first",
  "zweite": "second",
  "dritte": "third",
  "vierte": "fourth",
  "fünfte": "fifth",
  "sechste": "sixth",
  "siebte": "seventh",
  "achte": "eighth",
  "neunte": "ninth",
  "zehnte": "tenth",
  "elfte": "eleventh",
  "zwölfte": "twelfth",
  "erstens": "firstly",
  "zweitens": "secondly",
  "drittens": "thirdly",
  "viertens": "fourthly",
};

const NUMBERS_ADJ = {
  "eins": "one",
  "zwei": "two",
  "drei": "three",
  "vier": "four",
  "fünf": "five",
  "sechs": "six",
  "sieben": "seven",
  "acht": "eight",
  "neun": "nine",
  "zehn": "ten",
  "elf": "eleven",
  "zwölf": "twelve",
  "dreizehn": "thirteen",
  "vierzehn": "fourteen",
  "fünfzehn": "fifteen",
  "sechzehn": "sixteen",
  "siebzehn": "seventeen",
  "achtzehn": "eighteen",
  "neunzehn": "nineteen",
  "zwanzig": "twenty",
  "einundzwanzig": "twenty-one",
  "dreißig": "thirty",
  "vierzig": "forty",
  "fünfzig": "fifty",
  "sechzig": "sixty",
  "siebzig": "seventy",
  "achtzig": "eighty",
  "neunzig": "ninety",
  "hundert": "(one) hundred",
  "tausend": "(one) thousand",
  "einmal": "once",
  "zweimal": "twice",
  "dreimal": "three times",
  "viermal": "four times",
  "einfach": "simple/once",
  "doppelt": "double/twice",
  "zweifach": "twofold",
  "plus": "plus",
  "minus": "minus",
  "halb": "half",
};

const NUMBERS_NOUNS = {
  "Million": ["die", "Millionen", "million"],
  "Milliarde": ["die", "Milliarden", "billion (10^9)"],
  "Drittel": ["das", "Drittel", "(one) third"],
  "Viertel": ["das", "Viertel", "(one) quarter"],
};

const FORMAT_ADJ = {
  "schweizerisch": "Swiss",
  "österreichisch": "Austrian",
  "luxemburgisch": "Luxembourgish",
  "europäisch": "European",
  "türkisch": "Turkish",
  "griechisch": "Greek",
  "ukrainisch": "Ukrainian",
  "finnisch": "Finnish",
  "mexikanisch": "Mexican",
  "konservativ": "conservative",
  "liberal": "liberal",
  "demokratisch": "democratic",
  "staatlich": "state/governmental",
};

// ----------------------------------------------------------------------
// Per-level group composition
// Each level group is an object: { name, slug, nouns, verbs, adjectives }
// nouns/verbs/adjectives are arrays of headword strings (not data tuples).
// The actual data tuples come from the BASE constants above.

const A1_GROUPS = [
  {
    name: "Zahlen", slug: "zahlen",
    nouns: ["Million", "Milliarde", "Drittel", "Viertel"],
    adjectives: [
      ...Object.keys(NUMBERS_ADJ),
      "erste","zweite","dritte","vierte","fünfte","sechste","siebte","achte","neunte","zehnte","elfte","zwölfte",
    ],
  },
  {
    name: "Zeitmaße / Zeitangaben", slug: "zeitmasse",
    nouns: Object.keys(TIME_UNITS_BASE),
  },
  {
    name: "Wochentage", slug: "wochentage",
    nouns: Object.keys(WEEKDAYS_BASE).filter(w => !["Werktag","Arbeitstag","Feiertag"].includes(w)),
  },
  {
    name: "Tageszeiten", slug: "tageszeiten",
    nouns: Object.keys(TIME_OF_DAY_BASE).filter(w => w !== "Mitternacht"),
  },
  {
    name: "Monatsnamen", slug: "monate",
    nouns: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
  },
  {
    name: "Jahreszeiten", slug: "jahreszeiten",
    nouns: ["Frühling","Frühjahr","Sommer","Herbst","Winter"],
  },
  {
    name: "Währungen, Maße und Gewichte", slug: "masse",
    nouns: ["Euro","Cent","Meter","Zentimeter","Kilometer","Quadratmeter","Grad","Prozent","Liter","Gramm","Pfund","Kilo","Kilogramm"],
  },
  {
    name: "Länder und Nationalitäten", slug: "laender",
    nouns: ["Deutschland","Europa","Türkei","Finnland","Mexiko","Deutsche","Europäer","Europäerin","Türke","Türkin","Finne","Finnin","Mexikaner","Mexikanerin"],
    adjectives: ["europäisch","türkisch","finnisch","mexikanisch"],
  },
  {
    name: "Farben", slug: "farben",
    adjectives: ["schwarz","weiß","grau","rot","blau","gelb","grün","braun"],
  },
  {
    name: "Himmelsrichtungen", slug: "himmelsrichtungen",
    nouns: ["Norden","Süden","Osten","Westen"],
  },
];

const A2_GROUPS = [
  {
    name: "Familienmitglieder", slug: "familie",
    nouns: ["Bruder","Cousin","Cousine","Eltern","Enkel","Enkelin","Geschwister","Großeltern","Großmutter","Großvater","Oma","Opa","Kind","Mama","Mutter","Onkel","Papa","Schwester","Sohn","Tante","Tochter","Vater","Verwandte"],
  },
  {
    name: "Familienstand", slug: "familienstand",
    adjectives: ["ledig","verheiratet","geschieden"],
  },
  {
    name: "Farben", slug: "farben",
    adjectives: ["blau","braun","gelb","grau","grün","lila","orange","rosa","rot","schwarz","weiß"],
  },
  {
    name: "Berufe", slug: "berufe",
    nouns: Object.keys(PROFESSIONS_A2_BASE),
  },
  {
    name: "Himmelsrichtungen", slug: "himmelsrichtungen",
    nouns: ["Norden","Süden","Osten","Westen"],
  },
  {
    name: "Länder und Nationalitäten", slug: "laender",
    nouns: ["Deutschland","Österreich","Luxemburg","Europa","Deutsche","Österreicher","Österreicherin","Schweizer","Schweizerin","Luxemburger","Luxemburgerin","Europäer","Europäerin"],
    adjectives: ["österreichisch","schweizerisch","luxemburgisch","europäisch"],
  },
  {
    name: "Schule und Schulfächer", slug: "schule",
    nouns: ["Abitur","Direktor","Direktorin","Hausaufgabe","Klasse","Klassenfahrt","Sekretariat","Stundenplan","Biologie","Chemie","Englisch","Französisch","Geografie","Geschichte","Latein","Mathematik","Musik","Physik","Religion","Sozialkunde","Sport","Kunst"],
  },
  {
    name: "Währungen und Maße", slug: "masse",
    nouns: ["Euro","Cent","Franken","Rappen","Meter","Zentimeter","Kilometer","Prozent","Liter","Gramm","Kilogramm","Grad"],
  },
  {
    name: "Feiertage", slug: "feiertage",
    nouns: ["Karneval","Ostern","Weihnachten","Neujahr","Silvester"],
  },
  {
    name: "Jahreszeiten", slug: "jahreszeiten",
    nouns: ["Frühling","Frühjahr","Sommer","Herbst","Winter"],
  },
  {
    name: "Monatsnamen", slug: "monate",
    nouns: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
  },
  {
    name: "Tageszeiten", slug: "tageszeiten",
    nouns: ["Tag","Morgen","Vormittag","Mittag","Nachmittag","Abend","Nacht","Mitternacht"],
    adjectives: ["täglich","tagsüber","morgens","vormittags","mittags","nachmittags","abends","nachts"],
  },
  {
    name: "Wochentage", slug: "wochentage",
    nouns: ["Wochenende","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag","Arbeitstag","Werktag","Feiertag"],
    adjectives: ["montags","dienstags","mittwochs","donnerstags","freitags","samstags","sonntags"],
  },
  {
    name: "Zeitmaße", slug: "zeitmasse",
    nouns: ["Sekunde","Minute","Stunde","Woche","Jahr"],
  },
  {
    name: "Zahlen", slug: "zahlen",
    nouns: ["Million","Drittel","Viertel"],
    adjectives: [
      ...Object.keys(NUMBERS_ADJ),
      "erste","zweite","dritte","vierte","erstens","zweitens","drittens","viertens",
    ],
  },
];

const B1_GROUPS = [
  {
    name: "Anglizismen", slug: "anglizismen",
    nouns: Object.keys(ANGLICISMS_B1_NOUNS),
    verbs: Object.keys(ANGLICISMS_B1_VERBS),
    adjectives: Object.keys(ANGLICISMS_B1_ADJ),
  },
  {
    name: "Bildung: Schulfächer", slug: "schulfaecher",
    nouns: ["Biologie","Chemie","Geografie","Geschichte","Mathematik","Musik","Philosophie","Physik","Sport"],
  },
  {
    name: "Farben", slug: "farben",
    adjectives: Object.keys(COLOURS_BASE_ADJ),
  },
  {
    name: "Himmelsrichtungen", slug: "himmelsrichtungen",
    nouns: ["Norden","Osten","Süden","Westen"],
    adjectives: ["nördlich","östlich","südlich","westlich"],
  },
  {
    name: "Länder, Nationalitäten, Sprachen", slug: "laender",
    nouns: ["Deutschland","Österreich","Schweiz","Türkei","Griechenland","Ukraine","Europa","Deutsche","Europäer","Europäerin","Österreicher","Österreicherin","Schweizer","Schweizerin","Türke","Türkin","Grieche","Griechin","Ukrainer","Ukrainerin"],
    adjectives: ["österreichisch","schweizerisch","türkisch","griechisch","ukrainisch","europäisch"],
  },
  {
    name: "Politische Begriffe", slug: "politik",
    nouns: Object.keys(POLITICS_B1_BASE),
    adjectives: ["konservativ","liberal","demokratisch","staatlich"],
  },
  {
    name: "Tiere", slug: "tiere",
    nouns: Object.keys(ANIMALS_B1_BASE),
  },
  {
    name: "Währungen, Maße und Gewichte", slug: "masse",
    nouns: ["Euro","Cent","Franken","Rappen","Meter","Zentimeter","Kilometer","Quadratmeter","Grad","Prozent","Liter","Gramm","Pfund","Kilogramm","Dekagramm"],
  },
  {
    name: "Zahlen, Bruchzahlen", slug: "zahlen",
    nouns: ["Million","Milliarde","Drittel","Viertel"],
    adjectives: [
      ...Object.keys(NUMBERS_ADJ),
      "erste","zweite","dritte","vierte","fünfte","sechste","siebte","achte","neunte","zehnte","erstens","zweitens","drittens","viertens",
    ],
  },
  {
    name: "Feiertage", slug: "feiertage",
    nouns: ["Neujahr","Ostern","Pfingsten","Weihnachten","Silvester","Nationalfeiertag"],
  },
  {
    name: "Jahreszeiten", slug: "jahreszeiten",
    nouns: ["Frühling","Frühjahr","Sommer","Herbst","Winter"],
  },
  {
    name: "Monatsnamen", slug: "monate",
    nouns: ["Januar","Jänner","Februar","Feber","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
  },
  {
    name: "Tageszeiten", slug: "tageszeiten",
    nouns: ["Tag","Morgen","Vormittag","Mittag","Nachmittag","Abend","Nacht","Mitternacht"],
    adjectives: ["täglich","tagsüber","morgens","vormittags","mittags","nachmittags","abends","nachts"],
  },
  {
    name: "Wochentage", slug: "wochentage",
    nouns: ["Wochentag","Wochenende","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonnabend","Sonntag"],
    adjectives: ["montags","dienstags","mittwochs","donnerstags","freitags","samstags","sonntags","sonnabends","wochentags","werktags"],
  },
  {
    name: "Zeitangaben", slug: "zeitangaben",
    nouns: ["Sekunde","Minute","Stunde","Tag","Woche","Monat","Jahr","Jahrzehnt","Jahrhundert","Jahrtausend"],
    adjectives: ["stündlich","täglich","wöchentlich","monatlich","jährlich"],
  },
];

module.exports = {
  // base data dictionaries
  FAMILY_BASE, TIME_OF_DAY_BASE, WEEKDAYS_BASE, MONTHS_BASE, SEASONS_BASE,
  TIME_UNITS_BASE, HOLIDAYS_BASE, CURRENCY_BASE, MEASURES_BASE,
  DIRECTIONS_BASE, COUNTRIES_BASE, NATIONALITIES_BASE,
  PROFESSIONS_A2_BASE, SCHOOL_A2_BASE,
  POLITICS_B1_BASE, ANIMALS_B1_BASE,
  ANGLICISMS_B1_NOUNS, ANGLICISMS_B1_VERBS, ANGLICISMS_B1_ADJ,
  NUMBERS_NOUNS,
  // adjective dictionaries
  COLOURS_BASE_ADJ, DIRECTIONS_ADJ, TIME_ADV_BASE,
  FAMILY_STATUS_ADJ, ORDINALS_ADJ, NUMBERS_ADJ, FORMAT_ADJ,
  // group composition per level
  A1_GROUPS, A2_GROUPS, B1_GROUPS,
};

"""
City name normalization: Swedish city names to English equivalents.

Standardizes location names for consistent output across all extractions.
"""

from typing import Tuple

# Swedish city names -> English equivalents
# Only includes cities where the spelling differs
CITY_NAME_MAP = {
    # Sweden - Major cities
    "göteborg": "Gothenburg",
    "malmö": "Malmo",
    "helsingborg": "Helsingborg",  # Sometimes spelled Hälsingborg
    "hälsingborg": "Helsingborg",
    "norrköping": "Norrkoping",
    "linköping": "Linkoping",
    "örebro": "Orebro",
    "västerås": "Vasteras",
    "jönköping": "Jonkoping",
    "umeå": "Umea",
    "luleå": "Lulea",
    "gävle": "Gavle",
    "borås": "Boras",
    "södertälje": "Sodertalje",
    "eskilstuna": "Eskilstuna",
    "halmstad": "Halmstad",
    "växjö": "Vaxjo",
    "karlstad": "Karlstad",
    "sundsvall": "Sundsvall",
    "östersund": "Ostersund",
    "trollhättan": "Trollhattan",
    "lund": "Lund",
    "kalmar": "Kalmar",
    "falun": "Falun",
    "skellefteå": "Skelleftea",
    "kristianstad": "Kristianstad",
    "karlskrona": "Karlskrona",
    "skövde": "Skovde",
    "uddevalla": "Uddevalla",
    "varberg": "Varberg",
    "örnsköldsvik": "Ornskoldsvik",
    "nyköping": "Nykoping",
    "karlskoga": "Karlskoga",
    "motala": "Motala",
    "köping": "Koping",
    "värnamo": "Varnamo",
    "enköping": "Enkoping",
    "lidköping": "Lidkoping",
    "alingsås": "Alingsas",
    "ängelholm": "Angelholm",
    "mjölby": "Mjolby",
    "trelleborg": "Trelleborg",
    "mariestad": "Mariestad",
    "katrineholm": "Katrineholm",
    "köpenhamn": "Copenhagen",  # Danish capital in Swedish
    "helsingfors": "Helsinki",  # Finnish capital in Swedish

    # Denmark - Danish spellings and Swedish spellings
    "københavn": "Copenhagen",  # Correct Danish spelling
    "köbenhavn": "Copenhagen",  # Swedish spelling
    "københaven": "Copenhagen",  # Variant
    "århus": "Aarhus",
    "ålborg": "Aalborg",
    "odense": "Odense",
    "roskilde": "Roskilde",
    "esbjerg": "Esbjerg",
    "kolding": "Kolding",
    "horsens": "Horsens",
    "vejle": "Vejle",
    "randers": "Randers",
    "viborg": "Viborg",
    "silkeborg": "Silkeborg",
    "herning": "Herning",
    "næstved": "Naestved",
    "frederiksberg": "Frederiksberg",
    "hørsholm": "Horsholm",
    "helsingør": "Helsingor",

    # Finland - Swedish names for Finnish cities (used in Swedish-language sources)
    "åbo": "Turku",
    "tammerfors": "Tampere",
    "uleåborg": "Oulu",
    "vasa": "Vaasa",
    "björneborg": "Pori",
    "nystad": "Uusikaupunki",
    "jakobstad": "Pietarsaari",
    "mariehamn": "Mariehamn",  # Åland capital
    "ekenäs": "Tammisaari",
    "borgå": "Porvoo",
    "lovisa": "Loviisa",
    "hangö": "Hanko",
    "karleby": "Kokkola",
    "gamlakarleby": "Kokkola",
    "kuopio": "Kuopio",
    "jyväskylä": "Jyvaskyla",
    "lahti": "Lahti",
    "espoo": "Espoo",
    "vantaa": "Vantaa",
}


def normalize_city(raw_value: str) -> Tuple[str, str]:
    """
    Normalize city names from Swedish to English spelling.

    Args:
        raw_value: The raw city/location name

    Returns:
        Tuple of (normalized_name, confidence)
        - confidence: "high" if mapped, "medium" if passed through unchanged
    """
    if not raw_value or not isinstance(raw_value, str):
        return ("", "low")

    raw_value = raw_value.strip()
    if not raw_value:
        return ("", "low")

    # Check for exact match (case-insensitive)
    lookup = raw_value.lower()
    if lookup in CITY_NAME_MAP:
        return (CITY_NAME_MAP[lookup], "high")

    # No mapping found - return as-is with medium confidence
    # (it might already be in English or be a city we don't have mapped)
    return (raw_value, "medium")

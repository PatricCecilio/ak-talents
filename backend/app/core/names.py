"""Person names typed in ALL CAPS ("PATRIC CECILIO") become "Patric Cecilio" when saved.

Only names without any lowercase letter are touched: whatever the person typed with lowercase letters is kept
as is (e.g. "Ana de Souza", "McDonald").
"""

import re

LOWERCASE_PARTICLES = {"da", "de", "do", "das", "dos", "e", "di", "du"}


def _capitalize_word(word: str) -> str:
    # Keeps hyphenated and apostrophe names right: "ANA-MARIA" -> "Ana-Maria", "D'ÁVILA" -> "D'Ávila".
    return re.sub(r"[^\W\d_]+", lambda match: match.group(0)[0].upper() + match.group(0)[1:].lower(), word.lower())


def normalize_person_name(name: str) -> str:
    cleaned = " ".join(name.split())
    has_letters = any(char.isalpha() for char in cleaned)
    if not has_letters or any(char.islower() for char in cleaned):
        return cleaned

    words = cleaned.split(" ")
    return " ".join(
        word.lower() if index > 0 and word.lower() in LOWERCASE_PARTICLES else _capitalize_word(word)
        for index, word in enumerate(words)
    )

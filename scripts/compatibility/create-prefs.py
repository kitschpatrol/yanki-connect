"""Write a prefs21.db holding only Anki's global metadata.

# cspell:ignore prefs

With this file present, Anki (2.1.15 through the current release) skips the
first-run language dialog, creates the default "User 1" profile itself, and
does not check for updates. Usage: create-prefs.py <anki base folder>
"""

import os
import pickle
import sqlite3
import sys
import time

meta = {
    "ver": 0,
    "updates": False,
    "created": int(time.time()),
    "id": 1,
    "lastMsg": -1,
    "suppressUpdate": True,
    "firstRun": False,
    "defaultLang": "en_US",
    "disabledAddons": [],
}

db = sqlite3.connect(os.path.join(sys.argv[1], "prefs21.db"))
db.execute("create table if not exists profiles (name text primary key, data blob not null)")
db.execute(
    "insert or replace into profiles values ('_global', ?)",
    (pickle.dumps(meta, protocol=2),),
)
db.commit()
db.close()

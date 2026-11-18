"""
Single canonical SQLAlchemy declarative base for CORTIX.

Pre-existing issue this resolves (see CURRENT_STATE.md, section 4):
the Mindora codebase defined `Base = declarative_base()` in TWO places
(`backend/database/models.py` and independently referenced from
`backend/auth/models.py`), with two different `User` model definitions
sharing the same table name (`users`). Importing both in the same
process would raise:

    sqlalchemy.exc.InvalidRequestError: Table 'users' is already defined
    for this MetaData instance.

There is now exactly one `Base` for the whole project. Every model
module imports it from here.
"""
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()
